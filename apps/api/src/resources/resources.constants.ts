export const RESOURCE_STATUSES = [
  'disponible',
  'mantenimiento',
  'inactivo',
] as const;

export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
