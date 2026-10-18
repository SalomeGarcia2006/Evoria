export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export type { ApiResponse } from './api';
export type { AuthScope, AuthSession, LoginRequest } from './auth';
