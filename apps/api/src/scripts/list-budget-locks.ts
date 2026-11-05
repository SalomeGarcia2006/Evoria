import { getConnectionToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Types, type Connection } from 'mongoose';
import { listDecisionLocks } from '../budgets/recover-decision-lock';
import { BudgetLockMaintenanceModule } from './budget-lock-maintenance.module';

async function main(): Promise<void> {
  const tenantId = process.argv[2];
  if (!Types.ObjectId.isValid(tenantId))
    throw new Error('Uso: list-budget-locks <empresa-id>');
  const app = await NestFactory.createApplicationContext(
    BudgetLockMaintenanceModule,
  );
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const locks = await listDecisionLocks(connection, tenantId);
    process.stdout.write(`${JSON.stringify(locks, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void main();
