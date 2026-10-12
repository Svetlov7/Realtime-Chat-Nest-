import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, keyLength)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [algorithm, salt, storedKeyHex] = passwordHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !storedKeyHex) {
    return false;
  }

  const storedKey = Buffer.from(storedKeyHex, 'hex');
  if (storedKey.length !== keyLength) {
    return false;
  }

  const candidateKey = (await scrypt(password, salt, keyLength)) as Buffer;
  return timingSafeEqual(storedKey, candidateKey);
}