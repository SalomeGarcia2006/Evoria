import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CaptchaService } from './captcha.service';

test('CAPTCHA valida el token en servidor y rechaza tokens ausentes o inválidos', async () => {
  const service = new CaptchaService({
    get: (key: string) =>
      ({ CAPTCHA_ENABLED: 'true', TURNSTILE_SECRET_KEY: 'clave-de-prueba' })[
        key as 'CAPTCHA_ENABLED' | 'TURNSTILE_SECRET_KEY'
      ],
  } as never);
  await assert.rejects(service.verify(undefined), BadRequestException);

  const originalFetch = globalThis.fetch;
  try {
    let sentToken: string | undefined;
    globalThis.fetch = async (_url, options) => {
      sentToken =
        (options?.body as URLSearchParams).get('response') ?? undefined;
      return new Response(
        JSON.stringify({ success: sentToken === 'token-válido' }),
        { status: 200 },
      );
    };
    await assert.rejects(service.verify('token-inválido'), BadRequestException);
    await service.verify('token-válido');
    assert.equal(sentToken, 'token-válido');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
