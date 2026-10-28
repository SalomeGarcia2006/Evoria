import { getConnectionToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import type { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { MIGRATIONS } from '../migrations/migrations';

async function bootstrap(): Promise<void> {
  const migrationIds = MIGRATIONS.map((migration) => migration.id);

  if (new Set(migrationIds).size !== migrationIds.length) {
    throw new Error('Las migraciones deben tener identificadores únicos.');
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const migrations = connection.collection('migrations');

    await migrations.createIndex({ id: 1 }, { unique: true });

    const appliedIds = new Set(
      (await migrations.distinct('id')).filter(
        (id): id is string => typeof id === 'string',
      ),
    );
    let applied = 0;

    for (const migration of MIGRATIONS) {
      if (appliedIds.has(migration.id)) continue;

      await migration.up(connection);
      await migrations.insertOne({ id: migration.id, appliedAt: new Date() });
      applied += 1;
    }

    process.stdout.write(`Migraciones aplicadas: ${applied}.\n`);
  } finally {
    await app.close();
  }
}

void bootstrap();
