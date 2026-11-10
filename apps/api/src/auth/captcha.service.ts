import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CaptchaService {
  constructor(private readonly configService: ConfigService) {}

  async verify(token: string | undefined): Promise<void> {
    if (this.configService.get<string>('CAPTCHA_ENABLED') !== 'true') return;

    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException('El CAPTCHA no está configurado.');
    }
    if (!token) {
      throw new BadRequestException('Completa la verificación de seguridad.');
    }

    let result: { success?: boolean };
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!response.ok) throw new Error('Siteverify no está disponible.');
      result = (await response.json()) as { success?: boolean };
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar el CAPTCHA. Intenta de nuevo.',
      );
    }

    if (!result.success) {
      throw new BadRequestException(
        'La verificación de seguridad expiró o no es válida.',
      );
    }
  }
}
