/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

test('rechaza seleccionar una empresa con identificador inválido', async () => {
  const service = new TenantsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.join('empresa-inválida', 'user-id'),
    BadRequestException,
  );
});
