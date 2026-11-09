/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

test('no consulta inventario fuera de una empresa activa', async () => {
  const service = new InventoryService({} as never, {} as never);

  await assert.rejects(
    service.findAll(
      { page: 1, limit: 10 },
      {
        id: 'user-id',
        name: 'Usuario',
        email: 'user@example.test',
        scope: 'platform',
        profileId: 'profile-id',
      },
    ),
    ForbiddenException,
  );
});
