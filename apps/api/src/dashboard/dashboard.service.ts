import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { DashboardEventStatus, DashboardSummary } from '@evoria/contracts';
import { type Model, Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EVENT_STATUSES, type EventStatus } from '../events/events.constants';
import { Event } from '../events/schemas/event.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { Permission } from '../permissions/schemas/permission.schema';
import { Profile } from '../profiles/schemas/profile.schema';
import { EventBudget } from '../budgets/schemas/event-budget.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItem>,
    @InjectModel(EventBudget.name)
    private readonly budgetModel: Model<EventBudget>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
  ) {}

  async summary(user: AuthenticatedUser): Promise<DashboardSummary> {
    const tenantId = this.getTenantId(user);
    const permissions = await this.findPermissionKeys(user, tenantId);

    const [events, inventory, budgets] = await Promise.all([
      permissions.has('eventos.ver')
        ? this.eventSummary(tenantId)
        : Promise.resolve(null),
      permissions.has('inventario.ver')
        ? this.inventorySummary(tenantId)
        : Promise.resolve(null),
      permissions.has('presupuestos.ver')
        ? this.budgetSummary(tenantId)
        : Promise.resolve(null),
    ]);

    return { events, inventory, budgets };
  }

  private async eventSummary(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const [total, statusRows, upcoming] = await Promise.all([
      this.eventModel.countDocuments({ tenantId }),
      this.eventModel.aggregate<{ _id: EventStatus; count: number }>([
        { $match: { tenantId: tenantObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.eventModel
        .find({
          tenantId,
          status: { $nin: ['cancelado', 'finalizado'] },
          startAt: { $gte: new Date() },
        })
        .sort({ startAt: 1, _id: 1 })
        .limit(5)
        .select('_id name startAt endAt status')
        .lean(),
    ]);
    const byStatus = Object.fromEntries(
      EVENT_STATUSES.map((status) => [status, 0]),
    ) as Record<DashboardEventStatus, number>;
    for (const row of statusRows) byStatus[row._id] = row.count;

    return {
      total,
      active: byStatus.borrador + byStatus.planificado + byStatus.en_progreso,
      byStatus,
      upcoming: upcoming.map((event) => ({
        id: event._id.toString(),
        name: event.name,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        status: event.status,
      })),
    };
  }

  private async inventorySummary(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const [summary] = await this.inventoryModel.aggregate<{
      resources: number;
      total: number;
      available: number;
      reserved: number;
      maintenance: number;
    }>([
      { $match: { tenantId: tenantObjectId, status: { $ne: 'inactivo' } } },
      {
        $group: {
          _id: null,
          resources: { $sum: 1 },
          total: { $sum: '$totalQuantity' },
          available: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'disponible'] },
                '$availableQuantity',
                0,
              ],
            },
          },
          reserved: { $sum: '$reservedQuantity' },
          maintenance: {
            $sum: { $cond: [{ $eq: ['$status', 'mantenimiento'] }, 1, 0] },
          },
        },
      },
    ]);

    return (
      summary ?? {
        resources: 0,
        total: 0,
        available: 0,
        reserved: 0,
        maintenance: 0,
      }
    );
  }

  private async budgetSummary(tenantId: string) {
    const activeEvents = await this.eventModel
      .find({ tenantId, status: { $ne: 'cancelado' } })
      .select('_id')
      .lean();
    const budgets = await this.budgetModel
      .find({
        tenantId,
        eventId: { $in: activeEvents.map((event) => event._id) },
      })
      .select(
        'baseAmountCop approvedIncreaseCop inventorySpentCop providerSpentCop extraSpentCop',
      )
      .lean();

    return budgets.reduce(
      (totals, budget) => {
        const allocatedCop = budget.baseAmountCop + budget.approvedIncreaseCop;
        const spentCop =
          budget.inventorySpentCop +
          budget.providerSpentCop +
          budget.extraSpentCop;
        totals.allocatedCop += allocatedCop;
        totals.spentCop += spentCop;
        totals.remainingCop += allocatedCop - spentCop;
        return totals;
      },
      { allocatedCop: 0, spentCop: 0, remainingCop: 0 },
    );
  }

  private async findPermissionKeys(
    user: AuthenticatedUser,
    tenantId: string,
  ): Promise<Set<string>> {
    const profile = await this.profileModel
      .findOne({
        _id: user.profileId,
        tenantId,
        scope: 'tenant',
        status: 'activo',
      })
      .select('permissionIds')
      .lean();
    if (!profile) {
      throw new ForbiddenException('Tu perfil no está disponible.');
    }

    const permissions = await this.permissionModel
      .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
      .select('key')
      .lean();
    return new Set(permissions.map((permission) => permission.key));
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }
    return user.tenantId;
  }
}
