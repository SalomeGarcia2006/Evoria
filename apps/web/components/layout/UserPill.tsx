'use client';

import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';

export function UserPill() {
  const { user } = useAuth();

  return (
    <Link
      aria-label="Abrir mi perfil"
      className="flex items-center gap-3 rounded-full border border-sky-blue bg-white px-3 py-2 text-sm transition hover:border-teal hover:bg-sky-blue/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      href="/mi-perfil"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full bg-linear-to-br from-teal to-violet text-white"
      >
        {user?.name.charAt(0).toUpperCase() ?? 'E'}
      </span>
      <span className="hidden font-semibold sm:inline">
        {user?.name ?? 'Usuario'}
      </span>
    </Link>
  );
}
