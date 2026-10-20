import type { ReactNode } from 'react';
import { AuthGuard } from '../auth/AuthGuard';
import { PermissionGuard } from '../auth/PermissionGuard';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <AuthGuard>
      <PermissionGuard>
        <div className="min-h-screen lg:flex">
          <Sidebar />
          <div className="min-w-0 flex-1 lg:ml-[6rem]">
            <Topbar title={title} />
            <main className="mx-auto max-w-7xl p-6">{children}</main>
          </div>
        </div>
      </PermissionGuard>
    </AuthGuard>
  );
}
