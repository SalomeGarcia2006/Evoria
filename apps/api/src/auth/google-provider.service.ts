import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleProviderService {
  constructor(private readonly configService: ConfigService) {}

  async authorization(state: string, nonce: string) {
    const client = this.client();
    const { codeVerifier, codeChallenge } =
      await client.generateCodeVerifierAsync();
    return {
      codeVerifier,
      url: client.generateAuthUrl({
        scope: ['openid', 'email'],
        state,
        nonce,
        prompt: 'select_account',
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    };
  }

  async exchange(code: string, codeVerifier: string, nonce: string) {
    const client = this.client();
    try {
      const { tokens } = await client.getToken({ code, codeVerifier });
      if (!tokens.id_token) throw new Error('No se recibió identidad.');
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });
      const identity = ticket.getPayload();
      if (
        !identity?.sub ||
        !identity.email ||
        identity.email_verified !== true ||
        identity.nonce !== nonce
      ) {
        throw new Error('Identidad incompleta o no verificada.');
      }
      return { subject: identity.sub, email: identity.email };
    } catch {
      throw new UnauthorizedException(
        'No se pudo verificar la cuenta de Google.',
      );
    }
  }

  private client(): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google no está configurado.');
    }
    return new OAuth2Client(clientId, clientSecret, redirectUri);
  }
}
