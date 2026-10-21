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
import { Event, type EventDocument } from '../events/schemas/event.schema';
import { Membership } from '../memberships/schemas/membership.schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { FindSchedulesDto } from './dto/find-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Schedule, type ScheduleDocument } from './schemas/schedule.schema';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<Schedule>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
  ) {}

  async create(
    eventId: string,
    createScheduleDto: CreateScheduleDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);
    this.ensureEventIsEditable(event);
    await this.validateResponsible(
      createScheduleDto.responsibleUserId,
      tenantId,
    );
    this.validateDates(
      createScheduleDto.startAt,
      createScheduleDto.endAt,
      event,
    );

    const schedule = await this.scheduleModel.create({
      tenantId,
      eventId: event.id,
      responsibleUserId: createScheduleDto.responsibleUserId ?? null,
      name: createScheduleDto.name.trim(),
      description: this.trimOptional(createScheduleDto.description),
      startAt: new Date(createScheduleDto.startAt),
      endAt: new Date(createScheduleDto.endAt),
      status: createScheduleDto.status,
    });

    return this.toResponse(schedule);
  }

  async findAll(
    eventId: string,
    query: FindSchedulesDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);
    const schedules = await this.scheduleModel
      .find({
        tenantId,
        eventId: event.id,
        ...(query.status ? { status: query.status } : {}),
      })
      .sort({ startAt: 1 })
      .lean();

    return schedules.map((schedule) => this.toResponse(schedule));
  }

  async update(
    id: string,
    updateScheduleDto: UpdateScheduleDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const schedule = await this.findSchedule(id, tenantId);
    const event = await this.findEvent(schedule.eventId.toString(), tenantId);
    this.ensureEventIsEditable(event);
    this.ensureScheduleIsEditable(schedule);

    const startAt = updateScheduleDto.startAt ?? schedule.startAt.toISOString();
    const endAt = updateScheduleDto.endAt ?? schedule.endAt.toISOString();
    this.validateDates(startAt, endAt, event);

    if (updateScheduleDto.responsibleUserId !== undefined) {
      await this.validateResponsible(
        updateScheduleDto.responsibleUserId,
        tenantId,
      );
      schedule.set(
        'responsibleUserId',
        updateScheduleDto.responsibleUserId ?? null,
      );
    }

    if (updateScheduleDto.name !== undefined) {
      schedule.name = updateScheduleDto.name.trim();
    }
    if (updateScheduleDto.description !== undefined) {
      schedule.description = this.trimOptional(updateScheduleDto.description);
    }
    if (updateScheduleDto.startAt) {
      schedule.startAt = new Date(updateScheduleDto.startAt);
    }
    if (updateScheduleDto.endAt) {
      schedule.endAt = new Date(updateScheduleDto.endAt);
    }
    if (updateScheduleDto.status) {
      schedule.status = updateScheduleDto.status;
    }

    await schedule.save();
    return this.toResponse(schedule);
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const schedule = await this.findSchedule(id, this.getTenantId(user));
    schedule.status = 'cancelado';
    await schedule.save();

    return this.toResponse(schedule);
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

  private async findSchedule(
    id: string,
    tenantId: string,
  ): Promise<ScheduleDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(
        'El identificador de la actividad no es válido.',
      );
    }

    const schedule = await this.scheduleModel.findOne({ _id: id, tenantId });

    if (!schedule) {
      throw new NotFoundException('La actividad no existe.');
    }

    return schedule;
  }

  private ensureEventIsEditable(event: EventDocument): void {
    if (event.status === 'cancelado') {
      throw new ConflictException(
        'No puedes modificar el cronograma de un evento cancelado.',
      );
    }
  }

  private ensureScheduleIsEditable(schedule: ScheduleDocument): void {
    if (schedule.status === 'cancelado') {
      throw new ConflictException('No puedes editar una actividad cancelada.');
    }
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

  private validateDates(
    startAt: string,
    endAt: string,
    event: EventDocument,
  ): void {
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (endDate < startDate) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }

    if (startDate < event.startAt || endDate > event.endAt) {
      throw new BadRequestException(
        'La actividad debe estar dentro del periodo del evento.',
      );
    }
  }

  private trimOptional(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private toResponse(
    schedule: ScheduleDocument | (Schedule & { _id: Types.ObjectId }),
  ) {
    return {
      id: schedule._id.toString(),
      eventId: schedule.eventId.toString(),
      responsibleUserId: schedule.responsibleUserId?.toString() ?? null,
      name: schedule.name,
      description: schedule.description,
      startAt: schedule.startAt,
      endAt: schedule.endAt,
      status: schedule.status,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }
}
