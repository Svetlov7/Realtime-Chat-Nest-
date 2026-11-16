import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/security/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../common/security/refresh-token.js';
import { LoginDto, RegisterDto } from '../dto/auth/index.js';
import { User } from '../entities/user.entity.js';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository.js';
import { UsersRepository } from '../repositories/users.repository.js';

type PublicUser = Omit<User, 'passwordHash'>;

const DEFAULT_REFRESH_EXPIRES_IN = 30 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly refreshExpiresInMs: number;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.refreshExpiresInMs =
      Number(
        configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          DEFAULT_REFRESH_EXPIRES_IN,
      ) * 1000;
  }

  async register(registerDto: RegisterDto) {
    const { password, ...profile } = registerDto;
    try {
      const user = await this.usersRepository.create({
        ...profile,
        passwordHash: await hashPassword(password),
      });
      return this.createSession(user);
    } catch (error) {
      if (this.usersRepository.isUniqueViolation(error)) {
        throw new ConflictException('Email or username is already in use');
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findByEmailWithPassword(
      loginDto.email,
    );

    if (
      !user ||
      !(await verifyPassword(loginDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  /**
   * Rotates a refresh token: the presented one is revoked and a new pair is issued.
   * Presenting an already revoked token is treated as theft and revokes every session of the user.
   */
  async refresh(refreshToken: string) {
    const stored = await this.refreshTokensRepository.findByHash(
      hashRefreshToken(refreshToken),
    );

    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      stored.revokedAt ||
      !(await this.refreshTokensRepository.revoke(stored.id))
    ) {
      await this.refreshTokensRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokensRepository.findByHash(
      hashRefreshToken(refreshToken),
    );
    if (stored) {
      await this.refreshTokensRepository.revoke(stored.id);
    }
  }

  logoutAll(userId: string): Promise<void> {
    return this.refreshTokensRepository.revokeAllForUser(userId);
  }

  /** Verifies an access token issued by this service; throws if it is invalid or expired. */
  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
    return { userId: payload.sub };
  }

  private async createSession(user: User) {
    const tokens = await this.issueTokens(user.id);
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { ...tokens, user: publicUser as PublicUser };
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const refreshToken = generateRefreshToken();
    await this.refreshTokensRepository.create({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshExpiresInMs),
    });
    return { accessToken, refreshToken };
  }
}
