'use client';

import { cop } from '../../components/budgets/BudgetAmountsView';
import { AppShell } from '../../components/layout/AppShell';
import { ReportsExplorer } from '../../components/reports/ReportsExplorer';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { PageHero } from '../../components/ui/PageHero';
import { useReportsOverview } from '../../hooks/useReportsOverview';
import styles from './reportes.module.css';

const statusLabel = (status: string) => status.replaceAll('_', ' ');

function Meter({ value, tone = 'violet' }: { value: number; tone?: string }) {
  return (
    <span className={styles.meter} aria-hidden="true">
      <span
        className={`${styles.meterFill} ${styles[`meter_${tone}`]}`}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </span>
  );
}

export default function ReportesPage() {
  const { data, error, loading, refresh } = useReportsOverview();
  const events = data?.summary.events;
  const budgets = data?.summary.budgets;
  const inventory = data?.summary.inventory;
  const schedules = data?.schedules;
  const totalActivities = schedules?.total ?? 0;
  const scheduleProgress = totalActivities
    ? Math.round(((schedules?.completed ?? 0) / totalActivities) * 100)
    : 0;
  const budgetProgress = budgets?.allocatedCop
    ? Math.round((budgets.spentCop / budgets.allocatedCop) * 100)
    : 0;

  return (
    <AppShell hideTitle title="Reportes">
      <div className={styles.page}>
        <PageHero
          title="Reportes"
          description="Consulta eventos, presupuestos, inventario y más, según los permisos de tu perfil."
          actions={
            <Button onClick={refresh} disabled={loading}>
              ↻ Actualizar
            </Button>
          }
        />
        <ModuleBanner
          icon="reporte.svg"
          title="Información de tu empresa"
          description="Consulta el estado de tu operación y genera documentos PDF listos para compartir."
        />

        {loading ? (
          <LoadingState label="Cargando reportes…" />
        ) : error ? (
          <Card>
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
            <Button className="mt-3" variant="secondary" onClick={refresh}>
              Reintentar
            </Button>
          </Card>
        ) : data ? (
          <>
            <section className={styles.metrics} aria-label="Resumen general">
              {events && (
                <article className={styles.metricCard}>
                  <h2>Eventos</h2>
                  <p className={styles.metricValue}>
                    {events.pagination.total}
                    <span>registrados · {events.invitados} invitados</span>
                  </p>
                  <Meter
                    tone="events"
                    value={events.pagination.total ? 100 : 0}
                  />
                  <div className={styles.statuses}>
                    {Object.entries(events.byStatus).map(([name, total]) => (
                      <span key={name} className={styles[`status_${name}`]}>
                        {statusLabel(name)} · <strong>{total}</strong>
                      </span>
                    ))}
                  </div>
                </article>
              )}
              {budgets && (
                <article className={styles.metricCard}>
                  <h2>Presupuesto</h2>
                  <p className={styles.metricValue}>
                    {cop(budgets.remainingCop)} <span>disponible</span>
                  </p>
                  <Meter tone="budget" value={budgetProgress} />
                  <dl className={styles.metricRows}>
                    <div>
                      <dt>Asignado</dt>
                      <dd>{cop(budgets.allocatedCop)}</dd>
                    </div>
                    <div>
                      <dt>Gastado ({budgetProgress}%)</dt>
                      <dd>{cop(budgets.spentCop)}</dd>
                    </div>
                  </dl>
                </article>
              )}
              {inventory && (
                <article className={styles.metricCard}>
                  <h2>Inventario</h2>
                  <p className={styles.metricValue}>
                    {inventory.total} <span>unidades</span>
                  </p>
                  <div className={styles.inventoryBar} aria-hidden="true">
                    <span
                      style={{
                        width: `${inventory.total ? (inventory.available / inventory.total) * 100 : 0}%`,
                      }}
                    />
                    <span
                      style={{
                        width: `${inventory.total ? (inventory.reserved / inventory.total) * 100 : 0}%`,
                      }}
                    />
                    <span
                      style={{
                        width: `${inventory.total ? (inventory.maintenance / inventory.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className={styles.inventoryLegend}>
                    Disponibles · Reservadas · Mant.
                    <strong>
                      {inventory.available} · {inventory.reserved} ·{' '}
                      {inventory.maintenance}
                    </strong>
                  </p>
                </article>
              )}
              {schedules && (
                <article className={styles.metricCard}>
                  <h2>Cronogramas</h2>
                  <p className={styles.metricValue}>
                    {scheduleProgress}% <span>de avance</span>
                  </p>
                  <Meter tone="schedule" value={scheduleProgress} />
                  <dl className={styles.metricRows}>
                    <div>
                      <dt>Actividades completadas</dt>
                      <dd>
                        {schedules.completed} de {schedules.total}
                      </dd>
                    </div>
                    <div>
                      <dt>Eventos con cronograma</dt>
                      <dd>{schedules.eventsWithSchedule}</dd>
                    </div>
                  </dl>
                </article>
              )}
            </section>
            <ReportsExplorer />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
