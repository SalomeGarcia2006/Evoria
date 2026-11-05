'use client';
import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { cop, requestLabels } from '../../components/budgets/BudgetAmountsView';
import { useAuth } from '../../hooks/useAuth';
import { useOperationalOverview } from '../../hooks/useOperationalOverview';

export default function AlertasPage() {
  const { can } = useAuth();
  const { data, loading, refresh } = useOperationalOverview(true);
  const budgets =
    data?.summary.budgets?.items.filter((item) =>
      ['borrador', 'planificado', 'en_progreso'].includes(item.eventStatus),
    ) ?? [];
  const attention = budgets.filter(
    (item) => !item.initialized || item.remainingCop <= 0,
  );
  const inventory = data?.summary.inventory;
  const hasSources =
    can('presupuestos.aprobar') ||
    can('presupuestos.ver') ||
    can('inventario.ver');
  const count =
    (data?.authorizations?.length ?? 0) +
    attention.length +
    (inventory && inventory.maintenance > 0 ? 1 : 0) +
    (inventory && inventory.resources > 0 && inventory.available === 0 ? 1 : 0);
  return (
    <AppShell title="Alertas">
      <div className="grid gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
              Seguimiento
            </p>
            <h2 className="mt-2 text-3xl font-bold">Centro de alertas</h2>
            <p className="mt-2 text-muted">
              Solicitudes pendientes y situaciones que requieren atención en tu
              empresa.
            </p>
          </div>
          <Button variant="secondary" onClick={refresh}>
            Actualizar
          </Button>
        </header>
        {loading ? (
          <LoadingState label="Consultando alertas…" />
        ) : (
          data && (
            <>
              {data.errors.map((error) => (
                <Card key={error}>
                  <p role="alert" className="text-sm text-red-800">
                    {error}
                  </p>
                  <Button
                    className="mt-3"
                    variant="secondary"
                    onClick={refresh}
                  >
                    Reintentar
                  </Button>
                </Card>
              ))}
              {!hasSources ? (
                <Card>
                  Necesitas permisos de consulta de inventario, presupuestos o
                  aprobación para consultar los avisos de tu empresa.
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    {count} avisos detectados en la información consultada.
                  </p>
                  {count === 0 && data.errors.length === 0 && (
                    <Card>
                      <h3 className="text-xl font-bold">Todo al día</h3>
                      <p className="mt-2 text-sm text-muted">
                        No hay autorizaciones pendientes ni incidencias en los
                        presupuestos y recursos que puedes consultar.
                      </p>
                    </Card>
                  )}
                  <section
                    aria-label="Avisos actuales"
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                  >
                    {data.authorizations?.map((request) => (
                      <Card
                        key={request.id}
                        density="compact"
                        className="flex min-w-0 flex-col"
                      >
                        <p className="text-xs font-semibold uppercase text-muted">
                          Autorización pendiente
                        </p>
                        <h3 className="mt-2 break-words text-base font-bold">
                          {request.eventName}
                        </h3>
                        <p className="mt-3 font-semibold">
                          {requestLabels[request.type]} ·{' '}
                          {cop(request.amountCop)}
                        </p>
                        <p
                          title={request.reason}
                          className="my-2 line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted"
                        >
                          {request.reason}
                        </p>
                        <p className="mb-4 text-xs text-muted">
                          La solicitud todavía no modifica el saldo.
                        </p>
                        {can('presupuestos.ver') ? (
                          <Link
                            className="mt-auto font-semibold text-muted underline"
                            href={`/presupuestos?eventId=${encodeURIComponent(request.eventId)}&view=authorizations`}
                          >
                            Revisar y decidir →
                          </Link>
                        ) : (
                          <p className="text-sm text-muted">
                            Necesitas permiso de consulta de presupuestos para
                            revisar el detalle.
                          </p>
                        )}
                      </Card>
                    ))}
                    {attention.map((item) => (
                      <Card key={item.eventId} density="compact">
                        <p className="text-xs font-semibold uppercase text-muted">
                          {item.initialized
                            ? 'Saldo agotado'
                            : 'Presupuesto sin iniciar'}
                        </p>
                        <h3 className="mt-2 break-words text-base font-bold">
                          {item.eventName}
                        </h3>
                        <p className="mt-3 text-sm text-muted">
                          {item.initialized
                            ? `Disponible: ${cop(item.remainingCop)}. Revisa los gastos y las ampliaciones antes de nuevas asignaciones.`
                            : 'Registra el presupuesto inicial para poder asignar recursos y servicios.'}
                        </p>
                        <Link
                          className="mt-4 inline-block font-semibold text-muted underline"
                          href={`/presupuestos?eventId=${encodeURIComponent(item.eventId)}`}
                        >
                          Revisar presupuesto →
                        </Link>
                      </Card>
                    ))}
                    {inventory && inventory.maintenance > 0 && (
                      <Card density="compact">
                        <h3 className="text-base font-bold">
                          Recursos en mantenimiento
                        </h3>
                        <p className="mt-3 text-sm text-muted">
                          {inventory.maintenance} recursos requieren revisión
                          antes de volver a estar disponibles.
                        </p>
                        <Link
                          href="/inventario"
                          className="mt-4 inline-block font-semibold text-muted underline"
                        >
                          Ver recursos →
                        </Link>
                      </Card>
                    )}
                    {inventory &&
                      inventory.resources > 0 &&
                      inventory.available === 0 && (
                        <Card density="compact">
                          <h3 className="text-base font-bold">
                            Sin unidades disponibles
                          </h3>
                          <p className="mt-3 text-sm text-muted">
                            El inventario activo no tiene unidades disponibles
                            para nuevas reservas.
                          </p>
                          <Link
                            href="/inventario"
                            className="mt-4 inline-block font-semibold text-muted underline"
                          >
                            Revisar inventario →
                          </Link>
                        </Card>
                      )}
                  </section>
                </>
              )}
            </>
          )
        )}
      </div>
    </AppShell>
  );
}
