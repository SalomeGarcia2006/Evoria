import { AppShell } from '../../components/layout/AppShell';
import { EventList } from '../../components/events/EventList';
import Link from 'next/link';
import { PermissionGate } from '../../components/auth/PermissionGate';

export default function EventosPage() {
  return (
    <AppShell title="Eventos">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Eventos</h1>
            <p className="mt-1 text-sm text-teal">
              Consulta y administra los eventos de tu empresa.
            </p>
          </div>
          <PermissionGate permission="eventos.crear">
            <Link
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              href="/eventos/nuevo"
            >
              + Nuevo evento
            </Link>
          </PermissionGate>
        </div>
        <EventList />
      </div>
    </AppShell>
  );
}
