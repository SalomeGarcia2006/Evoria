import { apiRequest } from './api';
import type { AuthUser } from '../types/auth';
import type { ApiResponse, AuthSession, LoginRequest } from '@evoria/contracts';

export type LoginPayload = LoginRequest;

const DEVELOPER_EMAIL = 'administrador@evoria.com';

function toAuthUser(session: AuthSession): AuthUser {
  // UI hint only: the API authorizes every join/leave request independently.
  // Tenant sessions expose the Administrator profile, not the global profile.
  // shortcut: only the seeded administrator gets the visual hint, replace when AuthSession exposes developer status.
  const storageKey = `evoria:developer:${session.user.id}`;
  let isDeveloper =
    session.user.email.toLowerCase() === DEVELOPER_EMAIL ||
    (session.scope === 'platform' && session.profile.name === 'Desarrollador');
  try {
    if (session.scope === 'platform') {
      if (isDeveloper) sessionStorage.setItem(storageKey, 'true');
      else sessionStorage.removeItem(storageKey);
    } else {
      isDeveloper ||= sessionStorage.getItem(storageKey) === 'true';
    }
  } catch {
    // Storage may be unavailable; the provider also preserves this hint on join.
  }
  return {
    isDeveloper,
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

export async function changeTenant(tenantId: string | null): Promise<AuthUser> {
  const response = await apiRequest<ApiResponse<AuthSession>>(
    tenantId
      ? `/tenants/${encodeURIComponent(tenantId)}/join`
      : '/tenants/leave',
    { method: 'POST', credentials: 'include' },
  );
  return toAuthUser(response.data);
}
