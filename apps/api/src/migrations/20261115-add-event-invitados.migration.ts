import type { Migration } from './migration';

export const addEventInvitadosMigration: Migration = {
  id: '20261115-add-event-invitados',
  async up(connection) {
    await connection
      .collection('events')
      .updateMany(
        { invitados: { $exists: false } },
        { $set: { invitados: 0 } },
      );
  },
};
