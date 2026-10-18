import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlatformOnly } from '../auth/decorators/platform-only.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @PlatformOnly()
  async create(
    @Body() createTenantDto: CreateTenantDto,
    @CurrentUser() developer: AuthenticatedUser,
  ) {
    // shortcut: tenants.crear se aplicará al definir el catálogo fijo de permisos.
    return {
      data: await this.tenantsService.create(createTenantDto, developer),
      message: 'Empresa creada correctamente.',
    };
  }
}
