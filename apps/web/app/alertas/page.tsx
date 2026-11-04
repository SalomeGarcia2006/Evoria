'use client';
import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
export default function AlertasPage() {
  const { can } = useAuth();
  return (
    <AppShell title="Alertas">
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Seguimiento
          </p>
          <h2 className="mt-2 text-3xl font-bold">Centro de alertas</h2>
        </div>
        {can('presupuestos.aprobar') && (
          <Card>
            <h3 className="text-xl font-bold">Autorizaciones de presupuesto</h3>
            <p className="mt-2 text-sm text-teal">
              Revisa las solicitudes pendientes de los eventos que lideras y
              consulta su presupuesto antes de decidir.
            </p>
            <Link
              className="mt-4 inline-block font-semibold text-teal underline"
              href="/presupuestos?view=authorizations"
            >
              Ver autorizaciones pendientes →
            </Link>
          </Card>
        )}
        <Card>
          <h3 className="text-xl font-bold">Otros avisos</h3>
          <p className="mt-2 text-sm text-teal">
            Las notificaciones generales estarán disponibles cuando se conecte
            su consulta en el backend.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
