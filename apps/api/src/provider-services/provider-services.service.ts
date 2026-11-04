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
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import { Event } from '../events/schemas/event.schema';
import {
  Provider,
  type ProviderDocument,
} from '../providers/schemas/provider.schema';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { FindProviderServicesDto } from './dto/find-provider-services.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import {
  EventProviderService,
  type EventProviderServiceDocument,
} from './schemas/event-provider-service.schema';

@Injectable()
export class ProviderServicesService {
  constructor(
    @InjectModel(EventProviderService.name)
    private readonly serviceModel: Model<EventProviderService>,
    @InjectModel(Provider.name) private readonly providerModel: Model<Provider>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    private readonly budgetLedger: BudgetLedgerService,
    private readonly auditsService: AuditsService,
  ) {}

  async findAll(
    eventId: string,
    query: FindProviderServicesDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);
    const services = await this.serviceModel
      .find({
        tenantId,
        eventId,
        ...(query.includeCancelled ? {} : { status: 'confirmado' }),
      })
      .sort({ startDate: 1, startTime: 1, _id: 1 })
      .lean();
    const providers = await this.providerModel
      .find({
        tenantId,
        _id: { $in: services.map((service) => service.providerId) },
      })
      .lean();
    const providerById = new Map(
      providers.map((provider) => [provider._id.toString(), provider]),
    );
    return services.flatMap((service) => {
      const provider = providerById.get(service.providerId.toString());
      return provider ? [this.toResponse(service, provider)] : [];
    });
  }

  async create(
    eventId: string,
    dto: CreateProviderServiceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);
    if (event.status === 'cancelado') {
      throw new ConflictException(
        'No puedes asignar servicios a un evento cancelado.',
      );
    }
    const provider = await this.findProvider(dto.providerId, tenantId);
    if (provider.status !== 'activo') {
      throw new ConflictException(
        'No puedes seleccionar un proveedor inactivo.',
      );
    }
    const serviceName = dto.serviceName.trim();
    this.validateServiceName(serviceName);
    this.validateDates(dto.startDate, dto.startTime, dto.endDate, dto.endTime);
    await this.budgetLedger.reserveProviderCost(
      tenantId,
      eventId,
      dto.agreedAmountCop,
    );
    let service: EventProviderServiceDocument;
    try {
      service = await this.serviceModel.create({
        tenantId,
        eventId,
        providerId: dto.providerId,
        serviceName,
        description: this.trimOptional(dto.description),
        startDate: dto.startDate,
        startTime: dto.startTime ?? null,
        endDate: dto.endDate ?? null,
        endTime: dto.endTime ?? null,
        agreedAmountCop: dto.agreedAmountCop,
        status: 'confirmado',
        assignedBy: user.id,
        cancelledAt: null,
      });
    } catch (error) {
      await this.budgetLedger.releaseProviderCost(
        tenantId,
        eventId,
        dto.agreedAmountCop,
      );
      throw error;
    }
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'servicios_proveedor',
      action: 'crear',
      entity: 'servicio_proveedor',
      entityId: service._id,
      description: `Asignó el servicio ${service.serviceName} de ${provider.name} al evento.`,
    });
    return this.toResponse(service, provider);
  }

  async update(
    eventId: string,
    id: string,
    dto: UpdateProviderServiceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);
    if (event.status === 'cancelado') {
      throw new ConflictException(
        'No puedes editar servicios de un evento cancelado.',
      );
    }
    const existing = await this.findService(eventId, id, tenantId);
    if (existing.status === 'cancelado') {
      throw new ConflictException('No puedes editar un servicio cancelado.');
    }

    const providerId = dto.providerId ?? existing.providerId.toString();
    const provider = await this.findProvider(providerId, tenantId);
    if (
      providerId !== existing.providerId.toString() &&
      provider.status !== 'activo'
    ) {
      throw new ConflictException(
        'No puedes seleccionar un proveedor inactivo.',
      );
    }
    const serviceName =
      dto.serviceName === undefined
        ? existing.serviceName
        : dto.serviceName.trim();
    this.validateServiceName(serviceName);
    const startDate = dto.startDate ?? existing.startDate;
    const startTime =
      dto.startTime === undefined ? existing.startTime : dto.startTime;
    const endDate = dto.endDate === undefined ? existing.endDate : dto.endDate;
    const endTime = dto.endTime === undefined ? existing.endTime : dto.endTime;
    this.validateDates(startDate, startTime, endDate, endTime);

    const agreedAmountCop = dto.agreedAmountCop ?? existing.agreedAmountCop;
    const increase = Math.max(0, agreedAmountCop - existing.agreedAmountCop);
    const decrease = Math.max(0, existing.agreedAmountCop - agreedAmountCop);
    await this.budgetLedger.reserveProviderCost(tenantId, eventId, increase);
    let service: EventProviderServiceDocument | null;
    try {
      service = await this.serviceModel.findOneAndUpdate(
        {
          _id: id,
          tenantId,
          eventId,
          status: 'confirmado',
          agreedAmountCop: existing.agreedAmountCop,
        },
        {
          $set: {
            providerId,
            serviceName,
            description:
              dto.description === undefined
                ? existing.description
                : this.trimOptional(dto.description),
            startDate,
            startTime: startTime ?? null,
            endDate: endDate ?? null,
            endTime: endTime ?? null,
            agreedAmountCop,
          },
        },
        { new: true, runValidators: true },
      );
      if (!service)
        throw new ConflictException('El servicio ya no está confirmado.');
    } catch (error) {
      await this.budgetLedger.releaseProviderCost(tenantId, eventId, increase);
      throw error;
    }
    if (decrease > 0) {
      await this.budgetLedger.releaseProviderCost(tenantId, eventId, decrease);
    }
    if (!service)
      throw new ConflictException('El servicio ya no está confirmado.');
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'servicios_proveedor',
      action: 'editar',
      entity: 'servicio_proveedor',
      entityId: service._id,
      description: `Editó el servicio ${service.serviceName} de ${provider.name}.`,
    });
    return this.toResponse(service, provider);
  }

  async cancel(eventId: string, id: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);
    await this.findService(eventId, id, tenantId);
    const service = await this.serviceModel.findOneAndUpdate(
      { _id: id, tenantId, eventId, status: 'confirmado' },
      { $set: { status: 'cancelado', cancelledAt: new Date() } },
      { new: true },
    );
    if (!service) throw new ConflictException('El servicio ya está cancelado.');
    if (await this.budgetLedger.hasBudget(tenantId, eventId)) {
      try {
        await this.budgetLedger.releaseProviderCost(
          tenantId,
          eventId,
          service.agreedAmountCop,
        );
      } catch (error) {
        await this.serviceModel.updateOne(
          { _id: service._id, tenantId, eventId, status: 'cancelado' },
          { $set: { status: 'confirmado', cancelledAt: null } },
        );
        throw error;
      }
    }
    const provider = await this.findProvider(
      service.providerId.toString(),
      tenantId,
    );
    await this.auditsService.record({
      tenantId,
      actor: user,
      module: 'servicios_proveedor',
      action: 'cancelar',
      entity: 'servicio_proveedor',
      entityId: service._id,
      description: `Canceló el servicio ${service.serviceName} de ${provider.name}.`,
    });
    return this.toResponse(service, provider);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }
    return user.tenantId;
  }

  private async findEvent(eventId: string, tenantId: string) {
    if (!isValidObjectId(eventId)) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }
    const event = await this.eventModel.findOne({ _id: eventId, tenantId });
    if (!event) throw new NotFoundException('El evento no existe.');
    return event;
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

  private async findService(
    eventId: string,
    id: string,
    tenantId: string,
  ): Promise<EventProviderServiceDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del servicio no es válido.',
      );
    }
    const service = await this.serviceModel.findOne({
      _id: id,
      eventId,
      tenantId,
    });
    if (!service)
      throw new NotFoundException('El servicio no existe en este evento.');
    return service;
  }

  private validateServiceName(name: string): void {
    if (name.length < 2) {
      throw new BadRequestException(
        'El nombre del servicio debe tener al menos dos caracteres.',
      );
    }
  }

  private validateDates(
    startDate: string,
    startTime?: string | null,
    endDate?: string | null,
    endTime?: string | null,
  ): void {
    if (
      !this.isCalendarDate(startDate) ||
      (endDate && !this.isCalendarDate(endDate))
    ) {
      throw new BadRequestException(
        'Indica fechas de calendario válidas en formato YYYY-MM-DD.',
      );
    }
    if (endTime && !endDate) {
      throw new BadRequestException(
        'Indica una fecha de fin si informas una hora de fin.',
      );
    }
    if (
      endDate &&
      (endDate < startDate ||
        (endDate === startDate && startTime && endTime && endTime < startTime))
    ) {
      throw new BadRequestException('El fin no puede ser anterior al inicio.');
    }
  }

  private isCalendarDate(value: string): boolean {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private toResponse(
    service:
      | EventProviderServiceDocument
      | (EventProviderService & { _id: Types.ObjectId }),
    provider: ProviderDocument | (Provider & { _id: Types.ObjectId }),
  ) {
    return {
      id: service._id.toString(),
      eventId: service.eventId.toString(),
      providerId: service.providerId.toString(),
      provider: {
        id: provider._id.toString(),
        name: provider.name,
        categoryKeys: provider.categoryKeys,
        status: provider.status,
      },
      serviceName: service.serviceName,
      description: service.description,
      startDate: service.startDate,
      startTime: service.startTime,
      endDate: service.endDate,
      endTime: service.endTime,
      agreedAmountCop: service.agreedAmountCop,
      status: service.status,
      assignedBy: service.assignedBy.toString(),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      cancelledAt: service.cancelledAt,
    };
  }
}
