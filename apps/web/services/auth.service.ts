import { apiRequest } from './api';
import type { AuthUser } from '../types/auth';
import type { ApiResponse, AuthSession, LoginRequest } from '@evoria/contracts';

export type LoginPayload = LoginRequest;

function toAuthUser(session: AuthSession): AuthUser {
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.profile.name,
    scope: session.scope,
    tenant: session.tenant,
    membershipId: session.membership?.id,
    permissions: session.permissions,
  };
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await apiRequest<ApiResponse<AuthSession>>('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return toAuthUser(response.data);
}

export async function getCurrentUser(): Promise<AuthUser> {
  try {
    const response = await apiRequest<ApiResponse<AuthSession>>('/auth/me', {
      credentials: 'include',
    });

    return toAuthUser(response.data);
  } catch {
    await apiRequest<ApiResponse<AuthSession>>('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    const response = await apiRequest<ApiResponse<AuthSession>>('/auth/me', {
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
