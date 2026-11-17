'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { navigationItems } from '../../lib/access-control';
import { useAuth } from '../../hooks/useAuth';
import { getUnreadAlertCount } from '../../services/alerts.service';

const iconByRoute: Record<string, string> = {
  '/dashboard': 'dashboard.svg',
  '/eventos': 'eventos.svg',
  '/recursos/asignaciones': 'recursos.svg',
  '/inventario': 'inventario.svg',
  '/proveedores': 'provedores.svg',
  '/presupuestos': 'presupuesto.svg',
  '/cronograma': 'cronograma.svg',
  '/alertas': 'alerta.svg',
  '/reportes': 'reporte.svg',
  '/auditoria': 'auditoria.svg',
  '/usuarios': 'usuarios.svg',
  '/perfiles': 'perfil.svg',
  '/empresas': 'empresas.svg',
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { can, signOut, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const refreshUnreadAlerts = () => {
      void getUnreadAlertCount()
        .then((count) => {
          if (isMounted) setUnreadAlertCount(count);
        })
        .catch(() => {
          if (isMounted) setUnreadAlertCount(0);
        });
    };

    refreshUnreadAlerts();
    window.addEventListener('evoria-alerts-changed', refreshUnreadAlerts);

    return () => {
      isMounted = false;
      window.removeEventListener('evoria-alerts-changed', refreshUnreadAlerts);
    };
  }, [pathname]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await signOut();
    } finally {
      router.replace('/login');
    }
  }

  const visibleItems = navigationItems.filter(
    ({ href, permission, alternativePermission }) =>
      can(permission) ||
      (href === '/empresas' &&
        user?.isDeveloper === true &&
        user.scope === 'tenant') ||
      (!!alternativePermission && can(alternativePermission)),
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
                  {href === '/alertas' && unreadAlertCount > 0 ? (
                    <span
                      aria-label={`${unreadAlertCount} alertas sin leer`}
                      className="evoria-sidebar__alert-indicator"
                      role="status"
                    >
                      {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                    </span>
                  ) : null}
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
