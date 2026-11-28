import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ProviderServiceWorkflow } from './provider-service-workflow.service';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditsService } from '../audits/audits.service';
import { BudgetLedgerService } from '../budgets/budget-ledger.service';
import { AlertsService } from '../alerts/alerts.service';
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
    @Optional() private readonly alerts?: AlertsService,
    @Optional() private readonly workflow?: ProviderServiceWorkflow,
  ) {}

  async findAll(
    eventId: string,
    query: FindProviderServicesDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);
    if (process.env.VERCEL === '1' && this.workflow)
      await this.workflow.reconcileDue(eventId, tenantId);
    const services = await this.serviceModel
      .find({
        tenantId,
        eventId,
        ...(query.status
          ? { status: query.status }
          : query.includeCancelled
            ? {}
            : {
                $or: [
                  { status: 'confirmado' },
                  {
                    status: 'pendiente',
                    responseExpiresAt: { $gt: new Date() },
                  },
                  {
                    status: 'aceptado_sin_saldo',
                    fundingExpiresAt: { $gt: new Date() },
                  },
                ],
              }),
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
    if (!this.workflow)
      throw new ConflictException(
        'El flujo de confirmación no está disponible.',
      );
    const service = await this.workflow.request(eventId, dto, user);
    return this.toResponse(service, provider);
  }

  async update(
    eventId: string,
    id: string,
    _dto: UpdateProviderServiceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);
    await this.findService(eventId, id, tenantId);
    throw new ConflictException(
      'No se pueden editar servicios. Cancela el servicio y crea una nueva solicitud.',
    );
  }

  async cancel(eventId: string, id: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);
    const existing = await this.findService(eventId, id, tenantId);
    const provider = await this.findProvider(
      existing.providerId.toString(),
      tenantId,
    );
    if (!this.workflow)
      throw new ConflictException(
        'El flujo de confirmación no está disponible.',
      );
    const service = await this.workflow.cancel(eventId, id, user);
    return this.toResponse(service, provider);
  }

  async resend(eventId: string, id: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);
    const existing = await this.findService(eventId, id, tenantId);
    const provider = await this.findProvider(
      existing.providerId.toString(),
      tenantId,
    );
    if (!this.workflow)
      throw new ConflictException(
        'El flujo de confirmación no está disponible.',
      );
    return this.toResponse(
      await this.workflow.resend(eventId, id, user),
      provider,
    );
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
      responseExpiresAt: service.responseExpiresAt ?? null,
      acceptedAt: service.acceptedAt ?? null,
      respondedAt: service.respondedAt ?? null,
      responseDecision: service.responseDecision ?? null,
      fundingExpiresAt: service.fundingExpiresAt ?? null,
      confirmedAt: service.confirmedAt ?? null,
      rejectionReason: service.rejectionReason ?? null,
      cancellationReason: service.cancellationReason ?? null,
      emailDelivery: service.confirmationVersion ? service.emailDelivery : null,
      emailSentAt: service.emailSentAt ?? null,
    };
  }
}
