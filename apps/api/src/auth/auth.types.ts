import type { Request } from 'express';

export interface JwtTokenPayload {
  sub: string;
  email: string;
  jti?: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  profileId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
