'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { navigationItems } from '../../lib/access-control';
import { useAuth } from '../../hooks/useAuth';

export function Sidebar() {
  const router = useRouter();
  const { can, signOut, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await signOut();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <aside className="flex flex-col border-b border-sky-blue bg-white p-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <Link className="mb-6 block text-2xl font-bold tracking-tight" href="/">
        EVORIA
      </Link>
      <nav
        aria-label="Navegación principal"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <ul className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {navigationItems
            .filter(({ permission }) => can(permission))
            .map(({ label, href }) => (
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
      <div className="mt-auto border-t border-sky-blue pt-4">
        <p className="mb-3 px-3 text-sm font-semibold">
          {user?.name ?? 'Usuario'}
        </p>
        <button
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-teal transition hover:bg-sky-blue hover:text-navy disabled:opacity-50"
          disabled={isLoggingOut}
          onClick={handleLogout}
          type="button"
        >
          {isLoggingOut ? 'Cerrando sesión…' : 'Salir'}
        </button>
      </div>
    </aside>
  );
}
