import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AccessControlSeedService } from '../profiles/access-control.seed.service';
import { InitialAdminSeedService } from '../users/initial-admin.seed.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const accessControlResult = await app.get(AccessControlSeedService).seed();
    const adminResult = await app.get(InitialAdminSeedService).seed();
    process.stdout.write(
      `Permisos creados: ${accessControlResult.permissionsCreated}. Permisos existentes: ${accessControlResult.permissionsExisting}.\n`,
    );
    process.stdout.write(
      `Perfiles creados: ${accessControlResult.profilesCreated}. Perfiles existentes: ${accessControlResult.profilesExisting}.\n`,
    );
    process.stdout.write(
      `Desarrollador creado: ${adminResult.created}. Desarrollador existente: ${adminResult.existing}. Desarrollador migrado: ${adminResult.migrated}.\n`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
