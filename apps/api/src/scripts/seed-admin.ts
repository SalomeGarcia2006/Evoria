import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RolesSeedService } from '../roles/roles.seed.service';
import { InitialAdminSeedService } from '../users/initial-admin.seed.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const rolesResult = await app.get(RolesSeedService).seed();
    const adminResult = await app.get(InitialAdminSeedService).seed();

    process.stdout.write(
      `Roles creados: ${rolesResult.created}. Roles existentes: ${rolesResult.existing}.\n`,
    );
    process.stdout.write(
      `Administrador creado: ${adminResult.created}. Administrador existente: ${adminResult.existing}.\n`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
