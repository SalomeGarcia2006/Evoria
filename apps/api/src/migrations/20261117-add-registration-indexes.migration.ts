import type { Migration } from './migration';

export const addRegistrationIndexesMigration: Migration = {
  id: '20261117-add-registration-indexes',
  async up(connection) {
    await connection.collection('tenants').createIndex(
      { emailDomain: 1 },
      {
        unique: true,
        partialFilterExpression: { emailDomain: { $type: 'string' } },
      },
    );
    await connection
      .collection('pending_registrations')
      .createIndex({ email: 1 }, { unique: true });
    await connection
      .collection('pending_registrations')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  },
};
