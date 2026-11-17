import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHttpTestApi } from '../testing/http-test-api';

test('HTTP: recupera la contraseña con un código de un solo uso', async () => {
  let message = '';
  const api = await createHttpTestApi('password_reset_test', undefined, {
    send: async (_to, _subject, text) => void (message = text),
  });
  try {
    await api.seedAccessControl();
    await api.seedDeveloper({
      email: 'owner@example.test',
      password: 'Prueba-segura1!',
    });
    const request = await api.request('auth/password-reset/request', {
      method: 'POST',
      body: { email: 'owner@example.test' },
    });
    assert.equal(request.status, 200);
    const code = message.match(/es ([A-Z0-9]{6})\./)?.[1];
    assert.ok(code);

    assert.equal(
      (
        await api.request('auth/password-reset/verify', {
          method: 'POST',
          body: { email: 'owner@example.test', code: 'AAAAAA' },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api.request('auth/password-reset/verify', {
          method: 'POST',
          body: { email: 'owner@example.test', code },
        })
      ).status,
      200,
    );

    assert.equal(
      (
        await api.request('auth/password-reset/confirm', {
          method: 'POST',
          body: {
            email: 'owner@example.test',
            code: 'AAAAAA',
            newPassword: 'Nueva-segura1!',
          },
        })
      ).status,
      401,
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await api.request('auth/password-reset/confirm', {
        method: 'POST',
        body: {
          email: 'owner@example.test',
          code,
          newPassword: 'Prueba-segura1!',
        },
      });
      assert.equal(response.status, 400);
      assert.equal(
        (await response.json()).message,
        'La nueva contraseña debe ser diferente a la actual.',
      );
    }
    assert.equal(
      (
        await api.request('auth/password-reset/confirm', {
          method: 'POST',
          body: {
            email: 'owner@example.test',
            code,
            newPassword: 'Nueva-segura1!',
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('auth/password-reset/confirm', {
          method: 'POST',
          body: {
            email: 'owner@example.test',
            code,
            newPassword: 'Otra-segura1!',
          },
        })
      ).status,
      401,
    );
    assert.equal(
      (await api.login('owner@example.test', 'Nueva-segura1!')).data !== null,
      true,
    );
  } finally {
    await api.close();
  }
});
