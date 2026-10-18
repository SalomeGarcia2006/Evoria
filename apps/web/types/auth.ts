export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  scope: 'platform' | 'tenant';
  permissions: string[];
}
