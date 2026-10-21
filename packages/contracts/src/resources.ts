export const RESOURCE_STATUSES = [
  'disponible',
  'mantenimiento',
  'inactivo',
] as const;

export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export interface Resource {
  id: string;
  name: string;
  type: string;
  description: string | null;
  unitCost: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  status: ResourceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceRequest {
  name: string;
  type: string;
  description?: string;
  unitCost: number;
  totalQuantity: number;
  status?: ResourceStatus;
}

export interface UpdateResourceRequest {
  name?: string;
  type?: string;
  description?: string | null;
  unitCost?: number;
  totalQuantity?: number;
  status?: ResourceStatus;
}

export interface ResourceList {
  items: Resource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
