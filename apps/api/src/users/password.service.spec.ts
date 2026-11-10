/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PasswordService } from './password.service';

test('genera hashes verificables y rechaza contraseñas inválidas', () => {
  const service = new PasswordService();
  const hash = service.hash('contraseña-segura');

  assert.notEqual(hash, 'contraseña-segura');
  assert.equal(service.verify('contraseña-segura', hash), true);
  assert.equal(service.verify('otra-contraseña', hash), false);
  assert.equal(service.verify('contraseña-segura', 'invalido'), false);
});
