import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlatformOnly } from '../auth/decorators/platform-only.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @PlatformOnly()
  @RequirePermissions('empresas.crear')
  async create(
    @Body() createTenantDto: CreateTenantDto,
    @CurrentUser() developer: AuthenticatedUser,
  ) {
    return {
      data: await this.tenantsService.create(createTenantDto, developer),
      message: 'Empresa creada correctamente.',
    };
  }
}
