export type RoleName =
  'Administrador' | 'Coordinador' | 'Empleado' | 'Proveedor';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
}
