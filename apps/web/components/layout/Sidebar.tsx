import Link from 'next/link';

const navigation = [
  ['Dashboard', '/dashboard'],
  ['Eventos', '/eventos'],
  ['Recursos', '/recursos'],
  ['Inventario', '/inventario'],
  ['Presupuestos', '/presupuestos'],
  ['Cronograma', '/cronograma'],
  ['Alertas', '/alertas'],
  ['Reportes', '/reportes'],
  ['Auditoría', '/auditoria'],
] as const;

export function Sidebar() {
  return (
    <aside className="border-b border-sky-blue bg-white p-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <Link className="mb-6 block text-2xl font-bold tracking-tight" href="/">
        EVORIA
      </Link>
      <nav aria-label="Navegación principal">
        <ul className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {navigation.map(([label, href]) => (
            <li key={href}>
              <Link
                className="block rounded-lg px-3 py-2 text-sm text-teal transition hover:bg-sky-blue hover:text-navy"
                href={href}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
