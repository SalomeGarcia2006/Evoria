import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates/password-reset.email';
import { PasswordService } from '../users/password.service';
import { User } from '../users/schemas/user.schema';
import { AuthConfigService } from './auth.config';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly passwordService: PasswordService,
    private readonly mailService: MailService,
    private readonly authConfig: AuthConfigService,
  ) {}

  async request(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email: normalizedEmail, status: 'activo' })
      .select(
        '+passwordResetCodeHash +passwordResetCodeExpiresAt +passwordResetCodeSentAt +passwordResetCodeAttempts',
      );
    if (!user) return;

    const now = new Date();
    if (
      user.passwordResetCodeSentAt &&
      user.passwordResetCodeSentAt.getTime() > now.getTime() - 60_000
    )
      return;

    const code = this.generateCode();
    const hash = this.codeHash(user._id.toString(), code);
    user.passwordResetCodeHash = hash;
    user.passwordResetCodeExpiresAt = new Date(now.getTime() + 10 * 60_000);
    user.passwordResetCodeSentAt = now;
    user.passwordResetCodeAttempts = 0;
    await user.save();

    const content = passwordResetEmail(code);
    try {
      await this.mailService.send(
        user.email,
        content.subject,
        content.text,
        content.html,
      );
    } catch {
      await this.userModel.updateOne(
        { _id: user._id, passwordResetCodeHash: hash },
        {
          $set: {
            passwordResetCodeHash: null,
            passwordResetCodeExpiresAt: null,
            passwordResetCodeSentAt: null,
            passwordResetCodeAttempts: 0,
          },
        },
      );
      throw new ServiceUnavailableException('No se pudo enviar el código.');
    }
  }

  async confirm(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel
      .findOneAndUpdate(
        {
          email: email.trim().toLowerCase(),
          status: 'activo',
          passwordResetCodeHash: { $ne: null },
          passwordResetCodeExpiresAt: { $gt: new Date() },
          passwordResetCodeAttempts: { $lt: 5 },
        },
        { $inc: { passwordResetCodeAttempts: 1 } },
        { returnDocument: 'after' },
      )
      .select('+passwordResetCodeHash');

    if (
      !user?.passwordResetCodeHash ||
      !this.equal(
        user.passwordResetCodeHash,
        this.codeHash(user._id.toString(), code.toUpperCase()),
      )
    )
      throw new UnauthorizedException('El código no es válido o expiró.');

    await this.userModel.updateOne(
      { _id: user._id, passwordResetCodeHash: user.passwordResetCodeHash },
      {
        $set: {
          passwordHash: this.passwordService.hash(newPassword),
          refreshTokenHash: null,
          loginAttempts: 0,
          lockedUntil: null,
          passwordResetCodeHash: null,
          passwordResetCodeExpiresAt: null,
          passwordResetCodeSentAt: null,
          passwordResetCodeAttempts: 0,
        },
      },
    );
  }

  async verify(email: string, code: string): Promise<void> {
    const user = await this.userModel
      .findOne({
        email: email.trim().toLowerCase(),
        status: 'activo',
        passwordResetCodeHash: { $ne: null },
        passwordResetCodeExpiresAt: { $gt: new Date() },
        passwordResetCodeAttempts: { $lt: 5 },
      })
      .select('+passwordResetCodeHash');

    if (
      !user?.passwordResetCodeHash ||
      !this.equal(
        user.passwordResetCodeHash,
        this.codeHash(user._id.toString(), code.toUpperCase()),
      )
    )
      throw new UnauthorizedException('El código no es válido o expiró.');
  }

  private codeHash(userId: string, code: string): string {
    return createHmac(
      'sha256',
      this.authConfig.configuration.refreshTokenSecret,
    )
      .update(`${userId}:${code}`)
      .digest('hex');
  }

  private generateCode(): string {
    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from(
      { length: 6 },
      () => characters[randomInt(characters.length)],
    ).join('');
  }

  private equal(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
