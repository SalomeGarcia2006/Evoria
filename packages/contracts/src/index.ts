export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export type { ApiResponse } from './api';
export type { AuthScope, AuthSession, LoginRequest } from './auth';
export type {
  CreateEventResourceRequest,
  CreateInventoryItemRequest,
  CreateResourceRequest,
  EventResourceAssignment,
  InventoryItem,
  InventoryList,
  InventoryStatus,
  Resource,
  ResourceAssignmentStatus,
  ResourceList,
  ResourceStatus,
  UpdateInventoryItemRequest,
  UpdateResourceRequest,
} from './resources';
export {
  INVENTORY_STATUSES,
  RESOURCE_ASSIGNMENT_STATUSES,
  RESOURCE_STATUSES,
} from './resources';
