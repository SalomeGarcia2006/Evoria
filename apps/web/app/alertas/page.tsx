'use client';
import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
export default function AlertasPage() {
  const feedback = useFeedback();
  const { can } = useAuth();
  return (
    <AppShell title="Alertas">
      <div className="grid gap-6">
        <FeedbackMessages feedback={feedback} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Seguimiento
          </p>
          <h2 className="mt-2 text-3xl font-bold">Centro de alertas</h2>
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              feedback.guide(
                can('presupuestos.aprobar')
                  ? 'Abre Autorizaciones pendientes para revisar las solicitudes de los eventos que lideras. Necesitas también permiso para consultar presupuestos y ver el resumen financiero antes de decidir. No puedes aprobar tu propia solicitud.'
                  : 'Para revisar autorizaciones necesitas el permiso presupuestos.aprobar y ser líder responsable del evento. Solicita al administrador los permisos de consulta y aprobación que correspondan a tu función.',
                'Cómo revisar autorizaciones',
              )
            }
          >
            Cómo revisar autorizaciones
          </Button>
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
          <Button
            className="mt-4"
            variant="ghost"
            onClick={() =>
              feedback.guide(
                'Los avisos generales todavía no están disponibles. Por ahora puedes revisar las autorizaciones de presupuesto si tienes los permisos correspondientes. No necesitas crear ni configurar una alerta para continuar.',
                'Estado de los avisos',
              )
            }
          >
            Consultar disponibilidad de avisos
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
