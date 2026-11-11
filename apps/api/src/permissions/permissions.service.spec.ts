/// <reference types="node" />

import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermissionsService } from './permissions.service';

test('agrupa los permisos activos por módulo y alcance', async () => {
  let filter: unknown;
  const service = new PermissionsService({
    find(value: unknown) {
      filter = value;
      return {
        sort: () => ({
          lean: async () => [
            {
              key: 'eventos.crear',
              moduleKey: 'eventos',
              moduleName: 'Eventos',
              moduleDescription: 'Gestión de eventos.',
              scope: 'tenant',
              action: 'crear',
              name: 'Crear',
            },
            {
              key: 'eventos.ver',
              moduleKey: 'eventos',
              moduleName: 'Eventos',
              moduleDescription: 'Gestión de eventos.',
              scope: 'tenant',
              action: 'ver',
              name: 'Ver',
            },
          ],
        }),
      };
    },
  } as never);

  assert.deepEqual(await service.findAll('tenant'), [
    {
      key: 'eventos',
      name: 'Eventos',
      description: 'Gestión de eventos.',
      scope: 'tenant',
      permissions: [
        { key: 'eventos.crear', name: 'Crear', action: 'crear' },
        { key: 'eventos.ver', name: 'Ver', action: 'ver' },
      ],
    },
  ]);
  assert.deepEqual(filter, { status: 'activo', scope: 'tenant' });
});
