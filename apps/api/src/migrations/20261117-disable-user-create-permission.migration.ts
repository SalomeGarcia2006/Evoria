import type { Migration } from './migration';

export const disableUserCreatePermissionMigration: Migration = {
  id: '20261117-disable-user-create-permission',
  async up(connection) {
    await connection
      .collection('permissions')
      .updateMany({ key: 'usuarios.crear' }, { $set: { status: 'inactivo' } });
  },
};
