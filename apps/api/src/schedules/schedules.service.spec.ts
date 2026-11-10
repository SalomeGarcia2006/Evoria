/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';

test('no consulta cronogramas fuera de una empresa activa', async () => {
  const service = new SchedulesService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.findAll(
      '507f1f77bcf86cd799439011',
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
