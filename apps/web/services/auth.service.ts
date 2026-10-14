import type { AuthUser } from '../types/auth';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token?: string;
}
