/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthConfigService } from './auth.config';

test('configura tokens y cookies HTTP-only con duraciones válidas', () => {
  const config = new AuthConfigService({
    get: (key: string, fallback?: string) =>
      ({
        JWT_ACCESS_SECRET: 'access',
        JWT_REFRESH_SECRET: 'refresh',
        JWT_ACCESS_EXPIRES_IN: '2h',
        JWT_REFRESH_EXPIRES_IN: '7d',
        COOKIE_SECURE: 'true',
      })[key] ?? fallback,
  } as never);

  assert.equal(
    config.configuration.accessTokenDuration.milliseconds,
    7_200_000,
  );
  assert.equal(
    config.configuration.refreshTokenDuration.milliseconds,
    604_800_000,
  );
  assert.deepEqual(config.createCookieOptions(1000), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000,
  });
});
