import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_LENGTH = 64;

@Injectable()
export class PasswordService {
  hash(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, HASH_LENGTH).toString('hex');

    return `${salt}:${hash}`;
  }

  verify(password: string, storedPassword: string): boolean {
    const [salt, savedHash] = storedPassword.split(':');

    if (!salt || !savedHash) {
      return false;
    }

    const passwordHash = scryptSync(password, salt, HASH_LENGTH);
    const savedHashBuffer = Buffer.from(savedHash, 'hex');

    return (
      savedHashBuffer.length === passwordHash.length &&
      timingSafeEqual(savedHashBuffer, passwordHash)
    );
  }
}
