import { apiRequest } from './api';
import type { AuthUser } from '../types/auth';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

interface ApiSession {
  scope: 'platform' | 'tenant';
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  profile: {
    id: string;
    name: string;
  };
  permissions: string[];
}

function toAuthUser(session: ApiSession): AuthUser {
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.profile.name,
  };
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await apiRequest<ApiResponse<ApiSession>>('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return toAuthUser(response.data);
}

export async function getCurrentUser(): Promise<AuthUser> {
  try {
    const response = await apiRequest<ApiResponse<ApiSession>>('/auth/me', {
      credentials: 'include',
    });

    return toAuthUser(response.data);
  } catch {
    await apiRequest<ApiResponse<ApiSession>>('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    const response = await apiRequest<ApiResponse<ApiSession>>('/auth/me', {
      credentials: 'include',
    });

    return toAuthUser(response.data);
  }
}

export async function logout(): Promise<void> {
  await apiRequest<ApiResponse<null>>('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
