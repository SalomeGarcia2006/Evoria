import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AccessControlSeedService } from '../profiles/access-control.seed.service';
import { InitialTenantSeedService } from '../tenants/initial-tenant.seed.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantResult = await app.get(InitialTenantSeedService).seed();
    const result = await app
      .get(AccessControlSeedService)
      .seed(tenantResult.tenant.id);

    process.stdout.write(
      `Permisos creados: ${result.permissionsCreated}. Permisos existentes: ${result.permissionsExisting}.\n`,
    );
    process.stdout.write(
      `Perfiles creados: ${result.profilesCreated}. Perfiles existentes: ${result.profilesExisting}.\n`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
