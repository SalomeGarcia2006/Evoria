'use client';
import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHero } from '../../components/ui/PageHero';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { LoadingState } from '../../components/ui/LoadingState';
import { cop } from '../../components/budgets/BudgetAmountsView';
import { useOperationalOverview } from '../../hooks/useOperationalOverview';

const statusLabels = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En ejecución',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export default function ReportesPage() {
  const { data, loading, refresh } = useOperationalOverview();
  const summary = data?.summary;
  const inventory = summary?.inventory;
  return (
    <AppShell hideTitle title="Reportes">
      <div className="grid min-w-0 gap-6">
        <PageHero
          title="Reportes"
          description="Resumen actual de eventos, recursos y ejecución presupuestal."
          actions={
            <Button variant="secondary" onClick={refresh}>
              Actualizar
            </Button>
          }
        />
        <ModuleBanner
          icon="reporte.svg"
          title="Tu operación en perspectiva"
          description="Consulta la actividad de eventos, el uso de recursos y la ejecución presupuestal."
        />
        {loading ? (
          <LoadingState label="Cargando reportes…" />
        ) : (
          data &&
          summary && (
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
              {!summary.events &&
                !inventory &&
                !summary.budgets &&
                data.errors.length === 0 && (
                  <Card>
                    Necesitas permisos de consulta de eventos, inventario o
                    presupuestos para ver los reportes de tu empresa.
                  </Card>
                )}
              <section aria-label="Resumen operativo" className="module-panel">
                <div className="module-panel__heading">
                  <h2 className="text-xl font-bold">Resumen operativo</h2>
                  <p className="mt-1 text-sm text-muted">
                    Consulta los datos disponibles de tu empresa.
                  </p>
                </div>
                <div className="module-panel__content grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {summary.events && (
                    <Card>
                      <h3 className="text-xl font-bold">
                        Actividad de eventos
                      </h3>
                      <p className="mt-3 text-3xl font-bold">
                        {summary.events.length}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Eventos registrados
                      </p>
                      <dl className="mt-4 grid gap-2">
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <div
                            key={status}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <dt>{label}</dt>
                            <dd className="font-semibold">
                              {
                                summary.events!.filter(
                                  (event) => event.status === status,
                                ).length
                              }
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <Link
                        className="mt-5 inline-block font-semibold text-muted underline"
                        href="/eventos"
                      >
                        Consultar eventos →
                      </Link>
                    </Card>
                  )}
                  {inventory && (
                    <Card>
                      <h3 className="text-xl font-bold">Uso de recursos</h3>
                      <dl className="mt-4 grid gap-3">
                        {[
                          ['Recursos activos', inventory.resources],
                          ['Unidades totales', inventory.total],
                          ['Unidades disponibles', inventory.available],
                          ['Unidades reservadas', inventory.reserved],
                          ['Recursos en mantenimiento', inventory.maintenance],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <dt>{label}</dt>
                            <dd className="font-semibold">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <Link
                        className="mt-5 inline-block font-semibold text-muted underline"
                        href="/inventario"
                      >
                        Consultar recursos →
                      </Link>
                    </Card>
                  )}
                  {summary.budgets && (
                    <Card>
                      <h3 className="text-xl font-bold">
                        Ejecución presupuestal
                      </h3>
                      <p className="mt-2 text-sm text-muted">
                        Totales de eventos no cancelados.
                      </p>
                      <dl className="mt-4 grid gap-4">
                        {[
                          ['Asignado', summary.budgets.totals.allocatedCop],
                          ['Gastado', summary.budgets.totals.spentCop],
                          ['Disponible', summary.budgets.totals.remainingCop],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-sm text-muted">{label}</dt>
                            <dd className="mt-1 break-words text-xl font-bold">
                              {cop(Number(value))}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <Link
                        className="mt-5 inline-block font-semibold text-muted underline"
                        href="/presupuestos"
                      >
                        Consultar presupuestos →
                      </Link>
                    </Card>
                  )}
                </div>
              </section>
              {summary.budgets && (
                <section aria-label="Reporte de presupuesto por evento">
                  <h3 className="mb-4 text-xl font-bold">
                    Presupuesto por evento
                  </h3>
                  {!summary.budgets.items.length ? (
                    <Card>
                      No hay eventos con información presupuestal registrada.
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {summary.budgets.items.map((item) => (
                        <Card
                          key={item.eventId}
                          density="compact"
                          className="min-w-0"
                        >
                          <h4 className="break-words text-base font-bold">
                            {item.eventName}
                          </h4>
                          <p className="mt-2 text-sm text-muted">
                            {statusLabels[
                              item.eventStatus as keyof typeof statusLabels
                            ] ?? item.eventStatus}
                          </p>
                          {item.initialized ? (
                            <dl className="my-3 grid gap-2 text-xs">
                              {[
                                ['Asignado', item.allocatedCop],
                                ['Gastado', item.spentCop],
                                ['Disponible', item.remainingCop],
                              ].map(([label, value]) => (
                                <div
                                  key={label}
                                  className="flex flex-wrap justify-between gap-2"
                                >
                                  <dt>{label}</dt>
                                  <dd className="font-semibold">
                                    {cop(Number(value))}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="my-4 text-sm text-muted">
                              Presupuesto inicial pendiente.
                            </p>
                          )}
                          <Link
                            href={`/presupuestos?eventId=${encodeURIComponent(item.eventId)}`}
                            className="font-semibold text-muted underline"
                          >
                            Ver detalle →
                          </Link>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {summary.events && (
                <section aria-label="Reporte de eventos">
                  <h3 className="mb-4 text-xl font-bold">
                    Eventos registrados
                  </h3>
                  {!summary.events.length ? (
                    <Card>Todavía no hay eventos registrados.</Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {summary.events.map((event) => (
                        <Card
                          key={event.id}
                          density="compact"
                          className="min-w-0"
                        >
                          <h4 className="break-words text-base font-bold">
                            {event.name}
                          </h4>
                          <p className="mt-2 text-sm text-muted">
                            {statusLabels[event.status]}
                          </p>
                          <p className="mt-3 text-sm">
                            {new Intl.DateTimeFormat('es-CO', {
                              dateStyle: 'medium',
                              timeZone: 'America/Bogota',
                            }).format(new Date(event.startAt))}
                          </p>
                          {event.location && (
                            <p
                              className="mt-2 line-clamp-1 break-words text-xs text-muted"
                              title={event.location}
                            >
                              {event.location}
                            </p>
                          )}
                          <Link
                            href={`/eventos/${encodeURIComponent(event.id)}`}
                            className="mt-4 inline-block font-semibold text-muted underline"
                          >
                            Ver evento →
                          </Link>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )
        )}
      </div>
    </AppShell>
  );
}
