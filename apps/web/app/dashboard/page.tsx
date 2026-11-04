'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { getDashboard } from '../../services/dashboard.service';
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
    data: Awaited<ReturnType<typeof getDashboard>>;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getDashboard(can).then((data) => {
      if (active) {
        setState({ owner: user, data });
        if (data.errors.length)
          notify(
            `No se pudo completar el resumen. ${data.errors.join('\n')} Puedes reintentar con Actualizar.`,
            'error',
          );
        else if (revision > 0)
          notify(
            data.events || data.inventory || data.budgets
              ? 'Resumen de la empresa actualizado correctamente.'
              : 'Solicita permisos de consulta para ver los datos de tu empresa.',
            data.events || data.inventory || data.budgets ? 'success' : 'info',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [user, can, revision, notify]);
  const data = state?.owner === user ? state?.data : null;
  const now = new Date();
  const upcoming =
    data?.events
      ?.filter(
        (event) =>
          event.status !== 'cancelado' &&
          event.status !== 'finalizado' &&
          new Date(event.startAt) >= now,
      )
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
      .slice(0, 5) ?? [];
  const metrics = [
    ...(data?.events
      ? [
          {
            label: 'Eventos activos',
            value: String(
              data.events.filter((event) =>
                ['borrador', 'planificado', 'en_progreso'].includes(
                  event.status,
                ),
              ).length,
            ),
            hint: `${data.events.length} eventos registrados`,
            href: '/eventos',
          },
        ]
      : []),
    ...(data?.inventory
      ? [
          {
            label: 'Unidades disponibles',
            value: String(data.inventory.available),
            hint: `${data.inventory.total} unidades en inventario`,
            href: '/inventario',
          },
        ]
      : []),
    ...(data?.budgets
      ? [
          {
            label: 'Presupuesto ejecutado',
            value: money(data.budgets.totals.spentCop),
            hint: `${money(data.budgets.totals.remainingCop)} disponibles`,
            href: '/presupuestos',
          },
        ]
      : []),
  ];
  return (
    <AppShell title="Dashboard">
      <div className="grid gap-6">
        <FeedbackMessages feedback={feedback} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-teal">
              {new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(
                now,
              )}
            </p>
            <h2 className="mt-2 text-3xl font-bold">Resumen general</h2>
            <p className="mt-2 text-teal">
              Operación de {user?.tenant?.name ?? 'tu empresa'}.
            </p>
          </div>
          <Button
            disabled={!data}
            onClick={() => {
              feedback.dismiss();
              setState(null);
              setRevision((value) => value + 1);
            }}
          >
            Actualizar
          </Button>
        </div>
        <div>
          <Button
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
          !can('eventos.ver') &&
          !can('inventario.ver') &&
          !can('presupuestos.ver') && (
            <Card>
              No tienes permisos para consultar los resúmenes operativos.
            </Card>
          )}
        <section
          aria-label="Métricas principales"
          className="grid gap-4 sm:grid-cols-3"
        >
          {metrics.map((metric) => (
            <Link href={metric.href} key={metric.label}>
              <Card className="h-full">
                <p className="text-sm text-teal">{metric.label}</p>
                <p className="mt-4 text-3xl font-bold">{metric.value}</p>
                <p className="mt-2 text-xs text-teal">{metric.hint}</p>
              </Card>
            </Link>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          {data?.events && (
            <Card>
              <h3 className="text-lg font-bold">Eventos por estado</h3>
              <div className="mt-5 grid gap-4">
                {EVENT_STATUSES.map((status) => {
                  const count = data.events!.filter(
                    (event) => event.status === status,
                  ).length;
                  const percent = data.events!.length
                    ? (count / data.events!.length) * 100
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
                          className="h-full rounded-full bg-teal"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.events.length === 0 && (
                <p className="mt-4 text-sm text-teal">
                  No hay eventos registrados.
                </p>
              )}
            </Card>
          )}
          {data?.budgets && (
            <Card>
              <h3 className="text-lg font-bold">Presupuesto por evento</h3>
              <p className="mt-2 text-sm text-teal">
                Asignado y ejecutado en eventos no cancelados.
              </p>
              <div className="mt-5 grid gap-4">
                {data.budgets.items.slice(0, 5).map((budget) => (
                  <div className="rounded-xl bg-beige p-4" key={budget.eventId}>
                    <p className="font-semibold">{budget.eventName}</p>
                    <p className="mt-2 text-sm text-teal">
                      {budget.initialized
                        ? `${money(budget.spentCop)} ejecutados de ${money(budget.allocatedCop)}`
                        : 'Sin presupuesto inicial'}
                    </p>
                  </div>
                ))}
              </div>
              {data.budgets.items.length === 0 && (
                <p className="mt-4 text-sm text-teal">
                  No hay eventos registrados.
                </p>
              )}
              <Link
                className="mt-4 inline-block text-sm font-semibold text-teal"
                href="/presupuestos"
              >
                Ver presupuestos →
              </Link>
            </Card>
          )}
        </section>
        {data?.events && (
          <Card>
            <h3 className="text-lg font-bold">Próximos eventos</h3>
            <div className="mt-4 divide-y divide-sky-blue">
              {upcoming.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-semibold">{event.name}</p>
                    <p className="mt-1 text-sm text-teal">
                      {new Intl.DateTimeFormat('es-CO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(event.startAt))}
                    </p>
                  </div>
                  <span className="text-sm text-teal">
                    {labels[event.status]}
                  </span>
                </div>
              ))}
            </div>
            {upcoming.length === 0 && (
              <p className="mt-4 text-sm text-teal">No hay próximos eventos.</p>
            )}
            <Link
              href="/eventos"
              className="mt-4 inline-block text-sm font-semibold text-teal"
            >
              Ver todos →
            </Link>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
