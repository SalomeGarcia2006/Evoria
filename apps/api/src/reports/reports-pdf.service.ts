import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Types, type Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { Team } from '../teams/schemas/team.schema';
import { Schedule } from '../schedules/schemas/schedule.schema';
import { Membership } from '../memberships/schemas/membership.schema';
import { User } from '../users/schemas/user.schema';
import { EventProviderService } from '../provider-services/schemas/event-provider-service.schema';
import { Provider } from '../providers/schemas/provider.schema';
import { ReportsService } from './reports.service';
import { ExportReportQuery, ReportQuery } from './reports.dto';
import {
  pdfDate,
  pdfMoney,
  renderReportPdf,
  type PdfCell,
  type PdfMetric,
  type PdfSection,
  type ReportPdfDocument,
} from './report-pdf.renderer';

type Context = Awaited<ReturnType<ReportsService['context']>>;
type Row = Record<string, unknown>;
type Dataset = {
  rows: Row[];
  total: number;
  totals: Record<string, number>;
  byStatus: Record<string, number>;
  invitados: number;
};
const LIMIT = 500;
const sources: Record<string, string[]> = {
  events: ['eventos.ver'],
  budgets: ['eventos.ver', 'presupuestos.ver'],
  inventory: ['inventario.ver'],
  resources: ['eventos.ver', 'inventario.ver', 'asignaciones.ver'],
  providers: ['eventos.ver', 'proveedores.ver', 'servicios_proveedor.ver'],
  schedules: ['eventos.ver', 'cronogramas.ver'],
  teams: ['equipos.ver'],
};
const titles: Record<string, string> = {
  events: 'Portafolio de eventos',
  budgets: 'Ejecución presupuestal',
  inventory: 'Estado del inventario',
  resources: 'Recursos asignados',
  providers: 'Proveedores y servicios',
  schedules: 'Seguimiento de actividades',
  event: 'Ficha de evento',
  company: 'Informe de empresa',
  teams: 'Informe de equipos',
};
const labels: Record<string, string> = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En progreso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  disponible: 'Disponible',
  mantenimiento: 'Mantenimiento',
  inactivo: 'Inactivo',
  activo: 'Activo',
  pendiente: 'Pendiente',
  completado: 'Completado',
  confirmado: 'Confirmado',
  aceptado_sin_saldo: 'Aceptado / sin saldo',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
  asignado: 'Asignado',
};
const text = (value: unknown, fallback = 'No registrado'): string =>
  value === null || value === undefined || value === ''
    ? fallback
    : String(value);
const number = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
const count = (value: number) => new Intl.NumberFormat('es-CO').format(value);
const date = (value: unknown) =>
  value && !Number.isNaN(new Date(value as string).getTime())
    ? pdfDate(value as string)
    : 'No registrado';
const status = (value: unknown) =>
  labels[String(value)] ?? text(value).replace(/_/g, ' ');
const cell = (value: unknown, tone?: PdfCell['tone']): PdfCell => ({
  text: text(value, '-'),
  ...(tone ? { tone } : {}),
});

