export type DashboardEventStatus =
  'borrador' | 'planificado' | 'en_progreso' | 'finalizado' | 'cancelado';

export interface DashboardEventSummary {
  total: number;
  active: number;
  byStatus: Record<DashboardEventStatus, number>;
  upcoming: Array<{
    id: string;
    name: string;
    startAt: string;
    endAt: string;
    status: DashboardEventStatus;
  }>;
}

export interface DashboardInventorySummary {
  resources: number;
  total: number;
  available: number;
  reserved: number;
  maintenance: number;
}

export interface DashboardBudgetSummary {
  allocatedCop: number;
  spentCop: number;
  remainingCop: number;
}

export interface DashboardSummary {
  events: DashboardEventSummary | null;
  inventory: DashboardInventorySummary | null;
  budgets: DashboardBudgetSummary | null;
}
