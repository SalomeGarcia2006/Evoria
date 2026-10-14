import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isEmail } from 'class-validator';
import type { Model } from 'mongoose';
import { ADMINISTRATOR_ROLE_NAME } from '../roles/roles.constants';
import { Role } from '../roles/schemas/role.schema';
import { PasswordService } from './password.service';
import { User } from './schemas/user.schema';

export interface InitialAdminSeedResult {
  created: number;
  existing: number;
}

@Injectable()
export class InitialAdminSeedService {
  constructor(
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async seed(): Promise<InitialAdminSeedResult> {
    const name = this.getRequiredValue('SEED_ADMIN_NAME');
    const email = this.getRequiredValue('SEED_ADMIN_EMAIL').toLowerCase();
    const password = this.getRequiredValue('SEED_ADMIN_PASSWORD');

    this.validateInput(name, email, password);

    const role = await this.roleModel
      .findOne({ name: ADMINISTRATOR_ROLE_NAME })
      .select('_id')
      .lean();

    if (!role) {
      throw new Error(
        'El rol Administrador no existe. Ejecuta primero el seed de roles.',
      );
    }

    const existingUser = await this.userModel.exists({ email });
    if (existingUser) {
      return { created: 0, existing: 1 };
    }

    await this.userModel.create({
      name,
      email,
      passwordHash: await this.passwordService.hash(password),
      roleId: role._id,
    });

    return { created: 1, existing: 0 };
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
