import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { INITIAL_ROLES } from './roles.constants';
import { Role } from './schemas/role.schema';

export interface RolesSeedResult {
  created: number;
  existing: number;
}

@Injectable()
export class RolesSeedService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  async seed(): Promise<RolesSeedResult> {
    const result = await this.roleModel.bulkWrite(
      INITIAL_ROLES.map((role) => ({
        updateOne: {
          filter: { name: role.name },
          update: { $setOnInsert: role },
          upsert: true,
        },
      })),
    );

    return {
      created: result.upsertedCount,
      existing: INITIAL_ROLES.length - result.upsertedCount,
    };
  }
}
