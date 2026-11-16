import { createHash, randomBytes } from 'node:crypto';

// Opaque, high-entropy token: a fast hash is enough, no salt or KDF needed.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
