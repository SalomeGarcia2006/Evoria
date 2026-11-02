export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export type { ApiResponse } from './api';
export type { AuthScope, AuthSession, LoginRequest } from './auth';
export type {
  CreateProviderRequest,
  Provider,
  ProviderCategory,
  ProviderList,
  ProviderListQuery,
  ProviderStatus,
  UpdateProviderRequest,
} from './providers';
export { PROVIDER_CATEGORIES, PROVIDER_STATUSES } from './providers';
export type {
  CreateEventProviderServiceRequest,
  EventProviderService,
  EventProviderServicesQuery,
  ProviderServiceStatus,
  UpdateEventProviderServiceRequest,
} from './provider-services';
export { PROVIDER_SERVICE_STATUSES } from './provider-services';
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
