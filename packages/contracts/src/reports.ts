export type ReportKind =
  'events' | 'budgets' | 'inventory' | 'resources' | 'providers' | 'schedules';
export type PdfReportKind = ReportKind | 'event' | 'company' | 'teams';
export type ReportExportFormat = 'csv' | 'pdf';
export interface ReportExportQuery extends ReportQuery {
  format?: ReportExportFormat;
  teamId?: string;
}
export interface ReportQuery {
  from?: string;
  to?: string;
  status?:
    'borrador' | 'planificado' | 'en_progreso' | 'finalizado' | 'cancelado';
  eventType?: string;
  responsibleUserId?: string;
  eventId?: string;
  inventoryStatus?: 'disponible' | 'mantenimiento' | 'inactivo';
  includeCancelled?: boolean;
  page?: number;
  limit?: number;
}
export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface EventReportItem {
  id: string;
  name: string;
  type: string | null;
  status: string;
  startAt: string;
  endAt: string;
  responsibleUserId: string | null;
  invitados: number;
}
export interface BudgetReportItem {
  eventId: string;
  eventName: string;
  eventStatus: string;
  initialized: boolean;
  baseAmountCop: number | null;
  approvedIncreaseCop: number;
  allocatedCop: number;
  inventorySpentCop: number;
  providerSpentCop: number;
  extraSpentCop: number;
  spentCop: number;
  remainingCop: number;
  executionPercent: number | null;
}
export interface InventoryReportItem {
  id: string;
  name: string;
  type: string;
  status: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  lowStock: boolean;
}
export interface ResourceReportItem {
  id: string;
  eventId: string;
  eventName: string;
  inventoryItemId: string;
  inventoryName: string;
  quantity: number;
  costAmountCop: number | null;
  assignedAt: string;
  status: string;
}
export interface ProviderReportItem {
  providerId: string;
  providerName: string;
  serviceCount: number;
  confirmedCount: number;
  cancelledCount: number;
  confirmedAmountCop: number;
  eventCount: number;
}
export interface ScheduleReportItem {
  eventId: string;
  eventName: string;
  total: number;
  pendiente: number;
  en_progreso: number;
  completado: number;
  cancelado: number;
}
export interface ReportPage<T> {
  items: T[];
  pagination: ReportPagination;
}
export interface EventReport extends ReportPage<EventReportItem> {
  byStatus: Record<string, number>;
  invitados: number;
}
export interface BudgetReport extends ReportPage<BudgetReportItem> {
  totals: {
    allocatedCop: number;
    spentCop: number;
    remainingCop: number;
    inventorySpentCop: number;
    providerSpentCop: number;
    extraSpentCop: number;
  };
}
export interface InventoryReport extends ReportPage<InventoryReportItem> {
  totals: {
    resources: number;
    total: number;
    available: number;
    reserved: number;
    maintenance: number;
  };
}
export interface ReportsSummary {
  events: Pick<EventReport, 'pagination' | 'byStatus' | 'invitados'> | null;
  budgets: BudgetReport['totals'] | null;
  inventory: InventoryReport['totals'] | null;
}
