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
import { CreateResourceDto } from './dto/create-resource.dto';
import { FindResourcesDto } from './dto/find-resources.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Resource, type ResourceDocument } from './schemas/resource.schema';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name) private readonly resourceModel: Model<Resource>,
  ) {}

  async create(createResourceDto: CreateResourceDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const resource = await this.resourceModel.create({
      tenantId,
      name: createResourceDto.name.trim(),
      type: createResourceDto.type.trim(),
      description: this.trimOptional(createResourceDto.description),
      unitCost: createResourceDto.unitCost,
      totalQuantity: createResourceDto.totalQuantity,
      availableQuantity: createResourceDto.totalQuantity,
      reservedQuantity: 0,
      status: createResourceDto.status ?? 'disponible',
    });

    return this.toResponse(resource);
  }

  async findAll(query: FindResourcesDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const filter: {
      tenantId: string;
      status?: Resource['status'] | { $ne: Resource['status'] };
      type?: RegExp;
      $or?: Array<{ name: RegExp } | { type: RegExp }>;
    } = {
      tenantId,
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
    const [resources, total] = await Promise.all([
      this.resourceModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      this.resourceModel.countDocuments(filter),
    ]);

    return {
      items: resources.map((resource) => this.toResponse(resource)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    return this.toResponse(await this.findResource(id, this.getTenantId(user)));
  }

  async update(
    id: string,
    updateResourceDto: UpdateResourceDto,
    user: AuthenticatedUser,
  ) {
    const resource = await this.findResource(id, this.getTenantId(user));

    if (resource.status === 'inactivo') {
      throw new ConflictException('No puedes editar un recurso inactivo.');
    }

    if (
      updateResourceDto.totalQuantity !== undefined &&
      updateResourceDto.totalQuantity < resource.reservedQuantity
    ) {
      throw new BadRequestException(
        'La cantidad total no puede ser menor que la cantidad reservada.',
      );
    }

    if (updateResourceDto.name !== undefined)
      resource.name = updateResourceDto.name.trim();
    if (updateResourceDto.type !== undefined)
      resource.type = updateResourceDto.type.trim();
    if (updateResourceDto.description !== undefined) {
      resource.description = this.trimOptional(updateResourceDto.description);
    }
    if (updateResourceDto.unitCost !== undefined) {
      resource.unitCost = updateResourceDto.unitCost;
    }
    if (updateResourceDto.totalQuantity !== undefined) {
      resource.totalQuantity = updateResourceDto.totalQuantity;
      resource.availableQuantity =
        updateResourceDto.totalQuantity - resource.reservedQuantity;
    }
    if (updateResourceDto.status !== undefined) {
      resource.status = updateResourceDto.status;
    }

    await resource.save();
    return this.toResponse(resource);
  }

  async deactivate(id: string, user: AuthenticatedUser) {
    const resource = await this.findResource(id, this.getTenantId(user));

    if (resource.reservedQuantity > 0) {
      throw new ConflictException(
        'No puedes desactivar un recurso con unidades reservadas.',
      );
    }

    resource.status = 'inactivo';
    await resource.save();

    return this.toResponse(resource);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }

    return user.tenantId;
  }

  private async findResource(
    id: string,
    tenantId: string,
  ): Promise<ResourceDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del recurso no es válido.',
      );
    }

    const resource = await this.resourceModel.findOne({ _id: id, tenantId });

    if (!resource) {
      throw new NotFoundException('El recurso no existe.');
    }

    return resource;
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toResponse(
    resource: ResourceDocument | (Resource & { _id: Types.ObjectId }),
  ) {
    return {
      id: resource._id.toString(),
      name: resource.name,
      type: resource.type,
      description: resource.description,
      unitCost: resource.unitCost,
      totalQuantity: resource.totalQuantity,
      availableQuantity: resource.availableQuantity,
      reservedQuantity: resource.reservedQuantity,
      status: resource.status,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    };
  }
}
