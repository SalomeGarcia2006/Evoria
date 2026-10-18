'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import {
  defaultRouteFor,
  permissionForPathname,
} from '../../lib/access-control';
import { useAuth } from '../../hooks/useAuth';

export function PermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, isLoading, user } = useAuth();
  const requiredPermission = permissionForPathname(pathname);
  const hasAccess = !requiredPermission || can(requiredPermission);

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      router.replace(defaultRouteFor(user.permissions));
    }
  }, [hasAccess, isLoading, router, user]);

  if (!hasAccess) {
    return (
      <main className="grid min-h-screen place-items-center bg-beige p-6">
        <p aria-live="polite" className="text-teal">
          Verificando permisos…
        </p>
      </main>
    );
  }

  return children;
}
