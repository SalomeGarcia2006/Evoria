import { getConnectionToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Types, type Connection } from 'mongoose';
import { BudgetLockMaintenanceModule } from './budget-lock-maintenance.module';
import { recoverDecisionLock } from '../budgets/recover-decision-lock';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [tenantId, eventId, token, confirmation] = args;
  if (
    !Types.ObjectId.isValid(tenantId) ||
    !Types.ObjectId.isValid(eventId) ||
    !Types.ObjectId.isValid(token) ||
    confirmation !== '--confirm-all-api-instances-stopped'
  ) {
    throw new Error(
      'Uso: recover-budget-lock <empresa-id> <evento-id> <token-actual> --confirm-all-api-instances-stopped',
    );
  }
  const app = await NestFactory.createApplicationContext(
    BudgetLockMaintenanceModule,
  );
  try {
    const connection = app.get<Connection>(getConnectionToken());
    await recoverDecisionLock(connection, tenantId, eventId, token);
    process.stdout.write('Bloqueo recuperado.\n');
  } finally {
    await app.close();
  }
}

void main();
