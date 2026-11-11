import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Model } from 'mongoose';
import type { AuthenticatedUser } from './auth.types';
import { AuthService, type LoginResult } from './auth.service';
import { CaptchaService } from './captcha.service';
import { GoogleProviderService } from './google-provider.service';
import { GoogleAccount } from './schemas/google-account.schema';
import { GoogleOAuthState } from './schemas/google-oauth-state.schema';

type GoogleResult = {
  mode: 'login' | 'link';
  status:
    | 'linked'
    | 'signed-in'
    | 'cancelled'
    | 'error'
    | 'unlinked'
    | 'already-used';
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
      pending.mode === 'link' &&
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

    if (pending.mode === 'link') {
      if (!pending.userId || !pending.scope) throw new UnauthorizedException();
      try {
        await this.authService.getSession(
          pending.userId.toString(),
          pending.scope,
          pending.membershipId ?? undefined,
        );
      } catch {
        return { mode: 'link', status: 'error' };
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
    mode: 'login' | 'link',
    userId?: string,
    accessTokenHash?: string,
    scope?: 'platform' | 'tenant',
    membershipId?: string,
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
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    return { url: authorization.url, state };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
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
