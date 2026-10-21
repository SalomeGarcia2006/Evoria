export const INVENTORY_STATUSES = [
  'disponible',
  'mantenimiento',
  'inactivo',
] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
