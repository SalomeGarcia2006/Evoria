import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { FindInventoryItemsDto } from './dto/find-inventory-items.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import {
  InventoryItem,
  type InventoryItemDocument,
} from './schemas/inventory-item.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItem>,
  ) {}

  async create(dto: CreateInventoryItemDto, user: AuthenticatedUser) {
    const status = dto.status ?? 'disponible';
    const item = await this.inventoryModel.create({
      tenantId: this.getTenantId(user),
      name: dto.name.trim(),
      type: dto.type.trim(),
      description: this.trimOptional(dto.description),
      unitCost: dto.unitCost,
      totalQuantity: dto.totalQuantity,
      availableQuantity: status === 'disponible' ? dto.totalQuantity : 0,
      reservedQuantity: 0,
      status,
    });

    return this.toResponse(item);
  }

  async findAll(query: FindInventoryItemsDto, user: AuthenticatedUser) {
    const filter: {
      tenantId: string;
      status?: InventoryItem['status'] | { $ne: InventoryItem['status'] };
      type?: RegExp;
      $or?: Array<{ name: RegExp } | { type: RegExp }>;
    } = {
      tenantId: this.getTenantId(user),
      ...(query.status
        ? { status: query.status }
        : { status: { $ne: 'inactivo' } }),
    };

    if (query.type?.trim()) {
      filter.type = new RegExp(
        `^${this.escapeRegExp(query.type.trim())}$`,
        'i',
      );
    }
    if (query.search?.trim()) {
      const search = new RegExp(this.escapeRegExp(query.search.trim()), 'i');
      filter.$or = [{ name: search }, { type: search }];
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.inventoryModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      this.inventoryModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    return this.toResponse(await this.findItem(id, this.getTenantId(user)));
  }

  async update(
    id: string,
    dto: UpdateInventoryItemDto,
    user: AuthenticatedUser,
  ) {
    const item = await this.findItem(id, this.getTenantId(user));

    if (item.status === 'inactivo') {
      throw new ConflictException(
        'No puedes ajustar un ítem de inventario inactivo.',
      );
    }
    if (
      dto.totalQuantity !== undefined &&
      dto.totalQuantity < item.reservedQuantity
    ) {
      throw new BadRequestException(
        'La cantidad total no puede ser menor que la cantidad reservada.',
      );
    }
    if (
      dto.status !== undefined &&
      dto.status !== 'disponible' &&
      item.reservedQuantity > 0
    ) {
      throw new ConflictException(
        'No puedes cambiar el estado mientras existan asignaciones activas.',
      );
    }

    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.type !== undefined) item.type = dto.type.trim();
    if (dto.description !== undefined)
      item.description = this.trimOptional(dto.description);
    if (dto.unitCost !== undefined) item.unitCost = dto.unitCost;
    if (dto.totalQuantity !== undefined) item.totalQuantity = dto.totalQuantity;
    if (dto.status !== undefined) item.status = dto.status;

    item.availableQuantity =
      item.status === 'disponible'
        ? item.totalQuantity - item.reservedQuantity
        : 0;

    await item.save();
    return this.toResponse(item);
  }

  async deactivate(id: string, user: AuthenticatedUser) {
    const item = await this.findItem(id, this.getTenantId(user));
    if (item.reservedQuantity > 0) {
      throw new ConflictException(
        'No puedes desactivar un ítem con asignaciones activas.',
      );
    }

    item.status = 'inactivo';
    item.availableQuantity = 0;
    await item.save();
    return this.toResponse(item);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }
    return user.tenantId;
  }

  private async findItem(
    id: string,
    tenantId: string,
  ): Promise<InventoryItemDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del inventario no es válido.',
      );
    }

    const item = await this.inventoryModel.findOne({ _id: id, tenantId });
    if (!item) throw new NotFoundException('El ítem de inventario no existe.');
    return item;
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toResponse(
    item: InventoryItemDocument | (InventoryItem & { _id: Types.ObjectId }),
  ) {
    return {
      id: item._id.toString(),
      name: item.name,
      type: item.type,
      description: item.description,
      unitCost: item.unitCost,
      totalQuantity: item.totalQuantity,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
