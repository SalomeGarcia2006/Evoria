import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_ALGORITHM = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await this.deriveKey(password, salt);

    return [
      SCRYPT_ALGORITHM,
      SCRYPT_N,
      SCRYPT_R,
      SCRYPT_P,
      salt.toString('base64url'),
      derivedKey.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, n, r, p, salt, storedKey] = passwordHash.split('$');

    if (
      algorithm !== SCRYPT_ALGORITHM ||
      n !== String(SCRYPT_N) ||
      r !== String(SCRYPT_R) ||
      p !== String(SCRYPT_P) ||
      !salt ||
      !storedKey
    ) {
      return false;
    }

    const derivedKey = await this.deriveKey(
      password,
      Buffer.from(salt, 'base64url'),
    );
    const storedKeyBuffer = Buffer.from(storedKey, 'base64url');

    return (
      storedKeyBuffer.length === derivedKey.length &&
      timingSafeEqual(storedKeyBuffer, derivedKey)
    );
  }

  private deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        SCRYPT_KEY_LENGTH,
        {
          N: SCRYPT_N,
          r: SCRYPT_R,
          p: SCRYPT_P,
          maxmem: SCRYPT_MAX_MEMORY,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        },
      );
    });
  }
}
