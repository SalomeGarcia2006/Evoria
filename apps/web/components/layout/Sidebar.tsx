'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { navigationItems } from '../../lib/access-control';
import { useAuth } from '../../hooks/useAuth';

const iconByRoute: Record<string, string> = {
  '/dashboard': 'dashboard.svg',
  '/eventos': 'eventos.svg',
  '/recursos': 'recursos.svg',
  '/inventario': 'inventario.svg',
  '/presupuestos': 'presupuesto.svg',
  '/cronograma': 'cronograma.svg',
  '/alertas': 'alerta.svg',
  '/reportes': 'reporte.svg',
  '/auditoria': 'auditoria.svg',
  '/usuarios': 'usuarios.svg',
  '/perfiles': 'perfil.svg',
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { can, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await signOut();
    } finally {
      router.replace('/login');
    }
  }

  const visibleItems = navigationItems.filter(({ permission }) =>
    can(permission),
  );

  return (
    <aside className="evoria-sidebar">
      <Link
        aria-label="Ir al inicio de EVORIA"
        className="evoria-sidebar__brand"
        href="/"
      >
        <span className="evoria-sidebar__brand-mark">E</span>
        <span className="evoria-sidebar__brand-name">EVORIA</span>
      </Link>

      <nav aria-label="Navegación principal" className="evoria-sidebar__nav">
        <ul className="evoria-sidebar__list">
          {visibleItems.map(({ label, href }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <li key={href}>
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={`evoria-sidebar__link ${isActive ? 'is-active' : ''}`}
                  href={href}
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="evoria-sidebar__icon"
                    height={24}
                    src={`/icons/${iconByRoute[href]}`}
                    width={24}
                  />
                  <span className="evoria-sidebar__link-label">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="evoria-sidebar__footer">
        <button
          className="evoria-sidebar__link evoria-sidebar__logout"
          disabled={isLoggingOut}
          onClick={handleLogout}
          type="button"
        >
          <span aria-hidden="true" className="evoria-sidebar__logout-icon">
            ↪
          </span>
          <span className="evoria-sidebar__link-label">
            {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </span>
        </button>
      </div>
    </aside>
  );
}
