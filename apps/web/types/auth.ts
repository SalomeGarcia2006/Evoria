export interface AuthUser {
  isDeveloper: boolean;
  id: string;
  name: string;
  email: string;
  role: string;
  scope: 'platform' | 'tenant';
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  membershipId?: string;
  permissions: string[];
}
