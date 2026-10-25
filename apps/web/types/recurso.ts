export type ResourceStatus = 'disponible' | 'mantenimiento' | 'inactivo';
export interface Recurso {
  id: string;
  name: string;
  type: string;
  description?: string;
  unitCost: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  status: ResourceStatus;
  createdAt: string;
  updatedAt: string;
}

export type ResourcePayload = Pick<
  Recurso,
  'name' | 'type' | 'description' | 'unitCost' | 'totalQuantity' | 'status'
>;
export const resourceStatusLabels: Record<ResourceStatus, string> = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  inactivo: 'Inactivo',
};
