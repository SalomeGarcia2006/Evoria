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
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { FindInventoryItemsDto } from './dto/find-inventory-items.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @RequirePermissions('inventario.ajustar')
  async create(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.inventoryService.create(dto, user),
      message: 'Ítem de inventario creado correctamente.',
    };
  }

  @Get()
  @RequirePermissions('inventario.ver')
  async findAll(
    @Query() query: FindInventoryItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.inventoryService.findAll(query, user),
      message: 'Inventario obtenido correctamente.',
    };
  }

  @Get(':id')
  @RequirePermissions('inventario.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.inventoryService.findOne(id, user),
      message: 'Ítem de inventario obtenido correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('inventario.ajustar')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.inventoryService.update(id, dto, user),
      message: 'Inventario ajustado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('inventario.ajustar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.inventoryService.deactivate(id, user),
      message: 'Ítem de inventario desactivado correctamente.',
    };
  }
}
