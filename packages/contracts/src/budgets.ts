export const BUDGET_REQUEST_TYPES = ['ampliacion', 'costo_adicional'] as const;
export type BudgetRequestType = (typeof BUDGET_REQUEST_TYPES)[number];

export const BUDGET_REQUEST_STATUSES = [
  'pendiente',
  'aprobada',
  'rechazada',
] as const;
export type BudgetRequestStatus = (typeof BUDGET_REQUEST_STATUSES)[number];

export interface BudgetAmounts {
  baseAmountCop: number | null;
  approvedIncreaseCop: number;
  allocatedCop: number;
  inventorySpentCop: number;
  providerSpentCop: number;
  extraSpentCop: number;
  spentCop: number;
  remainingCop: number;
}

export interface BudgetRequest {
  id: string;
  eventId: string;
  type: BudgetRequestType;
  amountCop: number;
  reason: string;
  status: BudgetRequestStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface BudgetEventSummary extends BudgetAmounts {
  eventId: string;
  eventName: string;
  eventStatus: string;
  initialized: boolean;
}

export interface BudgetOverview {
  totals: Pick<BudgetAmounts, 'allocatedCop' | 'spentCop' | 'remainingCop'>;
  items: BudgetEventSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BudgetInventoryLine {
  id: string;
  inventoryItemId: string;
  name: string;
  quantity: number;
  costAmountCop: number;
  status: 'asignado' | 'devuelto';
  assignedAt: string;
}

export interface BudgetProviderLine {
  id: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  agreedAmountCop: number;
  status: 'confirmado' | 'cancelado';
  startDate: string;
}

export interface EventBudgetDetail extends BudgetEventSummary {
  inventoryLines: BudgetInventoryLine[];
  providerLines: BudgetProviderLine[];
  requests: BudgetRequest[];
}

export interface InitializeEventBudgetRequest {
  baseAmountCop: number;
}

export interface CreateBudgetRequest {
  type: BudgetRequestType;
  amountCop: number;
  reason: string;
}

export interface RejectBudgetRequest {
  reason: string;
}
