import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DeveloperOnly } from '../auth/decorators/developer-only.decorator';
import { PlatformOnly } from '../auth/decorators/platform-only.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantContextDto } from './dto/update-tenant-context.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @PlatformOnly()
  @DeveloperOnly()
  @RequirePermissions('empresas.ver')
  async findAll() {
    return {
      data: await this.tenantsService.findAll(),
      message: 'Empresas obtenidas correctamente.',
    };
  }

  @Post()
  @PlatformOnly()
  @DeveloperOnly()
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

  @Get('context')
  @RequirePermissions('empresa_contexto.ver')
  async context(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.tenantsService.context(user),
      message: 'Contexto operativo obtenido correctamente.',
    };
  }

  @Patch('context')
  @RequirePermissions('empresa_contexto.editar')
  async updateContext(
    @Body() dto: UpdateTenantContextDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.tenantsService.updateContext(dto, user),
      message: 'Contexto operativo actualizado correctamente.',
    };
  }

  @Delete(':id')
  @PlatformOnly()
  @DeveloperOnly()
  @RequirePermissions('empresas.desactivar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() developer: AuthenticatedUser,
  ) {
    return {
      data: await this.tenantsService.deactivate(id, developer),
      message: 'Empresa desactivada correctamente.',
    };
  }
}
