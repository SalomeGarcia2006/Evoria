/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStrongPassword } from './password.policy';

test('valida contraseñas con todas las reglas de seguridad', () => {
  assert.equal(isStrongPassword('Nueva-segura1!'), true);
  assert.equal(isStrongPassword('solominusculas1!'), false);
  assert.equal(isStrongPassword('SinNumero!'), false);
  assert.equal(isStrongPassword('Corta1!'), false);
});
