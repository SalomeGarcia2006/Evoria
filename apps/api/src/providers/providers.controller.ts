import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateProviderDto } from './dto/create-provider.dto';
import { FindProvidersDto } from './dto/find-providers.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ProvidersService } from './providers.service';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @RequirePermissions('proveedores.ver')
  async findAll(
    @Query() query: FindProvidersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.providersService.findAll(query, user),
      message: 'Proveedores obtenidos correctamente.',
    };
  }

  @Post()
  @RequirePermissions('proveedores.crear')
  async create(
    @Body() dto: CreateProviderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.providersService.create(dto, user),
      message: 'Proveedor creado correctamente.',
    };
  }

  @Get(':id')
  @RequirePermissions('proveedores.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.providersService.findOne(id, user),
      message: 'Proveedor obtenido correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('proveedores.editar')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.providersService.update(id, dto, user),
      message: 'Proveedor actualizado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('proveedores.desactivar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.providersService.deactivate(id, user),
      message: 'Proveedor desactivado correctamente.',
    };
  }
}
