import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RolesSeedService } from '../roles/roles.seed.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const seedResult = await app.get(RolesSeedService).seed();
    process.stdout.write(
      `Roles creados: ${seedResult.created}. Roles existentes: ${seedResult.existing}.\n`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
