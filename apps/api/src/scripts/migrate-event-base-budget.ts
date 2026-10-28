import { getModelToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Event } from '../events/schemas/event.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const eventModel = app.get<Model<Event>>(getModelToken(Event.name));
    const result = await eventModel.updateMany(
      { baseBudget: { $exists: false } },
      { $set: { baseBudget: 0 } },
    );

    process.stdout.write(
      `Eventos migrados: ${result.modifiedCount}. Eventos sin cambios: ${result.matchedCount - result.modifiedCount}.\n`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
