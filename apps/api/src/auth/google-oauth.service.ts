import {
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import type { Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { googleChangeCodeEmail } from '../mail/templates/google-change-code.email';
import { AuthConfigService } from './auth.config';
import type { AuthenticatedUser } from './auth.types';
import { AuthService, type LoginResult } from './auth.service';
import { CaptchaService } from './captcha.service';
import { GoogleProviderService } from './google-provider.service';
import { GoogleAccount } from './schemas/google-account.schema';
import { GoogleOAuthState } from './schemas/google-oauth-state.schema';

type GoogleResult = {
  mode: 'login' | 'link' | 'change';
  status:
    | 'linked'
    | 'signed-in'
    | 'cancelled'
    | 'error'
    | 'unlinked'
    | 'already-used'
    | 'changed';
  loginResult?: LoginResult;
};

@Injectable()
export class GoogleOAuthService {
  constructor(
    @InjectModel(GoogleAccount.name)
    private readonly accounts: Model<GoogleAccount>,
    @InjectModel(GoogleOAuthState.name)
    private readonly states: Model<GoogleOAuthState>,
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly googleProvider: GoogleProviderService,
    private readonly mailService: MailService,
    private readonly authConfig: AuthConfigService,
  ) {}

  async connection(userId: string) {
    const account = await this.accounts.findOne({ userId }).lean();
    return account
      ? { linked: true, email: account.email, linkedAt: account.createdAt }
      : { linked: false, email: null, linkedAt: null };
  }

  async startLogin(captchaToken?: string) {
    await this.captchaService.verify(captchaToken);
    return this.start('login');
  }

  async startLink(user: AuthenticatedUser, accessToken?: string) {
    if (!accessToken)
      throw new UnauthorizedException('La sesión no es válida.');
    return this.start(
      'link',
      user.id,
      this.hash(accessToken),
      user.scope,
      user.membershipId,
    );
  }

  async requestChange(userId: string): Promise<void> {
    const code = this.generateCode();
    const hash = this.codeHash(userId, code);
    const now = new Date();
    const account = await this.accounts.findOneAndUpdate(
      {
        userId,
        $or: [
          { changeCodeSentAt: null },
          { changeCodeSentAt: { $lte: new Date(now.getTime() - 60_000) } },
        ],
      },
      {
        $set: {
          changeCodeHash: hash,
          changeCodeExpiresAt: new Date(now.getTime() + 10 * 60_000),
          changeCodeSentAt: now,
          changeCodeAttempts: 0,
        },
      },
      { returnDocument: 'after' },
    );
    if (!account) {
      if (!(await this.accounts.exists({ userId }))) {
        throw new NotFoundException('No hay una cuenta de Google vinculada.');
      }
      throw new HttpException(
        'Espera un minuto antes de pedir otro código.',
        429,
      );
    }
    const email = googleChangeCodeEmail(code);
    try {
      await this.mailService.send(
        account.email,
        email.subject,
        email.text,
        email.html,
      );
    } catch {
      await this.accounts.updateOne(
        { _id: account._id, changeCodeHash: hash },
        {
          $set: {
            changeCodeHash: null,
            changeCodeExpiresAt: null,
            changeCodeSentAt: null,
            changeCodeAttempts: 0,
          },
        },
      );
      throw new ServiceUnavailableException('No se pudo enviar el código.');
    }
  }

  async confirmChange(
    user: AuthenticatedUser,
    accessToken: string | undefined,
    code: string,
  ) {
    if (!accessToken)
      throw new UnauthorizedException('La sesión no es válida.');
    const account = await this.accounts.findOneAndUpdate(
      {
        userId: user.id,
        changeCodeHash: { $ne: null },
        changeCodeExpiresAt: { $gt: new Date() },
        changeCodeAttempts: { $lt: 5 },
      },
      { $inc: { changeCodeAttempts: 1 } },
      { returnDocument: 'after' },
    );
    if (
      !account?.changeCodeHash ||
      !this.equal(
        account.changeCodeHash,
        this.codeHash(user.id, code.toUpperCase()),
      )
    ) {
      throw new UnauthorizedException('El código no es válido o expiró.');
    }
    const consumed = await this.accounts.updateOne(
      {
        _id: account._id,
        changeCodeHash: account.changeCodeHash,
        changeCodeExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          changeCodeHash: null,
          changeCodeExpiresAt: null,
          changeCodeSentAt: null,
          changeCodeAttempts: 0,
        },
      },
    );
    if (!consumed.modifiedCount) {
      throw new UnauthorizedException('El código no es válido o expiró.');
    }
    return this.start(
      'change',
      user.id,
      this.hash(accessToken),
      user.scope,
      user.membershipId,
      account.subject,
    );
  }

  async complete(
    state: string | undefined,
    stateCookie: string | undefined,
    code: string | undefined,
    error: string | undefined,
    accessToken: string | undefined,
  ): Promise<GoogleResult> {
    if (!state || !stateCookie || !this.equal(state, stateCookie)) {
      throw new UnauthorizedException('La solicitud de Google no es válida.');
    }
    const pending = await this.states
      .findOneAndDelete({
        stateHash: this.hash(state),
        expiresAt: { $gt: new Date() },
      })
      .lean();
    if (!pending) {
      throw new UnauthorizedException('La solicitud de Google expiró.');
    }
    if (error || !code) return { mode: pending.mode, status: 'cancelled' };
    if (
      pending.mode !== 'login' &&
      (!accessToken ||
        !pending.accessTokenHash ||
        !this.equal(pending.accessTokenHash, this.hash(accessToken)))
    ) {
      throw new UnauthorizedException(
        'La sesión cambió durante la vinculación.',
      );
    }

    let identity: { subject: string; email: string };
    try {
      identity = await this.googleProvider.exchange(
        code,
        pending.codeVerifier,
        pending.nonce,
      );
    } catch {
      return { mode: pending.mode, status: 'error' };
    }

    if (pending.mode === 'link' || pending.mode === 'change') {
      if (!pending.userId || !pending.scope) throw new UnauthorizedException();
      try {
        await this.authService.getSession(
          pending.userId.toString(),
          pending.scope,
          pending.membershipId ?? undefined,
        );
      } catch {
        return { mode: pending.mode, status: 'error' };
      }
      if (pending.mode === 'change') {
        if (!pending.previousSubject)
          return { mode: 'change', status: 'error' };
        try {
          const changed = await this.accounts.findOneAndUpdate(
            { userId: pending.userId, subject: pending.previousSubject },
            { $set: { subject: identity.subject, email: identity.email } },
            { returnDocument: 'after' },
          );
          return {
            mode: 'change',
            status: changed ? 'changed' : 'error',
          };
        } catch (cause) {
          if (this.isDuplicate(cause)) {
            return { mode: 'change', status: 'already-used' };
          }
          throw cause;
        }
      }
      const existing = await this.accounts.findOne({ userId: pending.userId });
      if (existing?.subject === identity.subject) {
        return { mode: 'link', status: 'linked' };
      }
      if (existing) return { mode: 'link', status: 'already-used' };
      try {
        await this.accounts.create({
          userId: pending.userId,
          subject: identity.subject,
          email: identity.email,
        });
      } catch (cause) {
        if (this.isDuplicate(cause)) {
          return { mode: 'link', status: 'already-used' };
        }
        throw cause;
      }
      return { mode: 'link', status: 'linked' };
    }

    const account = await this.accounts.findOne({ subject: identity.subject });
    if (!account) return { mode: 'login', status: 'unlinked' };
    try {
      const loginResult = await this.authService.loginWithUserId(
        account.userId.toString(),
      );
      await this.accounts.updateOne(
        { _id: account._id },
        { $set: { email: identity.email, lastUsedAt: new Date() } },
      );
      return { mode: 'login', status: 'signed-in', loginResult };
    } catch {
      return { mode: 'login', status: 'error' };
    }
  }

  private async start(
    mode: 'login' | 'link' | 'change',
    userId?: string,
    accessTokenHash?: string,
    scope?: 'platform' | 'tenant',
    membershipId?: string,
    previousSubject?: string,
  ) {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const authorization = await this.googleProvider.authorization(state, nonce);
    await this.states.create({
      stateHash: this.hash(state),
      mode,
      nonce,
      codeVerifier: authorization.codeVerifier,
      userId: userId ?? null,
      accessTokenHash: accessTokenHash ?? null,
      scope: scope ?? null,
      membershipId: membershipId ?? null,
      previousSubject: previousSubject ?? null,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    return { url: authorization.url, state };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
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
    const code = [characters[randomInt(10)], characters[10 + randomInt(26)]];
    while (code.length < 6) code.push(characters[randomInt(characters.length)]);
    for (let i = code.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [code[i], code[j]] = [code[j], code[i]];
    }
    return code.join('');
  }

  private equal(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private isDuplicate(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
