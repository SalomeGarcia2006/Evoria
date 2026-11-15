import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  isValidObjectId,
  type ClientSession,
  type Model,
  type Types,
} from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditsService } from '../audits/audits.service';
import { Membership } from '../memberships/schemas/membership.schema';
import { Schedule } from '../schedules/schemas/schedule.schema';
import { User } from '../users/schemas/user.schema';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team, type TeamDocument } from './schemas/team.schema';
import { TeamSpecialty } from './schemas/team-specialty.schema';
import { TEAM_SPECIALTIES } from './teams.constants';

@Injectable()
export class TeamsService implements OnModuleInit {
  constructor(
    @InjectModel(Team.name) private readonly teams: Model<Team>,
    @InjectModel(TeamSpecialty.name)
    private readonly teamSpecialties: Model<TeamSpecialty>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Schedule.name) private readonly schedules: Model<Schedule>,
    private readonly audits: AuditsService,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.teams.createIndexes(),
      this.teamSpecialties.createIndexes(),
    ]);
  }

  async specialties(user: AuthenticatedUser) {
    const custom = await this.teamSpecialties
      .find({ tenantId: this.tenant(user) })
      .sort({ name: 1 })
      .lean();
    return [...TEAM_SPECIALTIES, ...custom.map((item) => item.name)];
  }

  async createSpecialty(value: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    const name = this.text(value);
    const normalizedName = name.toLocaleLowerCase('es');
    if (
      TEAM_SPECIALTIES.some(
        (item) => item.toLocaleLowerCase('es') === normalizedName,
      )
    )
      throw new ConflictException('La especialidad ya existe.');
    try {
      const specialty = await this.teamSpecialties.create({
        tenantId,
        name,
        normalizedName,
      });
      return { id: specialty.id as string, name: specialty.name };
    } catch (error) {
      this.duplicate(error, 'La especialidad ya existe.');
    }
  }

  async create(dto: CreateTeamDto, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    const name = this.text(dto.name);
    const specialty = this.text(dto.specialty);
    const session = await this.teams.db.startSession();
    try {
      return await session.withTransaction(async () => {
        const members = await this.validateMembers(
          dto.memberIds,
          dto.leaderId,
          tenantId,
          session,
        );
        const [team] = await this.teams.create(
          [
            {
              tenantId,
              name,
              specialty,
              memberIds: members,
              leaderId: dto.leaderId,
              createdBy: user.id,
            },
          ],
          { session },
        );
        await this.audit(user, tenantId, 'crear', team, session);
        return this.response(team);
      });
    } catch (error) {
      this.duplicate(error);
    } finally {
      await session.endSession();
    }
  }

  async findAll(user: AuthenticatedUser) {
    const teams = await this.teams
      .find({ tenantId: this.tenant(user) })
      .sort({ name: 1 })
      .lean();
    return teams.map((team) => this.response(team));
  }
  async findOne(id: string, user: AuthenticatedUser) {
    return this.response(await this.find(id, this.tenant(user)));
  }
  async update(id: string, dto: UpdateTeamDto, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    if (!isValidObjectId(id))
      throw new BadRequestException('Identificador de equipo inválido.');
    const session = await this.teams.db.startSession();
    try {
      return await session.withTransaction(async () => {
        const team = await this.teams.findOneAndUpdate(
          { _id: id, tenantId, status: 'activo' },
          { $inc: { assignmentRevision: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!team) throw new NotFoundException('El equipo activo no existe.');
        const memberIds = dto.memberIds ?? team.memberIds.map(String);
        const leaderId = dto.leaderId ?? team.leaderId.toString();
        const members = await this.validateMembers(
          memberIds,
          leaderId,
          tenantId,
          session,
        );
        if (dto.name !== undefined) team.name = this.text(dto.name);
        if (dto.specialty !== undefined)
          team.specialty = this.text(dto.specialty);
        team.set('memberIds', members);
        team.set('leaderId', leaderId);
        await team.save({ session });
        await this.audit(user, tenantId, 'editar', team, session);
        return this.response(team);
      });
    } catch (error) {
      this.duplicate(error);
    } finally {
      await session.endSession();
    }
  }
  async deactivate(id: string, user: AuthenticatedUser) {
    const tenantId = this.tenant(user);
    if (!isValidObjectId(id))
      throw new BadRequestException('Identificador de equipo inválido.');
    const session = await this.teams.db.startSession();
    try {
      let result!: TeamDocument;
      await session.withTransaction(async () => {
        const team = await this.teams.findOneAndUpdate(
          { _id: id, tenantId, status: 'activo' },
          { $inc: { assignmentRevision: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!team) throw new NotFoundException('El equipo activo no existe.');
        const assigned = await this.schedules
          .exists({
            tenantId,
            teamId: team._id,
            status: { $ne: 'cancelado' },
            endAt: { $gt: new Date() },
          })
          .session(session);
        if (assigned)
          throw new ConflictException(
            'El equipo tiene actividades pendientes o en curso.',
          );
        team.status = 'inactivo';
        await team.save({ session });
        result = team;
      });
      await this.audit(user, tenantId, 'desactivar', result);
      return this.response(result);
    } finally {
      await session.endSession();
    }
  }
  private tenant(user: AuthenticatedUser) {
    if (user.scope !== 'tenant' || !user.tenantId)
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    return user.tenantId;
  }
  private async find(id: string, tenantId: string) {
    if (!isValidObjectId(id))
      throw new BadRequestException('Identificador de equipo inválido.');
    const team = await this.teams.findOne({ _id: id, tenantId });
    if (!team) throw new NotFoundException('El equipo no existe.');
    return team;
  }
  private text(value: string) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2)
      throw new BadRequestException(
        'El nombre y la especialidad deben tener al menos dos caracteres.',
      );
    return normalized;
  }
  private async validateMembers(
    ids: string[],
    leaderId: string,
    tenantId: string,
    session: ClientSession,
  ) {
    const normalized = ids.map((id) => id.toLowerCase());
    if (
      !normalized.length ||
      new Set(normalized).size !== normalized.length ||
      !normalized.includes(leaderId.toLowerCase())
    )
      throw new BadRequestException(
        'El equipo debe tener integrantes únicos y su líder debe pertenecer al equipo.',
      );
    const users = await this.users
      .countDocuments({ _id: { $in: normalized }, status: 'activo' })
      .session(session);
    if (users !== normalized.length)
      throw new BadRequestException(
        'Todos los integrantes deben estar activos y vinculados a la empresa.',
      );
    for (const userId of [...normalized].sort()) {
      const locked = await this.memberships.updateOne(
        { tenantId, userId, status: 'activo' },
        { $inc: { teamRevision: 1 } },
        { session },
      );
      if (!locked.matchedCount)
        throw new BadRequestException(
          'Todos los integrantes deben estar activos y vinculados a la empresa.',
        );
    }
    return normalized;
  }
  private duplicate(
    error: unknown,
    message = 'Un integrante ya pertenece a otro equipo activo.',
  ): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    )
      throw new ConflictException(message);
    throw error;
  }
  private async audit(
    user: AuthenticatedUser,
    tenantId: string,
    action: string,
    team: TeamDocument,
    session?: ClientSession,
  ) {
    await this.audits.record(
      {
        tenantId,
        actor: user,
        module: 'equipos',
        action,
        entity: 'equipo',
        entityId: team._id,
        description: `${action}: equipo ${team.name}.`,
      },
      session,
    );
  }
  private response(team: Team & { _id: Types.ObjectId }) {
    return {
      id: team._id.toString(),
      name: team.name,
      specialty: team.specialty,
      memberIds: team.memberIds.map(String),
      leaderId: team.leaderId.toString(),
      status: team.status,
      createdBy: team.createdBy.toString(),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
