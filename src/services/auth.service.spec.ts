import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hashRefreshToken } from '../common/security/refresh-token.js';
import type { RefreshToken } from '../entities/refresh-token.entity.js';
import type { User } from '../entities/user.entity.js';
import type { RefreshTokensRepository } from '../repositories/refresh-tokens.repository.js';
import type { UsersRepository } from '../repositories/users.repository.js';
import { AuthService } from './auth.service.js';

const USER_ID = 'u0000000-0000-4000-8000-000000000000';

function storedToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'rt1',
    userId: USER_ID,
    tokenHash: hashRefreshToken('old-token'),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ...overrides,
  } as RefreshToken;
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: {
    create: ReturnType<typeof vi.fn>;
    findByEmailWithPassword: ReturnType<typeof vi.fn>;
    isUniqueViolation: ReturnType<typeof vi.fn>;
  };
  let refreshTokens: {
    create: ReturnType<typeof vi.fn>;
    findByHash: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    usersRepository = {
      create: vi.fn(),
      findByEmailWithPassword: vi.fn(),
      isUniqueViolation: vi.fn().mockReturnValue(false),
    };
    refreshTokens = {
      create: vi.fn().mockResolvedValue({}),
      findByHash: vi.fn(),
      revoke: vi.fn().mockResolvedValue(true),
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    const jwtService = { signAsync: vi.fn().mockResolvedValue('access') };
    const configService = { get: vi.fn().mockReturnValue(undefined) };

    service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokens as unknown as RefreshTokensRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('register issues an access and refresh token and stores only the hash', async () => {
    usersRepository.create.mockResolvedValue({
      id: USER_ID,
      email: 'a@b.c',
      passwordHash: 'x',
    } as User);

    const session = await service.register({
      email: 'a@b.c',
      password: 'password123',
    } as never);

    expect(session.accessToken).toBe('access');
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(session.user).not.toHaveProperty('passwordHash');
    const saved = refreshTokens.create.mock.calls[0][0];
    expect(saved.userId).toBe(USER_ID);
    expect(saved.tokenHash).toBe(hashRefreshToken(session.refreshToken));
    expect(saved.tokenHash).not.toBe(session.refreshToken);
    expect(saved.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1000,
    );
  });

  it('refresh revokes the presented token and issues a new pair', async () => {
    refreshTokens.findByHash.mockResolvedValue(storedToken());

    const tokens = await service.refresh('old-token');

    expect(refreshTokens.findByHash).toHaveBeenCalledWith(
      hashRefreshToken('old-token'),
    );
    expect(refreshTokens.revoke).toHaveBeenCalledWith('rt1');
    expect(tokens.accessToken).toBe('access');
    expect(tokens.refreshToken).not.toBe('old-token');
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('refresh rejects an unknown token', async () => {
    refreshTokens.findByHash.mockResolvedValue(null);

    await expect(service.refresh('nope')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it('refresh rejects an expired token', async () => {
    refreshTokens.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );

    await expect(service.refresh('old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revoke).not.toHaveBeenCalled();
  });

  it('refresh with a revoked token revokes every session of the user', async () => {
    refreshTokens.findByHash.mockResolvedValue(
      storedToken({ revokedAt: new Date() }),
    );

    await expect(service.refresh('old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it('refresh that loses a concurrent rotation is treated as reuse', async () => {
    refreshTokens.findByHash.mockResolvedValue(storedToken());
    refreshTokens.revoke.mockResolvedValue(false);

    await expect(service.refresh('old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it('logout revokes the token and ignores unknown ones', async () => {
    refreshTokens.findByHash.mockResolvedValueOnce(storedToken());
    await service.logout('old-token');
    expect(refreshTokens.revoke).toHaveBeenCalledWith('rt1');

    refreshTokens.findByHash.mockResolvedValueOnce(null);
    await expect(service.logout('nope')).resolves.toBeUndefined();
    expect(refreshTokens.revoke).toHaveBeenCalledTimes(1);
  });

  it('logoutAll revokes every session of the user', async () => {
    await service.logoutAll(USER_ID);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
  });
});
