'use client';
import cardStyles from '../../components/ui/InventoryStyleCard.module.css';

import Image from 'next/image';
import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHero } from '../../components/ui/PageHero';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { LoadingState } from '../../components/ui/LoadingState';
import { cop } from '../../components/budgets/BudgetAmountsView';
import { useOperationalOverview } from '../../hooks/useOperationalOverview';
import styles from './reportes.module.css';

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En ejecución',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

function Status({ status }: { status: string }) {
  return (
    <span className={`${styles.status} ${styles[`status_${status}`] ?? ''}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function SectionHeading({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.cardHeading}>
      <span className={styles.icon} aria-hidden="true">
        <Image src={`/icons/${icon}`} alt="" width={22} height={22} />
      </span>
      <h3>{children}</h3>
    </div>
  );
}

function Execution({ allocated, spent }: { allocated: number; spent: number }) {
  if (allocated <= 0 && spent !== 0) {
    return <span className="text-sm text-muted">Sin asignación</span>;
  }
  const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
  const label = `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(percent)} %`;
  return (
    <div className={styles.execution}>
      <div
        role="progressbar"
        aria-label="Ejecución presupuestal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.max(0, Math.min(100, percent))}
        aria-valuetext={`${label} ejecutado`}
        className={styles.track}
      >
        <div
          className={styles.fill}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <span className={styles.percent}>{label}</span>
    </div>
  );
}

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
                <div className={`module-panel__heading ${styles.panelHeading}`}>
                  <h2 className="text-xl font-bold">Resumen operativo</h2>
                  <p className="mt-1 text-sm text-muted">
                    Consulta los datos disponibles de tu empresa.
                  </p>
                </div>
                <div className="module-panel__content grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {summary.events && (
                    <Card
                      className={`${styles.summaryCard} ${cardStyles.card}`}
                    >
                      <SectionHeading icon="eventos.svg">
                        Actividad de eventos
                      </SectionHeading>
                      <p className={styles.summaryValue}>
                        {summary.events.length}
                      </p>
                      <p className="text-sm text-muted">Eventos registrados</p>
                      <dl className={styles.summaryList}>
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <div key={status}>
                            <dt>
                              <span
                                className={`${styles.dot} ${styles[`dot_${status}`]}`}
                              />
                              {label}
                            </dt>
                            <dd>
                              {
                                summary.events!.filter(
                                  (event) => event.status === status,
                                ).length
                              }
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <Link className={styles.cardLink} href="/eventos">
                        Consultar eventos →
                      </Link>
                    </Card>
                  )}
                  {inventory && (
                    <Card
                      className={`${styles.summaryCard} ${cardStyles.card}`}
                    >
                      <SectionHeading icon="recursos.svg">
                        Uso de recursos
                      </SectionHeading>
                      <p className={styles.summaryValue}>{inventory.total}</p>
                      <p className="text-sm text-muted">Unidades totales</p>
                      <dl className={styles.summaryList}>
                        {[
                          ['Recursos activos', inventory.resources],
                          ['Unidades disponibles', inventory.available],
                          ['Unidades reservadas', inventory.reserved],
                          ['Recursos en mantenimiento', inventory.maintenance],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <Link className={styles.cardLink} href="/inventario">
                        Consultar recursos →
                      </Link>
                    </Card>
                  )}
                  {summary.budgets && (
                    <Card
                      className={`${styles.summaryCard} ${cardStyles.card}`}
                    >
                      <SectionHeading icon="presupuesto.svg">
                        Ejecución presupuestal
                      </SectionHeading>
                      <p className="mt-3 text-sm text-muted">
                        Totales de eventos no cancelados.
                      </p>
                      <dl className={styles.budgetTotals}>
                        {[
                          ['Asignado', summary.budgets.totals.allocatedCop],
                          ['Gastado', summary.budgets.totals.spentCop],
                          ['Disponible', summary.budgets.totals.remainingCop],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{cop(Number(value))}</dd>
                          </div>
                        ))}
                      </dl>
                      <Execution
                        allocated={summary.budgets.totals.allocatedCop}
                        spent={summary.budgets.totals.spentCop}
                      />
                      <Link className={styles.cardLink} href="/presupuestos">
                        Consultar presupuestos →
                      </Link>
                    </Card>
                  )}
                </div>
              </section>
              {summary.budgets && (
                <section
                  aria-label="Reporte de presupuesto por evento"
                  className="module-panel"
                >
                  <div
                    className={`module-panel__heading ${styles.panelHeading}`}
                  >
                    <h2 className="text-xl font-bold">
                      Presupuesto por evento
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Consulta la asignación y ejecución de cada evento.
                    </p>
                  </div>
                  {!summary.budgets.items.length ? (
                    <p className="module-panel__content text-sm text-muted">
                      No hay eventos con información presupuestal registrada.
                    </p>
                  ) : (
                    <div className={styles.rows}>
                      {summary.budgets.items.map((item) => (
                        <article
                          key={item.eventId}
                          className={styles.budgetRow}
                        >
                          <div className={styles.rowTitle}>
                            <h3>{item.eventName}</h3>
                            <Status status={item.eventStatus} />
                          </div>
                          {item.initialized ? (
                            <>
                              <dl className={styles.rowAmounts}>
                                {[
                                  ['Asignado', item.allocatedCop],
                                  ['Gastado', item.spentCop],
                                  ['Disponible', item.remainingCop],
                                ].map(([label, value]) => (
                                  <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{cop(Number(value))}</dd>
                                  </div>
                                ))}
                              </dl>
                              <div className={styles.rowProgress}>
                                <p>Ejecución</p>
                                <Execution
                                  allocated={item.allocatedCop}
                                  spent={item.spentCop}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted">
                              Presupuesto inicial pendiente.
                            </p>
                          )}
                          <Link
                            href={`/presupuestos?eventId=${encodeURIComponent(item.eventId)}`}
                            className={styles.rowLink}
                          >
                            Ver detalle →
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {summary.events && (
                <section
                  aria-label="Reporte de eventos"
                  className="module-panel"
                >
                  <div
                    className={`module-panel__heading ${styles.panelHeading}`}
                  >
                    <h2 className="text-xl font-bold">Eventos registrados</h2>
                    <p className="mt-1 text-sm text-muted">
                      Consulta los eventos de tu empresa y su estado actual.
                    </p>
                  </div>
                  {!summary.events.length ? (
                    <p className="module-panel__content text-sm text-muted">
                      Todavía no hay eventos registrados.
                    </p>
                  ) : (
                    <div className={styles.rows}>
                      {summary.events.map((event) => (
                        <article key={event.id} className={styles.eventRow}>
                          <div className={styles.eventDate}>
                            <span
                              className={styles.dateIcon}
                              aria-hidden="true"
                            >
                              <Image
                                src="/icons/FECHA.svg"
                                alt=""
                                width={16}
                                height={16}
                              />
                            </span>
                            {new Intl.DateTimeFormat('es-CO', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              timeZone: 'America/Bogota',
                            }).format(new Date(event.startAt))}
                          </div>
                          <div className={styles.rowTitle}>
                            <h3>{event.name}</h3>
                            {event.location && (
                              <p className="text-sm text-muted">
                                {event.location}
                              </p>
                            )}
                          </div>
                          <Status status={event.status} />
                          <Link
                            href={`/eventos/${encodeURIComponent(event.id)}`}
                            className={styles.rowLink}
                          >
                            Ver evento →
                          </Link>
                        </article>
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
