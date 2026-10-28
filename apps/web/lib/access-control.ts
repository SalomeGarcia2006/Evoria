export type NavigationItem = {
  label: string;
  href: string;
  permission: string;
};

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', permission: 'dashboard.ver' },
  { label: 'Eventos', href: '/eventos', permission: 'eventos.ver' },
  {
    label: 'Recursos',
    href: '/recursos/asignaciones',
    permission: 'asignaciones.ver',
  },
  { label: 'Inventario', href: '/inventario', permission: 'inventario.ver' },
  {
    label: 'Presupuestos',
    href: '/presupuestos',
    permission: 'presupuestos.ver',
  },
  {
    label: 'Cronograma',
    href: '/cronograma',
    permission: 'cronogramas.ver',
  },
  { label: 'Alertas', href: '/alertas', permission: 'alertas.ver' },
  { label: 'Reportes', href: '/reportes', permission: 'reportes.ver' },
  { label: 'Auditoría', href: '/auditoria', permission: 'auditoria.ver' },
  { label: 'Usuarios', href: '/usuarios', permission: 'usuarios.ver' },
  { label: 'Perfiles', href: '/perfiles', permission: 'perfiles.ver' },
  { label: 'Empresas', href: '/empresas', permission: 'empresas.ver' },
];

const routePermissions = [
  { prefix: '/recursos/asignaciones', permission: 'asignaciones.ver' },
  { prefix: '/eventos/nuevo', permission: 'eventos.crear' },
  { prefix: '/inventario/nuevo', permission: 'inventario.ajustar' },
  ...navigationItems.map(({ href, permission }) => ({
    prefix: href,
    permission,
  })),
];

export function permissionForPathname(pathname: string): string | null {
  return (
    routePermissions.find(
      ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )?.permission ?? null
  );
}

export function defaultRouteFor(permissions: string[]): string {
  return (
    navigationItems.find((item) => permissions.includes(item.permission))
      ?.href ?? '/'
  );
}
