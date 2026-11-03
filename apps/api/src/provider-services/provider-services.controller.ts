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
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { FindProviderServicesDto } from './dto/find-provider-services.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import { ProviderServicesService } from './provider-services.service';

@Controller('events/:eventId/provider-services')
export class ProviderServicesController {
  constructor(private readonly service: ProviderServicesService) {}

  @Get()
  @RequirePermissions('servicios_proveedor.ver')
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: FindProviderServicesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.service.findAll(eventId, query, user),
      message: 'Servicios de proveedores obtenidos correctamente.',
    };
  }

  @Post()
  @RequirePermissions('servicios_proveedor.crear', 'proveedores.ver')
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateProviderServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.service.create(eventId, dto, user),
      message: 'Servicio de proveedor asignado correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('servicios_proveedor.editar')
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProviderServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.service.update(eventId, id, dto, user),
      message: 'Servicio de proveedor actualizado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('servicios_proveedor.cancelar')
  async cancel(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.service.cancel(eventId, id, user),
      message: 'Servicio de proveedor cancelado correctamente.',
    };
  }
}
