import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import { Tenant } from './schemas/tenant.schema';

export interface InitialTenantSeedResult {
  tenant: {
    id: Types.ObjectId;
    name: string;
    slug: string;
  };
  created: number;
  existing: number;
}

@Injectable()
export class InitialTenantSeedService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  async seed(): Promise<InitialTenantSeedResult> {
    const name = this.getRequiredValue('SEED_TENANT_NAME');
    const slug = this.createSlug(name);
    const existingTenant = await this.tenantModel.findOne({ slug }).lean();

    if (existingTenant) {
      return {
        tenant: {
          id: existingTenant._id,
          name: existingTenant.name,
          slug: existingTenant.slug,
        },
        created: 0,
        existing: 1,
      };
    }

    const tenant = await this.tenantModel.create({ name, slug });

    return {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
      },
      created: 1,
      existing: 0,
    };
  }

  private getRequiredValue(variableName: string): string {
    const value = this.configService.get<string>(variableName)?.trim();

    if (!value) {
      throw new Error(
        `${variableName} es obligatoria para crear la empresa inicial.`,
      );
    }

    if (value.length < 2 || value.length > 120) {
      throw new Error(`${variableName} debe tener entre 2 y 120 caracteres.`);
    }

    return value;
  }

  private createSlug(name: string): string {
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new Error('SEED_TENANT_NAME debe contener letras o números.');
    }

    return slug;
  }
}
