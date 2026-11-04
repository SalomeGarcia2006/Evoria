import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FindAuditLogsDto } from './dto/find-audit-logs.dto';
import { AuditLog } from './schemas/audit-log.schema';

export type CreateAuditLogInput = {
  tenantId: string;
  actor: AuthenticatedUser;
  module: string;
  action: string;
  entity: string;
  entityId: string | Types.ObjectId;
  description: string;
};

@Injectable()
export class AuditsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
  ) {}

  async record(input: CreateAuditLogInput): Promise<void> {
    await this.auditLogModel.create({
      tenantId: input.tenantId,
      actorUserId: input.actor.id,
      actorName: input.actor.name,
      module: input.module,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      description: input.description,
    });
  }

  async findAll(query: FindAuditLogsDto, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    const filter: Record<string, unknown> = {
      tenantId,
      ...(query.userId ? { actorUserId: query.userId } : {}),
      ...(query.module ? { module: query.module.trim().toLowerCase() } : {}),
      ...(query.action ? { action: query.action.trim().toLowerCase() } : {}),
    };

    if (query.startDate || query.endDate) {
      filter.createdAt = {
        ...(query.startDate ? { $gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { $lte: new Date(query.endDate) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => ({
        id: item._id.toString(),
        userId: item.actorUserId.toString(),
        userName: item.actorName,
        module: item.module,
        action: item.action,
        entity: item.entity,
        entityId: item.entityId.toString(),
        description: item.description,
        createdAt: item.createdAt,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }

    return user.tenantId;
  }
}
