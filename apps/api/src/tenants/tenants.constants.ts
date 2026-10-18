export const TENANT_STATUSES = ['activo', 'inactivo'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];
