export type AuthScope = 'platform' | 'tenant';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  scope: AuthScope;
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
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  membership?: {
    id: string;
  };
  permissions: string[];
}
