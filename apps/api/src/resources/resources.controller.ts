import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateEventResourceDto } from './dto/create-event-resource.dto';
import { ResourcesService } from './resources.service';

@Controller('events/:eventId/resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @RequirePermissions('asignaciones.ver')
  async findAll(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.findAll(eventId, user),
      message: 'Recursos asignados obtenidos correctamente.',
    };
  }

  @Post()
  @RequirePermissions('asignaciones.crear')
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.assign(eventId, dto, user),
      message: 'Recurso de inventario asignado correctamente.',
    };
  }

  @Delete(':inventoryItemId')
  @RequirePermissions('asignaciones.eliminar')
  async release(
    @Param('eventId') eventId: string,
    @Param('inventoryItemId') inventoryItemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.release(eventId, inventoryItemId, user),
      message: 'Recurso liberado correctamente.',
    };
  }
}
