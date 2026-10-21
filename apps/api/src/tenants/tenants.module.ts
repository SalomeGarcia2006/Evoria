import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { TenantsController } from './tenants.controller';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { TenantsService } from './tenants.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
    MembershipsModule,
    ProfilesModule,
    UsersModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [MongooseModule, TenantsService],
})
export class TenantsModule {}
