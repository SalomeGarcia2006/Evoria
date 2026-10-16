'use client';

import { useAuth } from '../../hooks/useAuth';

export function UserPill() {
  const { user } = useAuth();

  return (
    <div className="flex items-center gap-3 rounded-full border border-sky-blue bg-white px-3 py-2 text-sm">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full bg-teal text-white"
      >
        {user?.name.charAt(0).toUpperCase() ?? 'E'}
      </span>
      <span className="hidden font-semibold sm:inline">
        {user?.name ?? 'Usuario'}
      </span>
    </div>
  );
}
