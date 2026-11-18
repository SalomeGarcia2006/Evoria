'use client';

import Image from 'next/image';
import { cop } from '../../components/budgets/BudgetAmountsView';
import { AppShell } from '../../components/layout/AppShell';
import { ReportsExplorer } from '../../components/reports/ReportsExplorer';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import cardStyles from '../../components/ui/InventoryStyleCard.module.css';
import { LoadingState } from '../../components/ui/LoadingState';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { PageHero } from '../../components/ui/PageHero';
import { useReportsOverview } from '../../hooks/useReportsOverview';
import styles from './reportes.module.css';

function Heading({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.cardHeading}>
      <span className={styles.icon}>
        <Image src={`/icons/${icon}`} alt="" width={22} height={22} />
      </span>
      <h3>{children}</h3>
    </div>
  );
}

export default function ReportesPage() {
  const { data, error, loading, refresh } = useReportsOverview();
  return (
    <AppShell hideTitle title="Reportes">
      <div className="grid min-w-0 gap-6">
        <PageHero
          title="Reportes"
          description="Consulta información actual de eventos, recursos y ejecución presupuestal."
          actions={
            <Button variant="secondary" onClick={refresh}>
              Actualizar
            </Button>
          }
        />
        <ModuleBanner
          icon="reporte.svg"
          title="Tu operación en perspectiva"
          description="Filtra y exporta los datos disponibles según los permisos de tu perfil."
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
            {!data.events && !data.inventory && !data.budgets ? (
              <Card>
                <p className="text-sm text-muted">
                  No tienes información de reportes disponible con los permisos
                  actuales.
                </p>
              </Card>
            ) : (
              <section
                aria-label="Resumen de reportes"
                className="module-panel"
              >
                <div className={`module-panel__heading ${styles.panelHeading}`}>
                  <h2 className="text-xl font-bold">Resumen general</h2>
                  <p className="mt-1 text-sm text-muted">
                    Los valores corresponden a los filtros y permisos de la
                    sesión activa.
                  </p>
                </div>
                <div className="module-panel__content grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.events && (
                    <Card
                      className={`${styles.summaryCard} ${cardStyles.card}`}
                    >
                      <Heading icon="eventos.svg">Actividad de eventos</Heading>
                      <p className={styles.summaryValue}>
                        {data.events.pagination.total}
                      </p>
                      <p className="text-sm text-muted">
                        Eventos registrados · {data.events.invitados} invitados
                      </p>
                      <dl className={styles.summaryList}>
                        {Object.entries(data.events.byStatus).map(
                          ([label, total]) => (
                            <div key={label}>
                              <dt>{label.replace('_', ' ')}</dt>
                              <dd>{total}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </Card>
                  )}
                  {data.inventory && (
                    <Card
                      className={`${styles.summaryCard} ${cardStyles.card}`}
                    >
                      <Heading icon="recursos.svg">Uso de recursos</Heading>
                      <p className={styles.summaryValue}>
                        {data.inventory.total}
                      </p>
                      <p className="text-sm text-muted">Unidades totales</p>
                      <dl className={styles.summaryList}>
                        {[
                          ['Recursos activos', data.inventory.resources],
                          ['Unidades disponibles', data.inventory.available],
                          ['Unidades reservadas', data.inventory.reserved],
                          ['En mantenimiento', data.inventory.maintenance],
                        ].map(([label, total]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{total}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  )}
                  {data.budgets && (
                    <Card
                      className={`${styles.summaryCard} ${cardStyles.card}`}
                    >
                      <Heading icon="presupuesto.svg">
                        Ejecución presupuestal
                      </Heading>
                      <p className="mt-3 text-sm text-muted">
                        Totales de eventos incluidos en el reporte.
                      </p>
                      <dl className={styles.budgetTotals}>
                        {[
                          ['Asignado', data.budgets.allocatedCop],
                          ['Gastado', data.budgets.spentCop],
                          ['Disponible', data.budgets.remainingCop],
                        ].map(([label, total]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{cop(Number(total))}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  )}
                </div>
              </section>
            )}
            <ReportsExplorer />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
