/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createProviderConfirmationToken,
  digestProviderConfirmationToken,
  matchesProviderConfirmationToken,
  deriveProviderConfirmationToken,
} from './provider-confirmation-token';

test('el token aleatorio solo coincide con su huella', () => {
  const first = createProviderConfirmationToken();
  const second = createProviderConfirmationToken();
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.digest);
  assert.equal(digestProviderConfirmationToken(first.token), first.digest);
  assert.equal(
    matchesProviderConfirmationToken(first.token, first.digest),
    true,
  );
  assert.equal(
    matchesProviderConfirmationToken(second.token, first.digest),
    false,
  );
});

test('el reenvío cambia el token y el mismo secreto permite recuperarlo después de reiniciar', () => {
  const secret = 'secreto-largo-de-pruebas-para-confirmaciones';
  const first = deriveProviderConfirmationToken(secret, 'service-1', 1);
  assert.equal(first, deriveProviderConfirmationToken(secret, 'service-1', 1));
  assert.notEqual(
    first,
    deriveProviderConfirmationToken(secret, 'service-1', 2),
  );
  assert.notEqual(
    first,
    deriveProviderConfirmationToken(secret, 'service-2', 1),
  );
  assert.notEqual(
    first,
    deriveProviderConfirmationToken(secret + '-otro', 'service-1', 1),
  );
});

test('rechaza tokens y huellas malformados', () => {
  const { token, digest } = createProviderConfirmationToken();
  for (const invalid of ['', 'abc', 'g'.repeat(64), token + '0']) {
    assert.equal(matchesProviderConfirmationToken(invalid, digest), false);
    assert.equal(matchesProviderConfirmationToken(token, invalid), false);
  }
});
