import type { ReactNode } from 'react';
import { AuthGuard } from '../auth/AuthGuard';
import { PermissionGuard } from '../auth/PermissionGuard';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({
  children,
  title,
  hideTitle = false,
}: {
  children: ReactNode;
  title: string;
  hideTitle?: boolean;
}) {
  return (
    <AuthGuard>
      <PermissionGuard>
        <div
          className="min-h-screen lg:flex"
          data-inventory-scope={title === 'Inventario' ? '' : undefined}
        >
          <Sidebar />
          <div className="min-w-0 flex-1 lg:ml-[6.25rem]">
            <Topbar hideTitle={hideTitle} title={title} />
            <main className="mx-auto max-w-7xl p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </PermissionGuard>
    </AuthGuard>
  );
}
