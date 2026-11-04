export const BUDGET_REQUEST_TYPES = ['ampliacion', 'costo_adicional'] as const;
export type BudgetRequestType = (typeof BUDGET_REQUEST_TYPES)[number];

export const BUDGET_REQUEST_STATUSES = [
  'pendiente',
  'aprobada',
  'rechazada',
] as const;
export type BudgetRequestStatus = (typeof BUDGET_REQUEST_STATUSES)[number];
