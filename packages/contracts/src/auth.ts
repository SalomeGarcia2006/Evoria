export type AuthScope = 'platform' | 'tenant';

export interface LoginRequest {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface AuthSession {
  scope: AuthScope;
  isDeveloper: boolean;
  pendingProfile?: boolean;
  user: {
    id: string;
    name: string;
    lastName?: string | null;
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
