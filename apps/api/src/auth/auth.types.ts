import type { Request } from 'express';

export interface JwtTokenPayload {
  sub: string;
  email: string;
  scope: 'platform' | 'tenant';
  profileId: string;
  tenantId?: string;
  membershipId?: string;
  jti?: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  scope: 'platform' | 'tenant';
  profileId: string;
  tenantId?: string;
  membershipId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
