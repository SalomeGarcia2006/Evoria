import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type ClientSession, type Model } from 'mongoose';
import { AlertsService } from '../alerts/alerts.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import { Team } from '../teams/schemas/team.schema';
import { Schedule } from './schemas/schedule.schema';
import { TeamActivityLog } from './schemas/team-activity-log.schema';
import { Membership } from '../memberships/schemas/membership.schema';

@Injectable()
export class ScheduleTeamsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(ScheduleTeamsService.name);
  constructor(
    @InjectModel(Schedule.name) private readonly schedules: Model<Schedule>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Team.name) private readonly teams: Model<Team>,
    @InjectModel(TeamActivityLog.name)
    private readonly historyModel: Model<TeamActivityLog>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    private readonly alerts: AlertsService,
  ) {}

  onModuleInit() {
    void this.processDue();
    this.timer = setInterval(() => void this.processDue(), 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async assign(id: string, teamId: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    this.validId(id);
    this.validId(teamId);
    return this.transaction(async (session) => {
      const schedule = await this.schedules
        .findOne({ _id: id, tenantId })
        .session(session);
      if (!schedule) throw new NotFoundException('La actividad no existe.');
      const event = await this.eventForLeader(
        schedule.eventId.toString(),
        tenantId,
        user,
        session,
      );
      const membership = await this.memberships.updateOne(
        { tenantId, userId: user.id, status: 'activo' },
        { $inc: { teamRevision: 1 } },
        { session },
      );
      if (!membership.matchedCount)
        throw new ForbiddenException(
          'La membresía del responsable no está activa.',
        );
      if (
        !(await this.alerts.canReceiveActivityAlerts(
          tenantId,
          user.id,
          session,
        ))
      )
        throw new ConflictException(
          'El responsable necesita los permisos alertas.ver y eventos.ver.',
        );
      if (
        event.status === 'cancelado' ||
        schedule.status === 'cancelado' ||
        schedule.status === 'completado' ||
        schedule.startAt < event.startAt ||
        schedule.endAt > event.endAt ||
        schedule.endAt <= new Date()
      )
        throw new ConflictException('La actividad no admite asignaciones.');
      if (schedule.teamId)
        throw new ConflictException(
          'La actividad ya tiene un equipo asignado.',
        );
      const team = await this.teams.findOneAndUpdate(
        { _id: teamId, tenantId, status: 'activo' },
        { $inc: { assignmentRevision: 1 } },
        { session, returnDocument: 'after' },
      );
      if (!team) throw new NotFoundException('El equipo activo no existe.');
      const assignments = await this.schedules
        .find({
          tenantId,
          teamId: team._id,
          status: { $ne: 'cancelado' },
          _id: { $ne: schedule._id },
        })
        .select('eventId startAt endAt')
        .session(session)
        .lean();
      for (const other of assignments) {
        if (this.conflicts(schedule, other))
          throw new ConflictException(
            'El equipo no tiene el tiempo de descanso requerido entre actividades.',
          );
      }
      const result = await this.schedules.findOneAndUpdate(
        {
          _id: schedule._id,
          tenantId,
          teamId: null,
          status: { $nin: ['cancelado', 'completado'] },
        },
        { $set: { teamId: team._id, teamCompletionNotifiedAt: null } },
        { session, returnDocument: 'after' },
      );
      if (!result)
        throw new ConflictException(
          'La actividad cambió durante la asignación.',
        );
      await this.log(result, team._id.toString(), 'asignado', user, session);
      return { scheduleId: result.id, teamId: team.id };
    });
  }
  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    this.validId(id);
    return this.transaction(async (session) => {
      const schedule = await this.schedules
        .findOne({ _id: id, tenantId })
        .session(session);
      if (!schedule) throw new NotFoundException('La actividad no existe.');
      await this.eventForLeader(
        schedule.eventId.toString(),
        tenantId,
        user,
        session,
      );
      if (!schedule.teamId)
        throw new ConflictException(
          'La actividad no tiene un equipo asignado.',
        );
      if (schedule.status === 'completado')
        throw new ConflictException(
          'No se puede retirar el equipo de una actividad completada.',
        );
      await this.teams.updateOne(
        { _id: schedule.teamId, tenantId },
        { $inc: { assignmentRevision: 1 } },
        { session },
      );
      const result = await this.schedules.updateOne(
        { _id: schedule._id, tenantId, teamId: schedule.teamId },
        { $set: { teamId: null, teamCompletionNotifiedAt: null } },
        { session },
      );
      if (!result.modifiedCount)
        throw new ConflictException('La asignación cambió.');
      await this.log(
        schedule,
        schedule.teamId.toString(),
        'retirado',
        user,
        session,
      );
      return { scheduleId: schedule.id, teamId: null };
    });
  }
  async complete(id: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    this.validId(id);
    return this.transaction(async (session) => {
      const schedule = await this.schedules
        .findOne({ _id: id, tenantId })
        .session(session);
      if (!schedule || !schedule.teamId)
        throw new NotFoundException('La actividad asignada no existe.');
      const team = await this.teams.findOneAndUpdate(
        { _id: schedule.teamId, tenantId, status: 'activo' },
        { $inc: { assignmentRevision: 1 } },
        { session, returnDocument: 'after' },
      );
      const event = await this.events.findOneAndUpdate(
        { _id: schedule.eventId, tenantId },
        { $inc: { teamAssignmentRevision: 1 } },
        { session, returnDocument: 'after' },
      );
      if (
        !team ||
        (team.leaderId.toString() !== user.id &&
          event?.responsibleUserId?.toString() !== user.id)
      )
        throw new ForbiddenException(
          'Solo el líder del equipo o del evento puede finalizar la actividad.',
        );
      if (schedule.status === 'cancelado')
        throw new ConflictException('La actividad está cancelada.');
      if (schedule.status !== 'completado') {
        schedule.status = 'completado';
        await schedule.save({ session });
        await this.log(
          schedule,
          schedule.teamId.toString(),
          'completado',
          user,
          session,
        );
      }
      await this.enqueueCompletion(schedule, session);
      return { scheduleId: schedule.id, status: schedule.status };
    });
  }
  async processDue() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.schedules
        .find({
          teamId: { $ne: null },
          $or: [
            {
              status: { $in: ['pendiente', 'en_progreso'] },
              endAt: { $lte: new Date() },
            },
            { status: 'completado', teamCompletionNotifiedAt: null },
          ],
        })
        .select('_id')
        .limit(100)
        .lean();
      for (const item of due) {
        await this.transaction(async (session) => {
          const schedule = await this.schedules
            .findOne({ _id: item._id, teamId: { $ne: null } })
            .session(session);
          if (!schedule || schedule.status === 'cancelado') return;
          if (schedule.status !== 'completado') {
            if (schedule.endAt > new Date()) return;
            schedule.status = 'completado';
            await schedule.save({ session });
            await this.log(
              schedule,
              schedule.teamId!.toString(),
              'completado',
              null,
              session,
            );
          }
          await this.enqueueCompletion(schedule, session);
        });
      }
    } catch (error) {
      this.logger.error(
        'No se pudieron finalizar las actividades pendientes.',
        error,
      );
    } finally {
      this.running = false;
    }
  }
  private async enqueueCompletion(
    schedule: InstanceType<Model<Schedule>>,
    session: ClientSession,
  ) {
    if (schedule.teamCompletionNotifiedAt) return;
    const event = await this.events
      .findOne({ _id: schedule.eventId, tenantId: schedule.tenantId })
      .session(session);
    if (!event?.responsibleUserId) return;
    await this.alerts.enqueue(
      {
        tenantId: schedule.tenantId.toString(),
        recipientId: event.responsibleUserId.toString(),
        type: 'activity_completed',
        title: 'Actividad finalizada',
        message: `La actividad ${schedule.name} finalizó.`,
        severity: 'info',
        eventId: event._id.toString(),
        dedupeKey: `activity-completed:${schedule._id.toString()}`,
        permissions: ['eventos.ver'],
      },
      session,
    );
    schedule.teamCompletionNotifiedAt = new Date();
    await schedule.save({ session });
  }
  async available(id: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    this.validId(id);
    const schedule = await this.schedules.findOne({ _id: id, tenantId }).lean();
    if (!schedule) throw new NotFoundException('La actividad no existe.');
    const event = await this.events
      .findOne({ _id: schedule.eventId, tenantId })
      .lean();
    if (!event || event.responsibleUserId?.toString() !== user.id)
      throw new ForbiddenException(
        'Solo el responsable del evento puede consultar la disponibilidad.',
      );
    if (!(await this.alerts.canReceiveActivityAlerts(tenantId, user.id)))
      throw new ConflictException(
        'El responsable necesita los permisos alertas.ver y eventos.ver.',
      );
    if (
      schedule.teamId ||
      schedule.status === 'cancelado' ||
      schedule.status === 'completado' ||
      event.status === 'cancelado' ||
      schedule.startAt < event.startAt ||
      schedule.endAt > event.endAt ||
      schedule.endAt <= new Date()
    )
      return [];
    const teams = await this.teams
      .find({ tenantId, status: 'activo' })
      .sort({ name: 1 })
      .lean();
    const assignments = await this.schedules
      .find({
        tenantId,
        teamId: { $in: teams.map((team) => team._id) },
        status: { $ne: 'cancelado' },
        startAt: { $lt: new Date(schedule.endAt.getTime() + 60 * 60000) },
        endAt: { $gt: new Date(schedule.startAt.getTime() - 60 * 60000) },
      })
      .select('teamId eventId startAt endAt')
      .lean();
    const unavailable = new Set(
      assignments
        .filter((item) => this.conflicts(schedule, item))
        .map((item) => item.teamId!.toString()),
    );
    return teams
      .filter((team) => !unavailable.has(team._id.toString()))
      .map((team) => ({
        id: team._id.toString(),
        name: team.name,
        specialty: team.specialty,
        leaderId: team.leaderId.toString(),
      }));
  }
  async history(id: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    this.validId(id);
    if (!(await this.schedules.exists({ _id: id, tenantId })))
      throw new NotFoundException('La actividad no existe.');
    const entries = await this.historyModel
      .find({ tenantId, scheduleId: id })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return entries.map((entry) => ({
      id: entry._id.toString(),
      teamId: entry.teamId.toString(),
      action: entry.action,
      actorId: entry.actorId?.toString() ?? null,
      actorName: entry.actorName,
      createdAt: entry.createdAt,
    }));
  }
  private conflicts(
    a: Pick<Schedule, 'startAt' | 'endAt' | 'eventId'>,
    b: Pick<Schedule, 'startAt' | 'endAt' | 'eventId'>,
  ) {
    const gap =
      a.eventId.toString() === b.eventId.toString() ? 15 * 60000 : 60 * 60000;
    return (
      a.startAt.getTime() < b.endAt.getTime() + gap &&
      a.endAt.getTime() + gap > b.startAt.getTime()
    );
  }
  private async log(
    schedule: InstanceType<Model<Schedule>>,
    teamId: string,
    action: string,
    actor: AuthenticatedUser | null,
    session: ClientSession,
  ) {
    await this.historyModel.create(
      [
        {
          tenantId: schedule.tenantId,
          scheduleId: schedule._id,
          eventId: schedule.eventId,
          teamId,
          action,
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? 'Sistema',
        },
      ],
      { session },
    );
  }
  private async eventForLeader(
    id: string,
    tenantId: string,
    user: AuthenticatedUser,
    session: ClientSession,
  ) {
    const event = await this.events.findOneAndUpdate(
      { _id: id, tenantId, responsibleUserId: user.id },
      { $inc: { teamAssignmentRevision: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!event)
      throw new ForbiddenException(
        'Solo el responsable del evento puede asignar equipos.',
      );
    return event;
  }
  private tenant(user: AuthenticatedUser) {
    if (user.scope !== 'tenant' || !user.tenantId)
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    return user.tenantId;
  }
  private validId(id: string) {
    if (!isValidObjectId(id))
      throw new BadRequestException('Identificador inválido.');
  }
  private async transaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.schedules.db.startSession();
    try {
      return await session.withTransaction(() => operation(session));
    } finally {
      await session.endSession();
    }
  }
}
