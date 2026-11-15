import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditsService } from '../audits/audits.service';
import {
  Membership,
  type MembershipDocument,
} from '../memberships/schemas/membership.schema';
import {
  Profile,
  type ProfileDocument,
} from '../profiles/schemas/profile.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PasswordService } from './password.service';
import { User, type UserDocument } from './schemas/user.schema';
import { Team } from '../teams/schemas/team.schema';
import { Event } from '../events/schemas/event.schema';
import { Schedule } from '../schedules/schemas/schedule.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    private readonly passwordService: PasswordService,
    private readonly auditsService: AuditsService,
    @Optional() @InjectModel(Team.name) private readonly teams?: Model<Team>,
    @Optional() @InjectModel(Event.name) private readonly events?: Model<Event>,
    @Optional()
    @InjectModel(Schedule.name)
    private readonly schedules?: Model<Schedule>,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const email = createUserDto.email.trim().toLowerCase();
    const profile = await this.findProfile(createUserDto.profileId, tenantId);

    if (await this.userModel.exists({ email })) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    let user: UserDocument | undefined;
    let membership: MembershipDocument | undefined;

    try {
      user = await this.userModel.create({
        name: createUserDto.name.trim(),
        email,
        passwordHash: this.passwordService.hash(createUserDto.password),
      });
      membership = await this.membershipModel.create({
        userId: user._id,
        tenantId,
        profileId: profile._id,
      });
    } catch (error) {
      if (user) {
        await this.userModel.deleteOne({ _id: user._id });
      }

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe un usuario con ese correo.');
      }

      throw error;
    }

    if (!user || !membership) {
      throw new Error('No se pudo crear el usuario.');
    }

    await this.auditsService.record({
      tenantId,
      actor: currentUser,
      module: 'usuarios',
      action: 'crear',
      entity: 'usuario',
      entityId: user._id,
      description: `Creó el usuario ${user.name}.`,
    });

    return this.toResponse(membership, user, profile);
  }

  async findAll(query: FindUsersDto, currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const filter = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [memberships, total] = await Promise.all([
      this.membershipModel
        .find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(query.limit),
      this.membershipModel.countDocuments(filter),
    ]);
    const [users, profiles] = await Promise.all([
      this.userModel.find({
        _id: { $in: memberships.map(({ userId }) => userId) },
      }),
      this.profileModel.find({
        _id: { $in: memberships.map(({ profileId }) => profileId) },
      }),
    ]);
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const profilesById = new Map(
      profiles.map((profile) => [profile._id.toString(), profile]),
    );

    return {
      items: memberships.flatMap((membership) => {
        const user = usersById.get(membership.userId.toString());
        const profile = profilesById.get(membership.profileId.toString());

        return user && profile
          ? [this.toResponse(membership, user, profile)]
          : [];
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findAvailableProfiles(currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const profiles = await this.profileModel
      .find({ tenantId, scope: 'tenant', status: 'activo' })
      .sort({ name: 1 })
      .lean();

    return profiles.map((profile) => ({
      id: profile._id.toString(),
      name: profile.name,
      description: profile.description,
    }));
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const membership = await this.findMembership(id, tenantId);
    const [user, profile] = await Promise.all([
      this.userModel.findById(membership.userId),
      this.profileModel.findById(membership.profileId),
    ]);

    if (!user || !profile) {
      throw new NotFoundException('El usuario no existe.');
    }

    return this.toResponse(membership, user, profile);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(currentUser);
    const membership = await this.findMembership(id, tenantId);

    if (
      updateUserDto.profileId === undefined &&
      updateUserDto.status === undefined
    ) {
      throw new BadRequestException('Debes indicar al menos un cambio.');
    }

    if (
      updateUserDto.status === 'inactivo' &&
      membership.userId.toString() === currentUser.id
    ) {
      throw new BadRequestException(
        'No puedes desactivar tu propia membresía.',
      );
    }

    let profile: ProfileDocument;
    if (updateUserDto.profileId) {
      profile = await this.findProfile(updateUserDto.profileId, tenantId);
      membership.profileId = profile._id;
    } else {
      profile = await this.findProfile(
        membership.profileId.toString(),
        tenantId,
      );
    }

    if (updateUserDto.status === 'inactivo' && this.teams) {
      const session = await this.membershipModel.db.startSession();
      try {
        await session.withTransaction(async () => {
          const locked = await this.membershipModel.findOneAndUpdate(
            { _id: membership._id, tenantId },
            { $inc: { teamRevision: 1 } },
            { session, returnDocument: 'after' },
          );
          if (!locked) throw new NotFoundException('La membresía no existe.');
          if (
            await this.teams!.exists({
              tenantId,
              status: 'activo',
              memberIds: membership.userId,
            }).session(session)
          )
            throw new ConflictException(
              'Retira al usuario de su equipo activo y reemplaza al líder si corresponde antes de desactivarlo.',
            );
          if (this.events && this.schedules) {
            const events = await this.events
              .find({ tenantId, responsibleUserId: membership.userId })
              .select('_id')
              .session(session)
              .lean();
            if (
              await this.schedules
                .exists({
                  tenantId,
                  eventId: { $in: events.map((event) => event._id) },
                  teamId: { $ne: null },
                  status: { $ne: 'cancelado' },
                  endAt: { $gt: new Date() },
                })
                .session(session)
            )
              throw new ConflictException(
                'Reemplaza al responsable de sus eventos con actividades asignadas antes de desactivarlo.',
              );
          }
          locked.status = 'inactivo';
          locked.profileId = membership.profileId;
          await locked.save({ session });
          membership.status = locked.status;
        });
      } finally {
        await session.endSession();
      }
    } else {
      if (updateUserDto.status) membership.status = updateUserDto.status;
      await membership.save();
    }

    const user = await this.userModel.findById(membership.userId);
    if (!user) throw new NotFoundException('El usuario no existe.');

    await this.auditsService.record({
      tenantId,
      actor: currentUser,
      module: 'usuarios',
      action: updateUserDto.status === 'inactivo' ? 'desactivar' : 'editar',
      entity: 'usuario',
      entityId: user._id,
      description:
        updateUserDto.status === 'inactivo'
          ? `Desactivó al usuario ${user.name}.`
          : `Actualizó el usuario ${user.name}.`,
    });

    return this.toResponse(membership, user, profile);
  }

  async deactivate(id: string, currentUser: AuthenticatedUser) {
    return this.update(id, { status: 'inactivo' }, currentUser);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }

    return user.tenantId;
  }

  private async findMembership(
    userId: string,
    tenantId: string,
  ): Promise<MembershipDocument> {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException(
        'El identificador del usuario no es válido.',
      );
    }

    const membership = await this.membershipModel.findOne({ userId, tenantId });
    if (!membership) {
      throw new NotFoundException(
        'El usuario no pertenece a la empresa activa.',
      );
    }

    return membership;
  }

  private async findProfile(
    profileId: string,
    tenantId: string,
  ): Promise<ProfileDocument> {
    const profile = await this.profileModel.findOne({
      _id: profileId,
      tenantId,
      scope: 'tenant',
      status: 'activo',
    });

    if (!profile) {
      throw new BadRequestException(
        'El perfil no pertenece a la empresa activa.',
      );
    }

    return profile;
  }

  private toResponse(
    membership: MembershipDocument,
    user: UserDocument,
    profile: ProfileDocument,
  ) {
    return {
      id: user._id.toString(),
      membershipId: membership._id.toString(),
      name: user.name,
      email: user.email,
      status: membership.status,
      profile: {
        id: profile._id.toString(),
        name: profile.name,
        description: profile.description,
      },
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
