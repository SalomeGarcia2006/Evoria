import type { ReactNode } from 'react';
import { AuthGuard } from '../auth/AuthGuard';
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
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1 lg:ml-64">
          <Topbar title={title} />
          <main className="mx-auto max-w-7xl p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
