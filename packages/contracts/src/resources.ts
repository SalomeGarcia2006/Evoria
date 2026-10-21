export const INVENTORY_STATUSES = [
  'disponible',
  'mantenimiento',
  'inactivo',
] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const RESOURCE_ASSIGNMENT_STATUSES = ['asignado', 'devuelto'] as const;

export type ResourceAssignmentStatus =
  (typeof RESOURCE_ASSIGNMENT_STATUSES)[number];

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  description: string | null;
  unitCost: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemRequest {
  name: string;
  type: string;
  description?: string;
  unitCost: number;
  totalQuantity: number;
  status?: InventoryStatus;
}

export interface UpdateInventoryItemRequest {
  name?: string;
  type?: string;
  description?: string | null;
  unitCost?: number;
  totalQuantity?: number;
  status?: InventoryStatus;
}

export interface InventoryList {
  items: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EventResourceAssignment {
  id: string;
  eventId: string;
  inventoryItemId: string;
  quantity: number;
  status: ResourceAssignmentStatus;
  assignedAt: string;
  returnedAt: string | null;
  inventoryItem: Pick<
    InventoryItem,
    'id' | 'name' | 'type' | 'unitCost' | 'availableQuantity'
  >;
}

export interface CreateEventResourceRequest {
  inventoryItemId: string;
  quantity: number;
}

// Aliases kept for consumers that still call inventory items "resources".
export type Resource = InventoryItem;
export type ResourceStatus = InventoryStatus;
export type ResourceList = InventoryList;
export type CreateResourceRequest = CreateInventoryItemRequest;
export type UpdateResourceRequest = UpdateInventoryItemRequest;
export const RESOURCE_STATUSES = INVENTORY_STATUSES;
