import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isEmail } from 'class-validator';
import type { Model, Types } from 'mongoose';
import { Membership } from '../memberships/schemas/membership.schema';
import { ADMINISTRATOR_PROFILE_NAME } from '../profiles/profiles.constants';
import { Profile } from '../profiles/schemas/profile.schema';
import { PasswordService } from './password.service';
import { User } from './schemas/user.schema';

export interface InitialAdminSeedResult {
  created: number;
  existing: number;
  migrated: number;
}

@Injectable()
export class InitialAdminSeedService {
  constructor(
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async seed(tenantId: Types.ObjectId): Promise<InitialAdminSeedResult> {
    const name = this.getRequiredValue('SEED_ADMIN_NAME');
    const email = this.getRequiredValue('SEED_ADMIN_EMAIL').toLowerCase();
    const password = this.getRequiredValue('SEED_ADMIN_PASSWORD');

    this.validateInput(name, email, password);

    const profile = await this.profileModel
      .findOne({ name: ADMINISTRATOR_PROFILE_NAME, tenantId })
      .select('_id')
      .lean();

    if (!profile) {
      throw new Error(
        'El perfil Administrador no existe. Ejecuta primero el seed de control de acceso.',
      );
    }

    const existingUser = await this.userModel
      .findOne({ email })
      .select('_id')
      .lean();

    if (existingUser) {
      const membershipResult = await this.membershipModel.updateOne(
        { userId: existingUser._id, tenantId },
        {
          $setOnInsert: {
            userId: existingUser._id,
            tenantId,
            profileId: profile._id,
          },
        },
        { upsert: true },
      );

      return {
        created: 0,
        existing: membershipResult.upsertedCount ? 0 : 1,
        migrated: membershipResult.upsertedCount ? 1 : 0,
      };
    }

    const user = await this.userModel.create({
      name,
      email,
      passwordHash: await this.passwordService.hash(password),
    });
    await this.membershipModel.create({
      userId: user._id,
      tenantId,
      profileId: profile._id,
    });

    return { created: 1, existing: 0, migrated: 0 };
  }

  private getRequiredValue(variableName: string): string {
    const value = this.configService.get<string>(variableName)?.trim();

    if (!value) {
      throw new Error(
        `La variable ${variableName} es obligatoria para crear el administrador inicial.`,
      );
    }

    return value;
  }

  private validateInput(name: string, email: string, password: string): void {
    if (name.length < 2 || name.length > 120) {
      throw new Error('SEED_ADMIN_NAME debe tener entre 2 y 120 caracteres.');
    }

    if (!isEmail(email) || email.length > 150) {
      throw new Error('SEED_ADMIN_EMAIL debe contener un correo válido.');
    }

    if (password.length < 8) {
      throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres.');
    }
  }
}
