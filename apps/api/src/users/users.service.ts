import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
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

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: AuthenticatedUser) {
    const tenantId = this.getTenantId(currentUser);
    const email = createUserDto.email.trim().toLowerCase();
    const profile = await this.findProfile(createUserDto.profileId, tenantId);

    if (await this.userModel.exists({ email })) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    let user: UserDocument | undefined;

    try {
      user = await this.userModel.create({
        name: createUserDto.name.trim(),
        email,
        passwordHash: this.passwordService.hash(createUserDto.password),
      });
      const membership = await this.membershipModel.create({
        userId: user._id,
        tenantId,
        profileId: profile._id,
      });

      return this.toResponse(membership, user, profile);
    } catch (error) {
      if (user) {
        await this.userModel.deleteOne({ _id: user._id });
      }

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe un usuario con ese correo.');
      }

      throw error;
    }
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

    if (updateUserDto.status) membership.status = updateUserDto.status;
    await membership.save();

    const user = await this.userModel.findById(membership.userId);
    if (!user) throw new NotFoundException('El usuario no existe.');

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
