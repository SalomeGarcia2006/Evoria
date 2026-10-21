import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import {
  Membership,
  type MembershipDocument,
} from '../memberships/schemas/membership.schema';
import { AccessControlSeedService } from '../profiles/access-control.seed.service';
import { ADMINISTRATOR_PROFILE_NAME } from '../profiles/profiles.constants';
import { Profile } from '../profiles/schemas/profile.schema';
import { PasswordService } from '../users/password.service';
import { User, type UserDocument } from '../users/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant, type TenantDocument } from './schemas/tenant.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    private readonly passwordService: PasswordService,
    private readonly accessControlSeedService: AccessControlSeedService,
  ) {}

  async create(createTenantDto: CreateTenantDto, developer: AuthenticatedUser) {
    const name = createTenantDto.name.trim();
    const nit = createTenantDto.nit.trim();
    const slug = this.createSlug(name);
    const ownerEmail = createTenantDto.ownerEmail.trim().toLowerCase();

    const [existingTenant, existingOwner] = await Promise.all([
      this.tenantModel.exists({ $or: [{ slug }, { nit }] }),
      this.userModel.exists({ email: ownerEmail }),
    ]);

    if (existingTenant) {
      throw new ConflictException(
        'Ya existe una empresa con ese nombre o NIT.',
      );
    }

    if (existingOwner) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    let tenant: TenantDocument | undefined;
    let profileId: string | undefined;
    let owner: UserDocument | undefined;
    let membership: MembershipDocument | undefined;

    try {
      tenant = await this.tenantModel.create({
        name,
        nit,
        slug,
        createdBy: developer.id,
      });
      const profile =
        await this.accessControlSeedService.createTenantAdministratorProfile(
          tenant._id,
        );
      profileId = profile.toString();
      owner = await this.userModel.create({
        name: createTenantDto.ownerName.trim(),
        email: ownerEmail,
        passwordHash: this.passwordService.hash(createTenantDto.ownerPassword),
      });
      membership = await this.membershipModel.create({
        userId: owner._id,
        tenantId: tenant._id,
        profileId: profile,
      });
    } catch (error) {
      await this.rollback(tenant, profileId, owner, membership);

      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('La empresa o el correo ya existen.');
      }

      throw error;
    }

    return {
      id: tenant._id.toString(),
      name: tenant.name,
      nit: tenant.nit,
      slug: tenant.slug,
      administrator: {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        membershipId: membership._id.toString(),
      },
    };
  }

  async findAll() {
    const tenants = await this.tenantModel
      .find({ status: 'activo' })
      .select('name nit slug status')
      .sort({ name: 1 })
      .lean();

    return tenants.map((tenant) => ({
      id: tenant._id.toString(),
      name: tenant.name,
      nit: tenant.nit,
      slug: tenant.slug,
      status: tenant.status,
    }));
  }

  async join(tenantId: string, userId: string) {
    if (!isValidObjectId(tenantId)) {
      throw new BadRequestException('La empresa seleccionada no es válida.');
    }

    const [tenant, activeMembership] = await Promise.all([
      this.tenantModel.findOne({ _id: tenantId, status: 'activo' }).lean(),
      this.membershipModel
        .findOne({ userId, status: 'activo' })
        .select('_id')
        .lean(),
    ]);

    if (!tenant) {
      throw new BadRequestException('La empresa seleccionada no está activa.');
    }

    if (activeMembership) {
      throw new ConflictException(
        'Debes salir de la empresa actual antes de ingresar a otra.',
      );
    }

    const profile = await this.profileModel
      .findOne({
        name: ADMINISTRATOR_PROFILE_NAME,
        scope: 'tenant',
        tenantId: tenant._id,
        status: 'activo',
        isSystem: true,
      })
      .select('_id')
      .lean();

    if (!profile) {
      throw new BadRequestException(
        'La empresa no tiene un perfil Administrador disponible.',
      );
    }

    const previousMembership = await this.membershipModel
      .findOneAndUpdate(
        { userId, tenantId: tenant._id, status: 'inactivo' },
        { $set: { profileId: profile._id, status: 'activo' } },
        { new: true },
      )
      .lean();

    if (previousMembership) {
      return { id: previousMembership._id.toString() };
    }

    try {
      const membership = await this.membershipModel.create({
        userId,
        tenantId: tenant._id,
        profileId: profile._id,
      });

      return { id: membership._id.toString() };
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Debes salir de la empresa actual antes de ingresar a otra.',
        );
      }

      throw error;
    }
  }

  async leave(userId: string): Promise<void> {
    const membership = await this.membershipModel.findOneAndUpdate(
      { userId, status: 'activo' },
      { $set: { status: 'inactivo' } },
      { new: true },
    );

    if (!membership) {
      throw new ConflictException('No tienes una empresa activa.');
    }
  }

  private createSlug(name: string): string {
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException(
        'El nombre de la empresa debe contener letras o números.',
      );
    }

    return slug;
  }

  private async rollback(
    tenant?: TenantDocument,
    profileId?: string,
    owner?: UserDocument,
    membership?: MembershipDocument,
  ): Promise<void> {
    if (membership)
      await this.membershipModel.deleteOne({ _id: membership._id });
    if (owner) await this.userModel.deleteOne({ _id: owner._id });
    if (profileId) await this.profileModel.deleteOne({ _id: profileId });
    if (tenant) await this.tenantModel.deleteOne({ _id: tenant._id });
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
