export const TENANT_STATUSES = ['activo', 'inactivo'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const TENANT_OPERATION_MODES = ['propios', 'clientes', 'ambos'] as const;
export type TenantOperationMode = (typeof TENANT_OPERATION_MODES)[number];
