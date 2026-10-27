import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/security/password.js';
import { LoginDto, RegisterDto } from '../dto/auth/index.js';
import { User } from '../entities/user.entity.js';
import { UsersRepository } from '../repositories/users.repository.js';

type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

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

    if (!user || !(await verifyPassword(loginDto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  private async createSession(user: User) {
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { accessToken, user: publicUser as PublicUser };
  }
}
