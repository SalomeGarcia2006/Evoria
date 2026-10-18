import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InitialTenantSeedService } from './initial-tenant.seed.service';
import { Tenant, TenantSchema } from './schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
  ],
  providers: [InitialTenantSeedService],
  exports: [InitialTenantSeedService, MongooseModule],
})
export class TenantsModule {}
