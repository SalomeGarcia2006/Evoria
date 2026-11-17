import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model, type PipelineStage } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import { EVENT_STATUSES } from '../events/events.constants';
import { EventBudget } from '../budgets/schemas/event-budget.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { EventResource } from '../resources/schemas/event-resource.schema';
import { EventProviderService } from '../provider-services/schemas/event-provider-service.schema';
import { Schedule } from '../schedules/schemas/schedule.schema';
import { Profile } from '../profiles/schemas/profile.schema';
import { Permission } from '../permissions/schemas/permission.schema';
import { ReportQuery } from './reports.dto';

type Row = Record<string, unknown>;
type Context = { tenant: Types.ObjectId; permissions: Set<string> };
type Page = {
  items: Row[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
const needs: Record<string, string[]> = {
  events: ['eventos.ver'],
  budgets: ['eventos.ver', 'presupuestos.ver'],
  inventory: ['inventario.ver'],
  resources: ['eventos.ver', 'inventario.ver', 'asignaciones.ver'],
  providers: ['eventos.ver', 'proveedores.ver', 'servicios_proveedor.ver'],
  schedules: ['eventos.ver', 'cronogramas.ver'],
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(EventBudget.name) private readonly budgets: Model<EventBudget>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItem>,
    @InjectModel(EventResource.name)
    private readonly resources: Model<EventResource>,
    @InjectModel(EventProviderService.name)
    private readonly providers: Model<EventProviderService>,
    @InjectModel(Schedule.name) private readonly schedules: Model<Schedule>,
    @InjectModel(Profile.name) private readonly profiles: Model<Profile>,
    @InjectModel(Permission.name)
    private readonly permissions: Model<Permission>,
  ) {}

  async context(user: AuthenticatedUser): Promise<Context> {
    if (
      user.scope !== 'tenant' ||
      !user.tenantId ||
      !user.profileId ||
      !Types.ObjectId.isValid(user.tenantId)
    )
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    const profile = await this.profiles
      .findOne({
        _id: user.profileId,
        tenantId: user.tenantId,
        scope: 'tenant',
        status: 'activo',
      })
      .select('permissionIds')
      .lean();
    if (!profile) throw new ForbiddenException('Tu perfil no está disponible.');
    const permissions = await this.permissions
      .find({ _id: { $in: profile.permissionIds }, status: 'activo' })
      .select('key')
      .lean();
    const granted = new Set(permissions.map((item) => item.key));
    if (!granted.has('reportes.ver'))
      throw new ForbiddenException(
        'No tienes permiso para consultar reportes.',
      );
    return { tenant: new Types.ObjectId(user.tenantId), permissions: granted };
  }

  private allowed(ctx: Context, kind: string) {
    return needs[kind].every((key) => ctx.permissions.has(key));
  }
  private require(ctx: Context, kind: string) {
    if (!this.allowed(ctx, kind))
      throw new ForbiddenException('No tienes permisos para este reporte.');
  }
  private eventFilter(
    ctx: Context,
    query: ReportQuery,
    financial = false,
  ): Row {
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la final.',
      );
    if (financial && query.status === 'cancelado' && !query.includeCancelled)
      throw new BadRequestException(
        'Para consultar eventos cancelados incluye includeCancelled=true.',
      );
    const filter: Row = { tenantId: ctx.tenant };
    if (query.eventId) filter._id = new Types.ObjectId(query.eventId);
    if (query.responsibleUserId)
      filter.responsibleUserId = new Types.ObjectId(query.responsibleUserId);
    if (query.eventType?.trim()) filter.type = query.eventType.trim();
    if (query.status) filter.status = query.status;
    else if (financial && !query.includeCancelled)
      filter.status = { $ne: 'cancelado' };
    if (query.from || query.to)
      filter.startAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    return filter;
  }
  private eventJoin(
    ctx: Context,
    query: ReportQuery,
    financial = false,
  ): Row[] {
    return [
      {
        $lookup: {
          from: 'events',
          let: { relatedId: '$eventId' },
          pipeline: [
            {
              $match: {
                ...this.eventFilter(ctx, query, financial),
                $expr: { $eq: ['$_id', '$$relatedId'] },
              },
            },
            { $project: { name: 1, status: 1, startAt: 1 } },
          ],
          as: 'event',
        },
      },
      { $unwind: '$event' },
    ];
  }
  private async page<T>(
    model: Model<T>,
    stages: Row[],
    query: ReportQuery,
    sort: Row,
  ): Promise<Page> {
    const [result] = await model.aggregate<{
      items: Row[];
      count: Array<{ total: number }>;
    }>([
      ...stages,
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ] as unknown as PipelineStage[]);
    const total = result.count[0]?.total ?? 0;
    return {
      items: result.items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async eventReport(ctx: Context, query: ReportQuery) {
    this.require(ctx, 'events');
    const filter = this.eventFilter(ctx, query);
    const [page, groups] = await Promise.all([
      this.page(
        this.events,
        [
          { $match: filter },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              name: 1,
              type: 1,
              status: 1,
              startAt: 1,
              endAt: 1,
              responsibleUserId: {
                $cond: [
                  { $ifNull: ['$responsibleUserId', false] },
                  { $toString: '$responsibleUserId' },
                  null,
                ],
              },
              invitados: { $ifNull: ['$invitados', 0] },
            },
          },
        ],
        query,
        { startAt: -1, id: -1 },
      ),
      this.events.aggregate<{ _id: string; count: number; invitados: number }>([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            invitados: { $sum: { $ifNull: ['$invitados', 0] } },
          },
        },
      ]),
    ]);
    const byStatus = Object.fromEntries(
      EVENT_STATUSES.map((status) => [status, 0]),
    );
    for (const row of groups) byStatus[row._id] = row.count;
    return {
      ...page,
      byStatus,
      invitados: groups.reduce((sum, row) => sum + row.invitados, 0),
    };
  }
  async budgetReport(ctx: Context, query: ReportQuery) {
    this.require(ctx, 'budgets');
    const stages: Row[] = [
      { $match: this.eventFilter(ctx, query, true) },
      {
        $lookup: {
          from: 'event_budgets',
          let: { relatedId: '$_id' },
          pipeline: [
            {
              $match: {
                tenantId: ctx.tenant,
                $expr: { $eq: ['$eventId', '$$relatedId'] },
              },
            },
          ],
          as: 'budget',
        },
      },
      { $unwind: { path: '$budget', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          eventId: { $toString: '$_id' },
          eventName: '$name',
          eventStatus: '$status',
          startAt: 1,
          initialized: { $ne: [{ $ifNull: ['$budget._id', null] }, null] },
          baseAmountCop: { $ifNull: ['$budget.baseAmountCop', null] },
          approvedIncreaseCop: { $ifNull: ['$budget.approvedIncreaseCop', 0] },
          inventorySpentCop: { $ifNull: ['$budget.inventorySpentCop', 0] },
          providerSpentCop: { $ifNull: ['$budget.providerSpentCop', 0] },
          extraSpentCop: { $ifNull: ['$budget.extraSpentCop', 0] },
        },
      },
      {
        $set: {
          allocatedCop: {
            $add: [{ $ifNull: ['$baseAmountCop', 0] }, '$approvedIncreaseCop'],
          },
          spentCop: {
            $add: ['$inventorySpentCop', '$providerSpentCop', '$extraSpentCop'],
          },
        },
      },
      {
        $set: {
          remainingCop: { $subtract: ['$allocatedCop', '$spentCop'] },
          executionPercent: {
            $cond: [
              { $gt: ['$allocatedCop', 0] },
              { $multiply: [{ $divide: ['$spentCop', '$allocatedCop'] }, 100] },
              null,
            ],
          },
        },
      },
    ];
    const [result] = await this.events.aggregate<{
      items: Row[];
      count: Array<{ total: number }>;
      sums: Row[];
    }>([
      ...stages,
      {
        $facet: {
          items: [
            { $sort: { startAt: -1, eventId: -1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            { $unset: 'startAt' },
          ],
          count: [{ $count: 'total' }],
          sums: [
            {
              $group: {
                _id: null,
                allocatedCop: { $sum: '$allocatedCop' },
                spentCop: { $sum: '$spentCop' },
                remainingCop: { $sum: '$remainingCop' },
                inventorySpentCop: { $sum: '$inventorySpentCop' },
                providerSpentCop: { $sum: '$providerSpentCop' },
                extraSpentCop: { $sum: '$extraSpentCop' },
              },
            },
            { $unset: '_id' },
          ],
        },
      },
    ] as unknown as PipelineStage[]);
    const total = result.count[0]?.total ?? 0;
    return {
      items: result.items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      totals: result.sums[0] ?? {
        allocatedCop: 0,
        spentCop: 0,
        remainingCop: 0,
        inventorySpentCop: 0,
        providerSpentCop: 0,
        extraSpentCop: 0,
      },
    };
  }
  async inventoryReport(ctx: Context, query: ReportQuery) {
    this.require(ctx, 'inventory');
    const filter = {
      tenantId: ctx.tenant,
      status: query.inventoryStatus ?? { $ne: 'inactivo' },
    };
    const configured = Number(process.env.ALERT_INVENTORY_PERCENT ?? 20);
    const threshold =
      Number.isFinite(configured) && configured > 0 && configured <= 100
        ? configured
        : 20;
    const [page, totals] = await Promise.all([
      this.page(
        this.inventory,
        [
          { $match: filter },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              name: 1,
              type: 1,
              status: 1,
              totalQuantity: 1,
              availableQuantity: 1,
              reservedQuantity: 1,
              lowStock: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'disponible'] },
                      { $gt: ['$totalQuantity', 0] },
                      { $gte: ['$availableQuantity', 0] },
                      { $lte: ['$availableQuantity', '$totalQuantity'] },
                    ],
                  },
                  {
                    $lte: [
                      { $multiply: ['$availableQuantity', 100] },
                      { $multiply: ['$totalQuantity', threshold] },
                    ],
                  },
                  false,
                ],
              },
            },
          },
        ],
        query,
        { name: 1, id: 1 },
      ),
      this.inventory.aggregate<Row>([
        { $match: filter },
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
        { $unset: '_id' },
      ]),
    ]);
    return {
      ...page,
      totals: totals[0] ?? {
        resources: 0,
        total: 0,
        available: 0,
        reserved: 0,
        maintenance: 0,
      },
    };
  }
  async resourceReport(ctx: Context, query: ReportQuery) {
    this.require(ctx, 'resources');
    return this.page(
      this.resources,
      [
        { $match: { tenantId: ctx.tenant, status: 'asignado' } },
        ...this.eventJoin(ctx, query),
        {
          $lookup: {
            from: 'resources',
            let: { itemId: '$inventoryItemId' },
            pipeline: [
              {
                $match: {
                  tenantId: ctx.tenant,
                  $expr: { $eq: ['$_id', '$$itemId'] },
                },
              },
              { $project: { name: 1 } },
            ],
            as: 'inventory',
          },
        },
        { $unwind: { path: '$inventory', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            eventId: { $toString: '$eventId' },
            eventName: '$event.name',
            inventoryItemId: { $toString: '$inventoryItemId' },
            inventoryName: {
              $ifNull: ['$inventory.name', 'Recurso no disponible'],
            },
            quantity: 1,
            costAmountCop: { $ifNull: ['$costAmountCop', null] },
            assignedAt: 1,
            status: 1,
          },
        },
      ],
      query,
      { assignedAt: -1, id: -1 },
    );
  }
  async providerReport(ctx: Context, query: ReportQuery) {
    this.require(ctx, 'providers');
    return this.page(
      this.providers,
      [
        { $match: { tenantId: ctx.tenant } },
        ...this.eventJoin(ctx, query, true),
        {
          $group: {
            _id: '$providerId',
            serviceCount: { $sum: 1 },
            confirmedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmado'] }, 1, 0] },
            },
            cancelledCount: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelado'] }, 1, 0] },
            },
            confirmedAmountCop: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'confirmado'] },
                  '$agreedAmountCop',
                  0,
                ],
              },
            },
            events: { $addToSet: '$eventId' },
          },
        },
        {
          $lookup: {
            from: 'providers',
            let: { providerId: '$_id' },
            pipeline: [
              {
                $match: {
                  tenantId: ctx.tenant,
                  $expr: { $eq: ['$_id', '$$providerId'] },
                },
              },
              { $project: { name: 1 } },
            ],
            as: 'provider',
          },
        },
        { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            providerId: { $toString: '$_id' },
            providerName: {
              $ifNull: ['$provider.name', 'Proveedor no disponible'],
            },
            serviceCount: 1,
            confirmedCount: 1,
            cancelledCount: 1,
            confirmedAmountCop: 1,
            eventCount: { $size: '$events' },
          },
        },
      ],
      query,
      { providerName: 1, providerId: 1 },
    );
  }
  async scheduleReport(ctx: Context, query: ReportQuery) {
    this.require(ctx, 'schedules');
    return this.page(
      this.schedules,
      [
        { $match: { tenantId: ctx.tenant } },
        ...this.eventJoin(ctx, query),
        {
          $group: {
            _id: '$eventId',
            eventName: { $first: '$event.name' },
            total: { $sum: 1 },
            pendiente: {
              $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] },
            },
            en_progreso: {
              $sum: { $cond: [{ $eq: ['$status', 'en_progreso'] }, 1, 0] },
            },
            completado: {
              $sum: { $cond: [{ $eq: ['$status', 'completado'] }, 1, 0] },
            },
            cancelado: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelado'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            eventId: { $toString: '$_id' },
            eventName: 1,
            total: 1,
            pendiente: 1,
            en_progreso: 1,
            completado: 1,
            cancelado: 1,
          },
        },
      ],
      query,
      { eventName: 1, eventId: 1 },
    );
  }
  async summary(ctx: Context, query: ReportQuery) {
    this.eventFilter(ctx, query);
    const [events, budgets, inventory] = await Promise.all([
      this.allowed(ctx, 'events') ? this.eventReport(ctx, query) : null,
      this.allowed(ctx, 'budgets') ? this.budgetReport(ctx, query) : null,
      this.allowed(ctx, 'inventory') ? this.inventoryReport(ctx, query) : null,
    ]);
    return {
      events: events
        ? {
            pagination: events.pagination,
            byStatus: events.byStatus,
            invitados: events.invitados,
          }
        : null,
      budgets: budgets?.totals ?? null,
      inventory: inventory?.totals ?? null,
    };
  }
  async report(ctx: Context, kind: string, query: ReportQuery): Promise<Page> {
    if (
      kind === 'inventory' &&
      (query.from ||
        query.to ||
        query.status ||
        query.eventType ||
        query.responsibleUserId ||
        query.eventId ||
        query.includeCancelled)
    ) {
      throw new BadRequestException(
        'El inventario es un estado actual y no admite filtros de evento.',
      );
    }
    if (kind !== 'inventory' && query.inventoryStatus) {
      throw new BadRequestException(
        'El estado de inventario solo se admite en ese reporte.',
      );
    }
    if (
      query.includeCancelled &&
      !['budgets', 'providers', 'inventory'].includes(kind)
    ) {
      throw new BadRequestException(
        'El filtro includeCancelled solo se admite para presupuestos y proveedores.',
      );
    }
    switch (kind) {
      case 'events':
        return this.eventReport(ctx, query);
      case 'budgets':
        return this.budgetReport(ctx, query);
      case 'inventory':
        return this.inventoryReport(ctx, query);
      case 'resources':
        return this.resourceReport(ctx, query);
      case 'providers':
        return this.providerReport(ctx, query);
      case 'schedules':
        return this.scheduleReport(ctx, query);
      default:
        throw new BadRequestException('Tipo de reporte no válido.');
    }
  }
  async csv(ctx: Context, kind: string, query: ReportQuery): Promise<string> {
    const first = await this.report(ctx, kind, {
      ...query,
      page: 1,
      limit: 100,
    });
    if (first.pagination.total > 5000)
      throw new BadRequestException(
        'El reporte supera 5000 filas; reduce los filtros.',
      );
    const rows = [...first.items];
    for (let page = 2; page <= first.pagination.totalPages; page += 1)
      rows.push(
        ...(await this.report(ctx, kind, { ...query, page, limit: 100 })).items,
      );
    const columns: Record<string, string[]> = {
      events: [
        'id',
        'name',
        'type',
        'status',
        'startAt',
        'endAt',
        'responsibleUserId',
        'invitados',
      ],
      budgets: [
        'eventId',
        'eventName',
        'eventStatus',
        'initialized',
        'baseAmountCop',
        'approvedIncreaseCop',
        'allocatedCop',
        'inventorySpentCop',
        'providerSpentCop',
        'extraSpentCop',
        'spentCop',
        'remainingCop',
        'executionPercent',
      ],
      inventory: [
        'id',
        'name',
        'type',
        'status',
        'totalQuantity',
        'availableQuantity',
        'reservedQuantity',
        'lowStock',
      ],
      resources: [
        'id',
        'eventId',
        'eventName',
        'inventoryItemId',
        'inventoryName',
        'quantity',
        'costAmountCop',
        'assignedAt',
        'status',
      ],
      providers: [
        'providerId',
        'providerName',
        'serviceCount',
        'confirmedCount',
        'cancelledCount',
        'confirmedAmountCop',
        'eventCount',
      ],
      schedules: [
        'eventId',
        'eventName',
        'total',
        'pendiente',
        'en_progreso',
        'completado',
        'cancelado',
      ],
    };
    const escape = (value: unknown) => {
      let text =
        value instanceof Date ? value.toISOString() : String(value ?? '');
      if (/^[\s]*[=+\-@\t\r]/.test(text) && typeof value === 'string')
        text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    return (
      '\ufeff' +
      [
        columns[kind].map(escape).join(','),
        ...rows.map((row) =>
          columns[kind].map((key) => escape(row[key])).join(','),
        ),
      ].join('\r\n') +
      '\r\n'
    );
  }
}
