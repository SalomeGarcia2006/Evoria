import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type Types } from 'mongoose';
import { Membership } from '../memberships/schemas/membership.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateEventDto } from './dto/create-event.dto';
import { FindEventsDto } from './dto/find-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event, type EventDocument } from './schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
  ) {}

  async create(createEventDto: CreateEventDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    await this.validateResponsible(createEventDto.responsibleUserId, tenantId);
    this.validateDates(createEventDto.startAt, createEventDto.endAt);

    const event = await this.eventModel.create({
      tenantId,
      createdBy: user.id,
      name: createEventDto.name.trim(),
      description: this.trimOptional(createEventDto.description),
      startAt: new Date(createEventDto.startAt),
      endAt: new Date(createEventDto.endAt),
      location: this.trimOptional(createEventDto.location),
      type: this.trimOptional(createEventDto.type),
      status: createEventDto.status,
      responsibleUserId: createEventDto.responsibleUserId ?? null,
    });

    return this.toResponse(event);
  }

  async findAll(query: FindEventsDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    this.validateDates(query.from, query.to);
    const filter = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { startAt: { $gte: new Date(query.from) } } : {}),
      ...(query.to ? { endAt: { $lte: new Date(query.to) } } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [events, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startAt: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      items: events.map((event) => this.toResponse(event)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    return this.toResponse(await this.findEvent(id, this.getTenantId(user)));
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(id, tenantId);

    if (event.status === 'cancelado') {
      throw new ConflictException('No puedes editar un evento cancelado.');
    }

    const startAt = updateEventDto.startAt ?? event.startAt.toISOString();
    const endAt = updateEventDto.endAt ?? event.endAt.toISOString();
    this.validateDates(startAt, endAt);

    if (updateEventDto.responsibleUserId !== undefined) {
      await this.validateResponsible(
        updateEventDto.responsibleUserId,
        tenantId,
      );
      event.set('responsibleUserId', updateEventDto.responsibleUserId ?? null);
    }

    if (updateEventDto.name !== undefined)
      event.name = updateEventDto.name.trim();
    if (updateEventDto.description !== undefined) {
      event.description = this.trimOptional(updateEventDto.description);
    }
    if (updateEventDto.location !== undefined) {
      event.location = this.trimOptional(updateEventDto.location);
    }
    if (updateEventDto.type !== undefined) {
      event.type = this.trimOptional(updateEventDto.type);
    }
    if (updateEventDto.startAt)
      event.startAt = new Date(updateEventDto.startAt);
    if (updateEventDto.endAt) event.endAt = new Date(updateEventDto.endAt);
    if (updateEventDto.status) event.status = updateEventDto.status;

    await event.save();
    return this.toResponse(event);
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const event = await this.findEvent(id, this.getTenantId(user));
    event.status = 'cancelado';
    await event.save();

    return this.toResponse(event);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }

    return user.tenantId;
  }

  private async findEvent(
    id: string,
    tenantId: string,
  ): Promise<EventDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }

    const event = await this.eventModel.findOne({ _id: id, tenantId });

    if (!event) {
      throw new NotFoundException('El evento no existe.');
    }

    return event;
  }

  private async validateResponsible(
    responsibleUserId: string | null | undefined,
    tenantId: string,
  ): Promise<void> {
    if (!responsibleUserId) return;

    const membership = await this.membershipModel.exists({
      userId: responsibleUserId,
      tenantId,
      status: 'activo',
    });

    if (!membership) {
      throw new BadRequestException(
        'El responsable debe pertenecer a la empresa activa.',
      );
    }
  }

  private validateDates(startAt?: string, endAt?: string): void {
    if (!startAt || !endAt) return;

    if (new Date(endAt) < new Date(startAt)) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private toResponse(event: EventDocument | (Event & { _id: Types.ObjectId })) {
    return {
      id: event._id.toString(),
      name: event.name,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
      type: event.type,
      status: event.status,
      responsibleUserId: event.responsibleUserId?.toString() ?? null,
      createdBy: event.createdBy.toString(),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
