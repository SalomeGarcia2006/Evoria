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

function daysUntil(date: Date, today: Date) {
  const calendarDay = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.round((calendarDay(date) - calendarDay(today)) / 86_400_000);
}

function relativeDay(days: number) {
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  return days > 0 ? `En ${days} días` : `Hace ${Math.abs(days)} días`;
}

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
  const budgetItems = data?.budgets?.items.filter(
    (budget) => budget.eventStatus !== 'cancelado',
  );
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
              <p className="mt-1 text-sm text-muted">
                Ejecutado frente a asignado, sin eventos cancelados
              </p>
              <div className="mt-5 divide-y divide-sky-blue">
                {budgetItems?.map((budget) => {
                  const percentage =
                    budget.allocatedCop > 0
                      ? (budget.spentCop / budget.allocatedCop) * 100
                      : budget.spentCop === 0
                        ? 0
                        : null;
                  const percentageLabel =
                    percentage === null
                      ? 'Sin asignación'
                      : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(percentage)} %`;
                  return (
                    <Link
                      href={`/presupuestos?eventId=${encodeURIComponent(budget.eventId)}`}
                      className="block rounded-sm py-4 first:pt-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                      key={budget.eventId}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="min-w-0 break-words font-bold">
                          {budget.eventName}
                        </p>
                        <span className="shrink-0 text-sm">
                          {budget.initialized ? percentageLabel : 'Sin iniciar'}
                        </span>
                      </div>
                      {budget.initialized && percentage !== null && (
                        <div
                          role="progressbar"
                          aria-label={`Ejecución presupuestal de ${budget.eventName}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.min(100, Math.max(0, percentage))}
                          aria-valuetext={`${percentageLabel} ejecutado`}
                          className="mt-2 h-2.5 overflow-hidden rounded-full bg-sky-blue"
                        >
                          <div
                            className="h-full rounded-full bg-[#20bfae]"
                            style={{
                              width: `${Math.min(100, Math.max(0, percentage))}%`,
                            }}
                          />
                        </div>
                      )}
                      <p className="mt-2 text-sm text-muted">
                        {budget.initialized
                          ? `${money(budget.spentCop)} de ${money(budget.allocatedCop)}`
                          : 'Sin presupuesto inicial'}
                      </p>
                    </Link>
                  );
                })}
              </div>
              {budgetItems?.length === 0 && (
                <p className="mt-4 text-sm text-muted">
                  No hay eventos registrados.
                </p>
              )}
              <Link
                className="mt-4 inline-block text-sm font-semibold text-violet"
                href="/presupuestos"
              >
                Ver presupuestos →
              </Link>
            </Card>
          )}
        </section>
        {summary?.events && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Próximos eventos</h3>
              <Link
                href="/eventos"
                className="text-sm font-semibold text-violet"
              >
                Ver todos →
              </Link>
            </div>
            <div className="mt-4 divide-y divide-sky-blue">
              {upcoming.map((event) => {
                const start = new Date(event.startAt);
                const days = daysUntil(start, now);
                return (
                  <Link
                    href={`/eventos/${encodeURIComponent(event.id)}`}
                    key={event.id}
                    className="flex min-w-0 items-center gap-4 rounded-sm py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:gap-6"
                  >
                    <div className="dashboard-event-date flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#eeeaff] text-center text-[#6a4cff] sm:h-[76px] sm:w-[76px]">
                      <p className="text-2xl leading-none font-bold">
                        {start.getDate()}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase">
                        {new Intl.DateTimeFormat('es-CO', { month: 'short' })
                          .format(start)
                          .replace('.', '')}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <p className="break-words font-bold">{event.name}</p>
                        <p className="text-sm text-muted">
                          {new Intl.DateTimeFormat('es-CO', {
                            timeStyle: 'short',
                          }).format(start)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${days === 0 ? 'bg-[#3e32a4] text-white' : 'bg-[#e9e8fb] text-[#29218a]'}`}
                        >
                          {relativeDay(days)}
                        </span>
                        <span className="rounded-full bg-[#fff0cc] px-3 py-1 text-xs font-semibold text-[#794700]">
                          {labels[event.status]}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {upcoming.length === 0 && (
              <p className="mt-4 text-sm text-muted">
                No hay próximos eventos.
              </p>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
