/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Connection } from 'mongoose';
import { addEventInvitadosMigration } from './20261115-add-event-invitados.migration';

test('la migración agrega invitados solo a eventos que no lo tienen', async () => {
  const events: Array<{ invitados?: number }> = [{}, { invitados: 12 }];
  const connection = {
    collection: (name: string) => {
      assert.equal(name, 'events');
      return {
        updateMany: async (filter: unknown, update: unknown) => {
          assert.deepEqual(filter, { invitados: { $exists: false } });
          assert.deepEqual(update, { $set: { invitados: 0 } });
          for (const event of events) {
            if (!('invitados' in event)) event.invitados = 0;
          }
        },
      };
    },
  } as unknown as Connection;

  await addEventInvitadosMigration.up(connection);
  await addEventInvitadosMigration.up(connection);
  assert.deepEqual(events, [{ invitados: 0 }, { invitados: 12 }]);
});
