import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AccessControlSeedService } from '../profiles/access-control.seed.service';
import { InitialTenantSeedService } from '../tenants/initial-tenant.seed.service';
import { InitialAdminSeedService } from '../users/initial-admin.seed.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantResult = await app.get(InitialTenantSeedService).seed();
    const accessControlResult = await app
      .get(AccessControlSeedService)
      .seed(tenantResult.tenant.id);
    const adminResult = await app
      .get(InitialAdminSeedService)
      .seed(tenantResult.tenant.id);

    process.stdout.write(
      `Empresa creada: ${tenantResult.created}. Empresa existente: ${tenantResult.existing}.\n`,
    );
    process.stdout.write(
      `Permisos creados: ${accessControlResult.permissionsCreated}. Permisos existentes: ${accessControlResult.permissionsExisting}.\n`,
    );
    process.stdout.write(
      `Perfiles creados: ${accessControlResult.profilesCreated}. Perfiles existentes: ${accessControlResult.profilesExisting}.\n`,
    );
    process.stdout.write(
      `Administrador creado: ${adminResult.created}. Administrador existente: ${adminResult.existing}. Administrador migrado: ${adminResult.migrated}.\n`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
