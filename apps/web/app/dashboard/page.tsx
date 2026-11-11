'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { getDashboardSummary } from '../../services/dashboard.service';
import { getAllBudgets } from '../../services/presupuestos.service';
import { apiErrorMessage } from '../../services/api';
import { EVENT_STATUSES } from '../../services/events.service';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';

const money = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
const labels = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_progreso: 'En ejecución',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export default function DashboardPage() {
  const feedback = useFeedback();
  const { notify } = feedback;
  const { user, can } = useAuth();
  const [state, setState] = useState<{
    owner: typeof user;
    revision: number;
    data: {
      summary: Awaited<ReturnType<typeof getDashboardSummary>> | null;
      budgets: Awaited<ReturnType<typeof getAllBudgets>> | null;
      errors: string[];
    };
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.allSettled([
      getDashboardSummary(),
      can('presupuestos.ver') ? getAllBudgets() : Promise.resolve(null),
    ]).then(([summaryResult, budgetsResult]) => {
      if (active) {
        const data = {
          summary:
            summaryResult.status === 'fulfilled' ? summaryResult.value : null,
          budgets:
            budgetsResult.status === 'fulfilled' ? budgetsResult.value : null,
          errors: [
            ...(summaryResult.status === 'rejected'
              ? [`Resumen: ${apiErrorMessage(summaryResult.reason)}`]
              : []),
            ...(budgetsResult.status === 'rejected'
              ? [`Presupuestos: ${apiErrorMessage(budgetsResult.reason)}`]
              : []),
          ],
        };
        setState({ owner: user, revision, data });
        if (data.errors.length)
          notify(
            `No se pudo completar el resumen. ${data.errors.join('\n')} Puedes reintentar con Actualizar.`,
            'error',
          );
        else if (revision > 0)
          notify(
            data.summary?.events ||
              data.summary?.inventory ||
              data.summary?.budgets
              ? 'Resumen de la empresa actualizado correctamente.'
              : 'Solicita permisos de consulta para ver los datos de tu empresa.',
            data.summary?.events ||
              data.summary?.inventory ||
              data.summary?.budgets
              ? 'success'
              : 'info',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [user, can, revision, notify]);
  const data = state?.owner === user ? state?.data : null;
  const summary = data?.summary;
  const now = new Date();
  const upcoming = summary?.events?.upcoming ?? [];
  const metrics = [
    ...(summary?.events
      ? [
          {
            label: 'Eventos activos',
            value: String(summary.events.active),
            hint: `${summary.events.total} eventos registrados`,
            href: '/eventos',
            icon: '▣',
            tone: 'violet',
          },
        ]
      : []),
    ...(summary?.inventory
      ? [
          {
            label: 'Unidades disponibles',
            value: String(summary.inventory.available),
            hint: `${summary.inventory.total} unidades en inventario`,
            href: '/inventario',
            icon: '◇',
            tone: 'teal',
          },
        ]
      : []),
    ...(summary?.budgets
      ? [
          {
            label: 'Presupuesto ejecutado',
            value: money(summary.budgets.spentCop),
            hint: `${money(summary.budgets.remainingCop)} disponibles`,
            href: '/presupuestos',
            icon: '$',
            tone: 'coral',
          },
        ]
      : []),
  ];
  return (
    <AppShell title="Dashboard">
      <div className="grid gap-6 dashboard-page">
        <FeedbackMessages feedback={feedback} />
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-hero__eyebrow">
              {new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(
                now,
              )}
            </p>
            <p className="mt-5 text-sm text-white/80">Operación de Evoria</p>
            <h2 className="mt-1 text-4xl font-bold text-white">
              Resumen general
            </h2>
            <p className="mt-2 max-w-xl text-white/90">
              Operación de {user?.tenant?.name ?? 'tu empresa'}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="dashboard-hero__button"
              disabled={!data || state?.revision !== revision}
              onClick={() => {
                feedback.dismiss();
                setRevision((value) => value + 1);
              }}
            >
              Actualizar datos
            </Button>
            <Button
              className="text-white hover:bg-white/15 hover:text-white"
              variant="ghost"
              onClick={() =>
                feedback.guide(
                  !user?.tenant
                    ? 'Selecciona una empresa desde el selector de empresa para consultar su operación.'
                    : 'El resumen usa los eventos, recursos y presupuestos registrados en tu empresa. Si no ves un módulo, solicita su permiso de consulta. Si no hay registros, crea los datos desde el módulo correspondiente. Usa Actualizar para consultar los cambios recientes.',
                  'Cómo completar el resumen',
                )
              }
            >
              Cómo completar el resumen
            </Button>
          </div>
        </section>
        {!data && <LoadingState label="Cargando resumen de la empresa..." />}
        {data?.errors.map((error) => (
          <p
            key={error}
            className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        ))}
        {data &&
          summary &&
          !summary.events &&
          !summary.inventory &&
          !summary.budgets && (
            <Card>
              No tienes permisos para consultar los resúmenes operativos.
            </Card>
          )}
        <section
          aria-label="Métricas principales"
          className="dashboard-metrics grid gap-4 sm:grid-cols-3"
        >
          {metrics.map((metric) => (
            <Link href={metric.href} key={metric.label}>
              <Card density="compact" className="dashboard-metric h-full">
                <span
                  aria-hidden="true"
                  className={`dashboard-metric__icon dashboard-metric__icon--${metric.tone}`}
                >
                  {metric.icon}
                </span>
                <div>
                  <p className="text-sm text-muted">{metric.label}</p>
                  <p className="dashboard-metric__value mt-1 text-2xl font-bold">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted">{metric.hint}</p>
                </div>
              </Card>
            </Link>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          {summary?.events && (
            <Card>
              <h3 className="text-lg font-bold">Eventos por estado</h3>
              <div className="mt-5 grid gap-4">
                {EVENT_STATUSES.map((status) => {
                  const count = summary.events!.byStatus[status];
                  const percent = summary.events!.total
                    ? (count / summary.events!.total) * 100
                    : 0;
                  return (
                    <div key={status}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>{labels[status]}</span>
                        <span>
                          {count} ({Math.round(percent)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-beige">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-teal to-violet"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {summary.events.total === 0 && (
                <p className="mt-4 text-sm text-muted">
                  No hay eventos registrados.
                </p>
              )}
            </Card>
          )}
          {summary?.budgets && data?.budgets && (
            <Card>
              <h3 className="text-lg font-bold">Presupuesto por evento</h3>
              <p className="mt-2 text-sm text-muted">
                Asignado y ejecutado en eventos no cancelados.
              </p>
              <div className="mt-5 grid gap-4">
                {data.budgets.items.map((budget) => (
                  <Link
                    href={`/presupuestos?eventId=${encodeURIComponent(budget.eventId)}`}
                    className="rounded-xl border border-sky-blue bg-beige p-4 focus-visible:outline-2 focus-visible:outline-teal"
                    key={budget.eventId}
                  >
                    <p className="font-semibold">{budget.eventName}</p>
                    <p className="mt-2 text-sm text-muted">
                      {budget.initialized
                        ? `${money(budget.spentCop)} ejecutados de ${money(budget.allocatedCop)}`
                        : 'Sin presupuesto inicial'}
                    </p>
                  </Link>
                ))}
              </div>
              {data.budgets.items.length === 0 && (
                <p className="mt-4 text-sm text-muted">
                  No hay eventos registrados.
                </p>
              )}
              <Link
                className="mt-4 inline-block text-sm font-semibold text-muted"
                href="/presupuestos"
              >
                Ver presupuestos →
              </Link>
            </Card>
          )}
        </section>
        {summary?.events && (
          <Card>
            <h3 className="text-lg font-bold">Próximos eventos</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((event) => (
                <Link
                  href={`/eventos/${encodeURIComponent(event.id)}`}
                  key={event.id}
                  className="flex min-w-0 flex-wrap justify-between gap-3 rounded-xl border border-sky-blue p-4 focus-visible:outline-2 focus-visible:outline-teal"
                >
                  <div>
                    <p className="font-semibold">{event.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {new Intl.DateTimeFormat('es-CO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(event.startAt))}
                    </p>
                  </div>
                  <span className="text-sm text-muted">
                    {labels[event.status]}
                  </span>
                </Link>
              ))}
            </div>
            {upcoming.length === 0 && (
              <p className="mt-4 text-sm text-muted">
                No hay próximos eventos.
              </p>
            )}
            <Link
              href="/eventos"
              className="mt-4 inline-block text-sm font-semibold text-muted"
            >
              Ver todos →
            </Link>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
