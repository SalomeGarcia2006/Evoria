/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

test('no consulta perfiles fuera de una empresa activa', async () => {
  const service = new ProfilesService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.findAll(
      {},
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