@Injectable()
export class ReportsPdfService {
  constructor(
    private readonly reports: ReportsService,
    @InjectModel(Tenant.name) private readonly tenants: Model<Tenant>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Team.name) private readonly teams: Model<Team>,
    @InjectModel(Schedule.name) private readonly schedules: Model<Schedule>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(EventProviderService.name)
    private readonly services: Model<EventProviderService>,
    @InjectModel(Provider.name) private readonly providers: Model<Provider>,
  ) {}
  private allowed(ctx: Context, kind: string) {
    return sources[kind].every((key) => ctx.permissions.has(key));
  }
  private require(ctx: Context, permissions: string[]) {
    if (!permissions.every((key) => ctx.permissions.has(key)))
      throw new ForbiddenException('No tienes permisos para este PDF.');
  }
  private bounded<T>(rows: T[]): T[] {
    if (rows.length > LIMIT)
      throw new BadRequestException(
        'El PDF supera 500 registros por sección; reduce los filtros.',
      );
    return rows;
  }
  private async collect(
    ctx: Context,
    kind: string,
    query: ReportQuery,
  ): Promise<Dataset> {
    const first = await this.reports.report(ctx, kind, {
      ...query,
      page: 1,
      limit: 100,
    });
    if (first.pagination.total > LIMIT)
      throw new BadRequestException(
        'El PDF supera 500 registros por sección; reduce los filtros.',
      );
    const rows = [...first.items];
    for (let page = 2; page <= first.pagination.totalPages; page++)
      rows.push(
        ...(
          await this.reports.report(ctx, kind, { ...query, page, limit: 100 })
        ).items,
      );
    this.bounded(rows);
    const summary = first as typeof first & {
      totals?: Record<string, number>;
      byStatus?: Record<string, number>;
      invitados?: number;
    };
    return {
      rows,
      total: first.pagination.total,
      totals: summary.totals ?? {},
      byStatus: summary.byStatus ?? {},
      invitados: summary.invitados ?? 0,
    };
  }
  private scope(query: ReportQuery): string[] {
    return [
      query.from ? `Desde ${date(query.from)}` : '',
      query.to ? `Hasta ${date(query.to)}` : '',
      query.status ? `Estado: ${status(query.status)}` : '',
      query.eventType ? `Tipo: ${query.eventType}` : '',
      query.eventId ? `Evento: ${query.eventId}` : '',
      query.responsibleUserId ? 'Filtrado por responsable' : '',
      query.inventoryStatus
        ? `Inventario: ${status(query.inventoryStatus)}`
        : '',
      query.includeCancelled ? 'Incluye eventos cancelados' : '',
    ].filter(Boolean);
  }
  private queryFor(kind: string, query: ReportQuery): ReportQuery {
    if (kind === 'inventory')
      return Object.assign(new ReportQuery(), {
        inventoryStatus: query.inventoryStatus,
      });
    const result = Object.assign(new ReportQuery(), query);
    delete result.inventoryStatus;
    return result;
  }
  private present(
    kind: string,
    data: Dataset,
    ctx: Context,
  ): { metrics: PdfMetric[]; sections: PdfSection[] } {
    const rows = data.rows,
      financial = ctx.permissions.has('presupuestos.ver');
    const metric = (
      label: string,
      value: number,
      note?: string,
    ): PdfMetric => ({ label, value: count(value), note });
    if (kind === 'events')
      return {
        metrics: [
          metric('Eventos', data.total),
          metric('Planificados', data.byStatus.planificado ?? 0),
          metric('En progreso', data.byStatus.en_progreso ?? 0),
          metric('Invitados registrados', data.invitados),
        ],
        sections: [
          {
            kind: 'table',
            title: 'Portafolio de eventos',
            columns: [
              { label: 'Evento / tipo', weight: 2.5 },
              { label: 'Estado', weight: 1.2 },
              { label: 'Inicio programado', weight: 1.8 },
              { label: 'Invitados', weight: 0.8, align: 'right' },
            ],
            rows: rows.map((r) => [
              cell(`${text(r.name)}\n${text(r.type, 'Sin tipo')}`),
              cell(status(r.status)),
              cell(date(r.startAt)),
              cell(count(number(r.invitados))),
            ]),
            note: 'Invitados registrados no equivale a asistencia efectiva. Fechas expresadas en Bogotá (UTC-05).',
          },
        ],
      };
    if (kind === 'budgets')
      return {
        metrics: [
          {
            label: 'Presupuesto asignado',
            value: pdfMoney(data.totals.allocatedCop ?? 0),
            note: 'COP',
          },
          {
            label: 'Gasto registrado',
            value: pdfMoney(data.totals.spentCop ?? 0),
            note: 'COP',
          },
          {
            label: 'Saldo disponible',
            value: pdfMoney(data.totals.remainingCop ?? 0),
            note: 'COP',
          },
          metric('Con presupuesto', rows.filter((r) => r.initialized).length),
        ],
        sections: [
          {
            kind: 'budget',
            title: 'Lectura financiera',
            allocated: data.totals.allocatedCop ?? 0,
            spent: data.totals.spentCop ?? 0,
            remaining: data.totals.remainingCop ?? 0,
          },
          {
            kind: 'table',
            title: 'Presupuesto por evento',
            columns: [
              { label: 'Evento', weight: 2.1 },
              { label: 'Asignado COP', weight: 1.2, align: 'right' },
              { label: 'Gasto COP', weight: 1.2, align: 'right' },
              { label: 'Saldo COP', weight: 1.2, align: 'right' },
              { label: 'Ejecución', weight: 0.8, align: 'right' },
            ],
            rows: rows.map((r) => [
              cell(`${text(r.eventName)}\n${status(r.eventStatus)}`),
              cell(
                r.initialized
                  ? pdfMoney(number(r.allocatedCop))
                  : 'Sin inicializar',
                r.initialized ? undefined : 'muted',
              ),
              cell(r.initialized ? pdfMoney(number(r.spentCop)) : '-'),
              cell(r.initialized ? pdfMoney(number(r.remainingCop)) : '-'),
              cell(
                r.executionPercent === null
                  ? '-'
                  : `${count(number(r.executionPercent))} %`,
              ),
            ]),
            note: 'Los totales proceden de Presupuestos. El gasto registrado no acredita pagos, facturación ni utilidad. Sin presupuesto inicial o con asignado cero no se calcula porcentaje.',
          },
          {
            kind: 'fields',
            title: 'Composición del gasto registrado',
            items: [
              {
                label: 'Inventario',
                value: `${pdfMoney(data.totals.inventorySpentCop ?? 0)} COP`,
              },
              {
                label: 'Servicios de proveedor',
                value: `${pdfMoney(data.totals.providerSpentCop ?? 0)} COP`,
              },
              {
                label: 'Costos adicionales',
                value: `${pdfMoney(data.totals.extraSpentCop ?? 0)} COP`,
              },
            ],
          },
        ],
      };
    if (kind === 'inventory')
      return {
        metrics: [
          metric('Referencias', data.total),
          metric('Unidades totales', data.totals.total ?? 0),
          metric('Disponibles', data.totals.available ?? 0),
          metric('Reservadas', data.totals.reserved ?? 0),
        ],
        sections: [
          {
            kind: 'table',
            title: 'Disponibilidad de inventario',
            columns: [
              { label: 'Recurso', weight: 2.4 },
              { label: 'Tipo', weight: 1.4 },
              { label: 'Estado', weight: 1.5 },
              { label: 'Total', weight: 0.7, align: 'right' },
              { label: 'Disp.', weight: 0.7, align: 'right' },
              { label: 'Res.', weight: 0.7, align: 'right' },
            ],
            rows: rows.map((r) => [
              cell(r.name),
              cell(r.type),
              cell(
                `${status(r.status)}${r.lowStock ? '\nStock bajo' : ''}`,
                r.lowStock ? 'warning' : undefined,
              ),
              cell(count(number(r.totalQuantity))),
              cell(count(number(r.availableQuantity))),
              cell(count(number(r.reservedQuantity))),
            ]),
            note: `Estado actual del inventario; no es un historial de movimientos. Disponibles excluye recursos en mantenimiento (${count(data.totals.maintenance ?? 0)} referencias). La alerta de stock utiliza el umbral configurado en el backend.`,
          },
        ],
      };
    if (kind === 'resources')
      return {
        metrics: [
          metric('Asignaciones activas', data.total),
          metric(
            'Unidades asignadas',
            rows.reduce((sum, r) => sum + number(r.quantity), 0),
          ),
          metric('Eventos incluidos', new Set(rows.map((r) => r.eventId)).size),
        ],
        sections: [
          {
            kind: 'table',
            title: 'Recursos actualmente asignados',
            columns: [
              { label: 'Evento', weight: 2 },
              { label: 'Recurso', weight: 2 },
              { label: 'Cantidad', weight: 0.8, align: 'right' },
              ...(financial
                ? [{ label: 'Costo COP', weight: 1.2, align: 'right' as const }]
                : []),
            ],
            rows: rows.map((r) => [
              cell(r.eventName),
              cell(r.inventoryName),
              cell(count(number(r.quantity))),
              ...(financial
                ? [
                    cell(
                      r.costAmountCop === null
                        ? 'Sin registro'
                        : pdfMoney(number(r.costAmountCop)),
                    ),
                  ]
                : []),
            ]),
            note: 'Se incluyen solo asignaciones activas. Un costo sin registro no se sustituye por el precio actual del inventario.',
          },
        ],
      };
    if (kind === 'providers')
      return {
        metrics: [
          metric('Proveedores', data.total),
          metric(
            'Servicios registrados',
            rows.reduce((s, r) => s + number(r.serviceCount), 0),
          ),
          metric(
            'Servicios confirmados',
            rows.reduce((s, r) => s + number(r.confirmedCount), 0),
          ),
          ...(financial
            ? [
                {
                  label: 'Monto confirmado',
                  value: pdfMoney(
                    rows.reduce((s, r) => s + number(r.confirmedAmountCop), 0),
                  ),
                  note: 'COP',
                },
              ]
            : []),
        ],
        sections: [
          {
            kind: 'table',
            title: 'Servicios por proveedor',
            columns: [
              { label: 'Proveedor', weight: 2.5 },
              { label: 'Servicios', weight: 0.9, align: 'right' },
              { label: 'Confirmados', weight: 1, align: 'right' },
              { label: 'Cancelados', weight: 1, align: 'right' },
              ...(financial
                ? [
                    {
                      label: 'Confirmado COP',
                      weight: 1.5,
                      align: 'right' as const,
                    },
                  ]
                : []),
            ],
            rows: rows.map((r) => [
              cell(r.providerName),
              cell(count(number(r.serviceCount))),
              cell(count(number(r.confirmedCount))),
              cell(count(number(r.cancelledCount))),
              ...(financial
                ? [cell(pdfMoney(number(r.confirmedAmountCop)))]
                : []),
            ]),
            note: 'El monto incluye únicamente servicios confirmados y no acredita pagos. El total de servicios puede incluir solicitudes pendientes, rechazadas o vencidas.',
          },
        ],
      };
    return {
      metrics: [
        metric('Eventos', data.total),
        metric(
          'Actividades',
          rows.reduce((s, r) => s + number(r.total), 0),
        ),
        metric(
          'Completadas',
          rows.reduce((s, r) => s + number(r.completado), 0),
        ),
        metric(
          'En progreso',
          rows.reduce((s, r) => s + number(r.en_progreso), 0),
        ),
      ],
      sections: [
        {
          kind: 'table',
          title: 'Estado del cronograma por evento',
          columns: [
            { label: 'Evento', weight: 2.7 },
            { label: 'Total', weight: 0.7, align: 'right' },
            { label: 'Pendientes', weight: 1, align: 'right' },
            { label: 'En progreso', weight: 1, align: 'right' },
            { label: 'Completadas', weight: 1.1, align: 'right' },
            { label: 'Canceladas', weight: 1, align: 'right' },
          ],
          rows: rows.map((r) => [
            cell(r.eventName),
            cell(count(number(r.total))),
            cell(count(number(r.pendiente))),
            cell(count(number(r.en_progreso))),
            cell(count(number(r.completado))),
            cell(count(number(r.cancelado))),
          ]),
          note: 'Se incluyen eventos que tienen actividades. Los estados no certifican asistencia ni duración real del trabajo.',
        },
      ],
    };
  }
  private async userNames(
    ctx: Context,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (!ctx.permissions.has('usuarios.ver') || !ids.length) return new Map();
    const members = await this.memberships
      .find({ tenantId: ctx.tenant, userId: { $in: ids }, status: 'activo' })
      .select('userId')
      .lean();
    const users = await this.users
      .find({ _id: { $in: members.map((m) => m.userId) }, status: 'activo' })
      .select('name')
      .lean();
    return new Map(users.map((user) => [user._id.toString(), user.name]));
  }
  private async teamContent(
    ctx: Context,
    teamId?: string,
  ): Promise<{ metrics: PdfMetric[]; sections: PdfSection[] }> {
    this.require(ctx, sources.teams);
    const teams = this.bounded(
      await this.teams
        .find({ tenantId: ctx.tenant, ...(teamId ? { _id: teamId } : {}) })
        .sort({ name: 1, _id: 1 })
        .limit(LIMIT + 1)
        .lean(),
    );
    if (teamId && !teams.length)
      throw new NotFoundException('El equipo no existe.');
    const names = await this.userNames(
      ctx,
      teams.flatMap((team) => [
        ...team.memberIds.map(String),
        team.leaderId.toString(),
      ]),
    );
    const sections: PdfSection[] = [
      {
        kind: 'table',
        title: teamId ? 'Identificación del equipo' : 'Equipos de la empresa',
        columns: [
          { label: 'Equipo / especialidad', weight: 2.7 },
          { label: 'Estado', weight: 1 },
          { label: 'Integrantes', weight: 0.9, align: 'right' },
          { label: 'Líder', weight: 1.7 },
        ],
        rows: teams.map((team) => [
          cell(`${team.name}\n${team.specialty}`),
          cell(status(team.status)),
          cell(count(team.memberIds.length)),
          cell(
            ctx.permissions.has('usuarios.ver')
              ? (names.get(team.leaderId.toString()) ?? 'Usuario no disponible')
              : 'Asignado',
          ),
        ]),
        note: 'Integrantes registrados por equipo; los vínculos de equipos inactivos no representan asignación actual.',
      },
    ];
    if (teamId && ctx.permissions.has('usuarios.ver'))
      sections.push({
        kind: 'table',
        title: 'Integrantes del equipo',
        columns: [
          { label: 'Nombre', weight: 3 },
          { label: 'Función', weight: 1 },
        ],
        rows: teams[0].memberIds.map((id) => [
          cell(names.get(id.toString()) ?? 'Usuario no disponible'),
          cell(
            id.toString() === teams[0].leaderId.toString()
              ? 'Líder'
              : 'Integrante',
          ),
        ]),
        note: 'Los nombres solo se incluyen para usuarios activos con membresía activa en esta empresa. No se exportan correos ni credenciales.',
      });
    if (teamId && this.allowed(ctx, 'schedules')) {
      const tasks = this.bounded(
        await this.schedules.aggregate<Row>([
          {
            $match: {
              tenantId: ctx.tenant,
              teamId: new Types.ObjectId(teamId),
            },
          },
          {
            $lookup: {
              from: 'events',
              let: { eventId: '$eventId' },
              pipeline: [
                {
                  $match: {
                    tenantId: ctx.tenant,
                    $expr: { $eq: ['$_id', '$$eventId'] },
                  },
                },
                { $project: { name: 1 } },
              ],
              as: 'event',
            },
          },
          { $unwind: '$event' },
          { $sort: { startAt: 1, _id: 1 } },
          { $limit: LIMIT + 1 },
          {
            $project: {
              name: 1,
              startAt: 1,
              endAt: 1,
              status: 1,
              eventName: '$event.name',
            },
          },
        ]),
      );
      sections.push(this.activityTable(tasks));
    }
    return {
      metrics: [
        { label: 'Equipos', value: count(teams.length) },
        {
          label: 'Activos',
          value: count(teams.filter((t) => t.status === 'activo').length),
        },
        {
          label: 'Vínculos de integrantes',
          value: count(teams.reduce((sum, t) => sum + t.memberIds.length, 0)),
        },
      ],
      sections,
    };
  }
  private activityTable(rows: Row[]): PdfSection {
    const names = [...new Set(rows.map((r) => r.eventName).filter(Boolean))];
    const commonEvent = names.length === 1 ? text(names[0]) : null;
    return {
      kind: 'table',
      title: 'Detalle de actividades programadas',
      ...(commonEvent ? { intro: `Evento: ${commonEvent}` } : {}),
      columns: [
        {
          label:
            commonEvent || !names.length ? 'Actividad' : 'Actividad / evento',
          weight: 2.8,
        },
        { label: 'Estado', weight: 1.1 },
        { label: 'Inicio', weight: 1.5 },
        { label: 'Fin', weight: 1.5 },
      ],
      rows: rows.map((r) => [
        cell(
          `${text(r.name)}${r.eventName && !commonEvent ? `\n${text(r.eventName)}` : ''}`,
        ),
        cell(status(r.status)),
        cell(date(r.startAt)),
        cell(date(r.endAt)),
      ]),
      note: 'Las fechas son programadas y se expresan en Bogotá (UTC-05).',
    };
  }
  private async eventContent(
    ctx: Context,
    eventId: string,
  ): Promise<{ metrics: PdfMetric[]; sections: PdfSection[] }> {
    this.require(ctx, sources.events);
    const event = await this.events
      .findOne({ _id: eventId, tenantId: ctx.tenant })
      .lean();
    if (!event) throw new NotFoundException('El evento no existe.');
    const names = await this.userNames(
      ctx,
      event.responsibleUserId ? [event.responsibleUserId.toString()] : [],
    );
    const sections: PdfSection[] = [
      {
        kind: 'fields',
        title: 'Información del evento',
        items: [
          { label: 'Evento', value: event.name },
          { label: 'Estado', value: status(event.status) },
          { label: 'Inicio programado', value: date(event.startAt) },
          { label: 'Fin programado', value: date(event.endAt) },
          { label: 'Tipo', value: text(event.type) },
          { label: 'Ubicación', value: text(event.location) },
          {
            label: 'Responsable',
            value: event.responsibleUserId
              ? ctx.permissions.has('usuarios.ver')
                ? (names.get(event.responsibleUserId.toString()) ??
                  'Usuario no disponible')
                : 'Asignado'
              : 'Sin responsable',
          },
          {
            label: 'Invitados registrados',
            value: count(event.invitados ?? 0),
          },
        ],
      },
    ];
    if (event.description)
      sections.push({
        kind: 'text',
        title: 'Descripción y alcance',
        body: event.description,
      });
    let metrics: PdfMetric[] = [
      {
        label: 'Invitados registrados',
        value: count(event.invitados ?? 0),
        note: 'No equivale a asistencia',
      },
    ];
    const query = Object.assign(new ReportQuery(), {
      eventId,
      includeCancelled: true,
    });
    if (this.allowed(ctx, 'budgets')) {
      const data = await this.collect(ctx, 'budgets', query);
      if (data.rows[0]?.initialized) {
        const budget = this.present('budgets', data, ctx);
        metrics = [...budget.metrics.slice(0, 3), ...metrics];
        sections.push(...budget.sections.filter((s) => s.kind !== 'table'));
      } else
        sections.push({
          kind: 'notice',
          title: 'Presupuesto',
          body: 'Este evento no tiene presupuesto inicializado. No se presenta un saldo ni porcentaje de ejecución ficticio.',
        });
    }
    if (this.allowed(ctx, 'resources'))
      sections.push(
        ...this.present(
          'resources',
          await this.collect(
            ctx,
            'resources',
            Object.assign(new ReportQuery(), { eventId }),
          ),
          ctx,
        ).sections,
      );
    if (this.allowed(ctx, 'providers')) {
      const services = this.bounded(
        await this.services
          .find({ tenantId: ctx.tenant, eventId })
          .select('providerId serviceName status startDate agreedAmountCop')
          .sort({ startDate: 1, _id: 1 })
          .limit(LIMIT + 1)
          .lean(),
      );
      const providers = await this.providers
        .find({
          tenantId: ctx.tenant,
          _id: { $in: services.map((s) => s.providerId) },
        })
        .select('name')
        .lean();
      const providerNames = new Map(
        providers.map((p) => [p._id.toString(), p.name]),
      );
      const financial = ctx.permissions.has('presupuestos.ver');
      sections.push({
        kind: 'table',
        title: 'Servicios solicitados al proveedor',
        columns: [
          { label: 'Servicio / proveedor', weight: 2.7 },
          { label: 'Estado', weight: 1.5 },
          { label: 'Fecha', weight: 1 },
          ...(financial
            ? [{ label: 'Acuerdo COP', weight: 1.3, align: 'right' as const }]
            : []),
        ],
        rows: services.map((s) => [
          cell(
            `${s.serviceName}\n${providerNames.get(s.providerId.toString()) ?? 'Proveedor no disponible'}`,
          ),
          cell(status(s.status), s.status === 'confirmado' ? 'teal' : 'muted'),
          cell(s.startDate),
          ...(financial ? [cell(pdfMoney(s.agreedAmountCop))] : []),
        ]),
        note: 'El monto acordado de una solicitud pendiente, rechazada, vencida o cancelada no representa un cargo vigente. Solo servicios confirmados están asignados.',
      });
    }
    if (this.allowed(ctx, 'schedules')) {
      const tasks = this.bounded(
        await this.schedules
          .find({ tenantId: ctx.tenant, eventId })
          .select('name status startAt endAt')
          .sort({ startAt: 1, _id: 1 })
          .limit(LIMIT + 1)
          .lean(),
      );
      sections.push(this.activityTable(tasks as unknown as Row[]));
    }
    sections.push({
      kind: 'notice',
      title: 'Lectura del documento',
      body: 'Este documento reúne únicamente las secciones autorizadas para el usuario. El gasto registrado no acredita pagos ni facturación. Los eventos cancelados conservan su historial financiero.',
    });
    return { metrics, sections };
  }
  private async companyContent(
    ctx: Context,
    query: ReportQuery,
    company: Tenant,
  ): Promise<{ metrics: PdfMetric[]; sections: PdfSection[] }> {
    this.require(ctx, ['empresa_contexto.ver']);
    const sections: PdfSection[] = [
      {
        kind: 'fields',
        title: 'Identidad empresarial',
        items: [
          { label: 'Razón social', value: company.name },
          { label: 'NIT', value: company.nit },
          { label: 'Sector', value: text(company.sector) },
          {
            label: 'Modelo operativo',
            value: text(company.operationMode).replace(/_/g, ' '),
          },
        ],
      },
    ];
    if (company.operationalDescription)
      sections.push({
        kind: 'text',
        title: 'Contexto operativo',
        body: company.operationalDescription,
      });
    if (company.eventTypes?.length)
      sections.push({
        kind: 'text',
        title: 'Tipos de evento de la empresa',
        body: company.eventTypes.join(' / '),
      });
    if (company.operationalAreas?.length)
      sections.push({
        kind: 'table',
        title: 'Áreas y responsabilidades',
        columns: [
          { label: 'Área', weight: 1.3 },
          { label: 'Descripción', weight: 2 },
          { label: 'Responsabilidades', weight: 2.5 },
        ],
        rows: this.bounded(company.operationalAreas).map((area) => [
          cell(area.name),
          cell(area.description),
          cell(area.responsibilities.join('; ')),
        ]),
      });
    if (company.operationalNotes)
      sections.push({
        kind: 'text',
        title: 'Notas operativas',
        body: company.operationalNotes,
      });
    const metrics: PdfMetric[] = [];
    for (const kind of [
      'events',
      'budgets',
      'inventory',
      'teams',
      'providers',
      'schedules',
    ]) {
      if (!this.allowed(ctx, kind)) continue;
      const content =
        kind === 'teams'
          ? await this.teamContent(ctx)
          : this.present(
              kind,
              await this.collect(ctx, kind, this.queryFor(kind, query)),
              ctx,
            );
      if (kind === 'events' || kind === 'inventory')
        metrics.push(content.metrics[0]);
      if (kind === 'budgets') metrics.push(content.metrics[0]);
      if (kind === 'teams') metrics.push(content.metrics[0]);
      sections.push(...content.sections);
    }
    sections.push({
      kind: 'notice',
      title: 'Alcance del informe',
      body: 'Secciones incluidas según los permisos actuales. Los filtros de fechas, estado y responsable se aplican a eventos. Inventario y equipos muestran su situación actual. No se exportan contraseñas, tokens de registro, claves de empresa ni correos de integrantes.',
    });
    return { metrics: metrics.slice(0, 4), sections };
  }
  async document(
    kind: string,
    query: ExportReportQuery,
    user: AuthenticatedUser,
  ): Promise<ReportPdfDocument> {
    const ctx = await this.reports.context(user);
    if (!Object.hasOwn(titles, kind))
      throw new BadRequestException('Tipo de PDF no válido.');
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la final.',
      );
    if (query.teamId && kind !== 'teams')
      throw new BadRequestException('teamId solo se admite para equipos.');
    const eventFilters =
      query.from ||
      query.to ||
      query.status ||
      query.eventType ||
      query.responsibleUserId ||
      query.inventoryStatus;
    if (kind === 'event' && (!query.eventId || eventFilters))
      throw new BadRequestException(
        'La ficha de evento requiere eventId y no admite filtros de listado.',
      );
    if (
      kind === 'teams' &&
      (eventFilters || query.eventId || query.includeCancelled)
    )
      throw new BadRequestException(
        'El PDF de equipos solo admite teamId como filtro.',
      );
    const company = await this.tenants
      .findOne({ _id: ctx.tenant, status: 'activo' })
      .select(
        'name nit sector operationMode operationalDescription operationalAreas eventTypes operationalNotes',
      )
      .lean();
    if (!company) throw new NotFoundException('La empresa no está disponible.');
    let content: { metrics: PdfMetric[]; sections: PdfSection[] };
    if (kind === 'event')
      content = await this.eventContent(ctx, query.eventId!);
    else if (kind === 'company')
      content = await this.companyContent(ctx, query, company);
    else if (kind === 'teams')
      content = await this.teamContent(ctx, query.teamId);
    else
      content = this.present(kind, await this.collect(ctx, kind, query), ctx);
    const generatedAt = new Date();
    const reference = `EV-${generatedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const document: ReportPdfDocument = {
      title:
        kind === 'teams' && query.teamId ? 'Ficha de equipo' : titles[kind],
      subtitle:
        kind === 'company'
          ? 'Una visión integrada de la operación y los recursos de la empresa.'
          : kind === 'event'
            ? 'Detalle operativo y financiero según los permisos de consulta.'
            : 'Información clara para el seguimiento y la toma de decisiones.',
      company: company.name,
      ...(ctx.permissions.has('empresa_contexto.ver')
        ? { nit: company.nit }
        : {}),
      reference,
      generatedAt,
      generatedBy: user.name,
      filters:
        kind === 'teams'
          ? ['Equipos registrados en la empresa activa']
          : kind === 'event'
            ? [`Referencia del evento: ${query.eventId}`]
            : this.scope(query),
      metrics: content.metrics,
      sections: content.sections,
    };
    return document;
  }
  async export(
    kind: string,
    query: ExportReportQuery,
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const document = await this.document(kind, query, user);
    const buffer = await renderReportPdf(document);
    return {
      buffer,
      filename: `evoria-${kind}-${document.generatedAt.toISOString().slice(0, 10)}.pdf`,
    };
  }
}
