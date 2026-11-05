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
import { AuditsService } from '../audits/audits.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { FindProvidersDto } from './dto/find-providers.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import type { ProviderCategory } from './providers.constants';
import { Provider, type ProviderDocument } from './schemas/provider.schema';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    private readonly auditsService: AuditsService,
  ) {}

  async create(dto: CreateProviderDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const name = dto.name.trim();
    this.validateName(name);
    const phone = this.trimOptional(dto.phone);
    const email = this.trimOptional(dto.email)?.toLowerCase() ?? null;
    this.validateContact(phone, email);

    const provider = await this.providerModel.create({
      tenantId,
      name,
      categoryKeys: dto.categoryKeys,
      contactName: this.trimOptional(dto.contactName),
      phone,
      email,
      location: this.trimOptional(dto.location),
      notes: this.trimOptional(dto.notes),
      status: 'activo',
      createdBy: user.id,
    });
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'proveedores',
      action: 'crear',
      entity: 'proveedor',
      entityId: provider._id,
      description: `Creó el proveedor ${provider.name}.`,
    });
    return this.toResponse(provider);
  }

  async findAll(query: FindProvidersDto, user: AuthenticatedUser) {
    const filter: {
      tenantId: string;
      categoryKeys?: ProviderCategory;
      status?: Provider['status'];
      $or?: Array<{ name: RegExp } | { contactName: RegExp }>;
    } = { tenantId: this.getTenantId(user) };
    if (query.category) filter.categoryKeys = query.category;
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const search = new RegExp(this.escapeRegExp(query.search.trim()), 'i');
      filter.$or = [{ name: search }, { contactName: search }];
    }

    const [items, total] = await Promise.all([
      this.providerModel
        .find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.providerModel.countDocuments(filter),
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
    return this.toResponse(await this.findProvider(id, this.getTenantId(user)));
  }

  async update(id: string, dto: UpdateProviderDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const provider = await this.findProvider(id, tenantId);
    if (provider.status === 'inactivo') {
      throw new ConflictException('No puedes editar un proveedor inactivo.');
    }

    const name = dto.name === undefined ? provider.name : dto.name.trim();
    this.validateName(name);
    const phone =
      dto.phone === undefined ? provider.phone : this.trimOptional(dto.phone);
    const email =
      dto.email === undefined
        ? provider.email
        : (this.trimOptional(dto.email)?.toLowerCase() ?? null);
    this.validateContact(phone, email);

    provider.name = name;
    provider.phone = phone;
    provider.email = email;
    if (dto.categoryKeys !== undefined)
      provider.categoryKeys = dto.categoryKeys;
    if (dto.contactName !== undefined)
      provider.contactName = this.trimOptional(dto.contactName);
    if (dto.location !== undefined)
      provider.location = this.trimOptional(dto.location);
    if (dto.notes !== undefined) provider.notes = this.trimOptional(dto.notes);

    await provider.save();
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'proveedores',
      action: 'editar',
      entity: 'proveedor',
      entityId: provider._id,
      description: `Actualizó el proveedor ${provider.name}.`,
    });
    return this.toResponse(provider);
  }

  async deactivate(id: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const provider = await this.findProvider(id, tenantId);
    if (provider.status === 'inactivo') {
      throw new ConflictException('El proveedor ya está inactivo.');
    }
    provider.status = 'inactivo';
    await provider.save();
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'proveedores',
      action: 'desactivar',
      entity: 'proveedor',
      entityId: provider._id,
      description: `Desactivó el proveedor ${provider.name}.`,
    });
    return this.toResponse(provider);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }
    return user.tenantId;
  }

  private async findProvider(
    id: string,
    tenantId: string,
  ): Promise<ProviderDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del proveedor no es válido.',
      );
    }
    const provider = await this.providerModel.findOne({ _id: id, tenantId });
    if (!provider) throw new NotFoundException('El proveedor no existe.');
    return provider;
  }

  private validateName(name: string): void {
    if (name.length < 2) {
      throw new BadRequestException(
        'El nombre debe tener al menos dos caracteres.',
      );
    }
  }

  private validateContact(phone: string | null, email: string | null): void {
    if (!phone && !email) {
      throw new BadRequestException(
        'Indica un teléfono o un correo del proveedor.',
      );
    }
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toResponse(
    provider: ProviderDocument | (Provider & { _id: Types.ObjectId }),
  ) {
    return {
      id: provider._id.toString(),
      name: provider.name,
      categoryKeys: provider.categoryKeys,
      contactName: provider.contactName,
      phone: provider.phone,
      email: provider.email,
      location: provider.location,
      notes: provider.notes,
      status: provider.status,
      createdBy: provider.createdBy.toString(),
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
