import type { Migration } from './migration';

export const addEventBaseBudgetMigration: Migration = {
  id: '20261028-add-event-base-budget',
  async up(connection) {
    await connection
      .collection('events')
      .updateMany(
        { baseBudget: { $exists: false } },
        { $set: { baseBudget: 0 } },
      );
  },
};
