export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export type { ApiResponse } from './api';
export type { AuthScope, AuthSession, LoginRequest } from './auth';
export type {
  CreateResourceRequest,
  Resource,
  ResourceList,
  ResourceStatus,
  UpdateResourceRequest,
} from './resources';
export { RESOURCE_STATUSES } from './resources';
