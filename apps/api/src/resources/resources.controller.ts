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
import { CreateResourceDto } from './dto/create-resource.dto';
import { FindResourcesDto } from './dto/find-resources.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @RequirePermissions('recursos.crear')
  async create(
    @Body() createResourceDto: CreateResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.create(createResourceDto, user),
      message: 'Recurso creado correctamente.',
    };
  }

  @Get()
  @RequirePermissions('recursos.ver')
  async findAll(
    @Query() query: FindResourcesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.findAll(query, user),
      message: 'Recursos obtenidos correctamente.',
    };
  }

  @Get(':id')
  @RequirePermissions('recursos.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.findOne(id, user),
      message: 'Recurso obtenido correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('recursos.editar')
  async update(
    @Param('id') id: string,
    @Body() updateResourceDto: UpdateResourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.update(id, updateResourceDto, user),
      message: 'Recurso actualizado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('recursos.eliminar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.resourcesService.deactivate(id, user),
      message: 'Recurso desactivado correctamente.',
    };
  }
}
