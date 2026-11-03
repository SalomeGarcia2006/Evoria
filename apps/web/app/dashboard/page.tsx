'use client';

import Link from 'next/link';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';

const metrics = [
  {
    label: 'Eventos activos',
    value: '12',
    change: '+2 este mes',
    icon: '✦',
    href: '/eventos',
    permission: 'eventos.ver',
    module: 'Eventos',
  },
  {
    label: 'Recursos disponibles',
    value: '84',
    change: 'de 126 en total',
    icon: '◈',
    href: '/inventario',
    permission: 'inventario.ver',
    module: 'Inventario',
  },
  {
    label: 'Presupuesto utilizado',
    value: '$8.4M',
    change: '68% del total',
    icon: '$',
    href: '/presupuestos',
    permission: 'presupuestos.ver',
    module: 'Presupuestos',
  },
  {
    label: 'Alertas pendientes',
    value: '3',
    change: 'Requieren atención',
    icon: '!',
    href: '/alertas',
    permission: 'alertas.ver',
    module: 'Alertas',
  },
];

const events = [
  {
    name: 'Encuentro de innovación',
    date: '18 oct, 2026',
    status: 'En preparación',
    color: 'bg-amber-100 text-amber-800',
  },
  {
    name: 'Feria de emprendimiento',
    date: '24 oct, 2026',
    status: 'Confirmado',
    color: 'bg-emerald-100 text-emerald-800',
  },
  {
    name: 'Jornada de bienestar',
    date: '02 nov, 2026',
    status: 'En preparación',
    color: 'bg-amber-100 text-amber-800',
  },
];

export default function DashboardPage() {
  const { can } = useAuth();
  return (
    <AppShell title="Dashboard">
      <div className="grid gap-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Jueves, 15 de octubre de 2026
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Resumen general
            </h2>
            <p className="mt-1 text-teal">
              Una mirada rápida a la operación de tus eventos.
            </p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            Vista de demostración · datos de ejemplo
          </span>
        </section>

        <section
          aria-label="Métricas principales"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric, index) => {
            const card = (
              <Card className="relative h-full overflow-hidden">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-teal">
                    {metric.label}
                  </p>
                  <span
                    className={`grid size-10 place-items-center rounded-xl text-lg font-bold ${index === 3 ? 'bg-amber-100 text-amber-800' : 'bg-sky-blue/50 text-navy'}`}
                  >
                    {metric.icon}
                  </span>
                </div>
                <p className="mt-5 text-3xl font-bold tracking-tight">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-teal">{metric.change}</p>
              </Card>
            );
            return can(metric.permission) ? (
              <Link
                key={metric.label}
                href={metric.href}
                aria-label={`Ir a ${metric.module}`}
                className="block h-full rounded-2xl transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
              >
                {card}
              </Link>
            ) : (
              <div key={metric.label}>{card}</div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Eventos por estado</h3>
                <p className="mt-1 text-sm text-teal">
                  Distribución de los eventos registrados
                </p>
              </div>
              <span className="rounded-lg bg-beige px-3 py-1.5 text-xs text-teal">
                Este año
              </span>
            </div>
            <div className="mt-7 grid gap-5">
              {[
                ['Confirmados', 58, 'bg-teal'],
                ['En preparación', 27, 'bg-sky-blue'],
                ['Finalizados', 15, 'bg-navy'],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-teal">{value}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-beige">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-sky-blue pt-5 text-xs text-teal">
              <span>12 eventos en total</span>
              <span>4 próximos este mes</span>
            </div>
          </Card>
          <Card>
            <div>
              <h3 className="text-lg font-bold">Presupuesto por evento</h3>
              <p className="mt-1 text-sm text-teal">
                Asignación del presupuesto mensual
              </p>
            </div>
            <div className="mt-6 grid gap-4">
              {[
                ['Encuentro de innovación', '$3.2M', 78],
                ['Feria de emprendimiento', '$2.7M', 64],
                ['Jornada de bienestar', '$1.8M', 46],
              ].map(([name, amount, width]) => (
                <div className="rounded-xl bg-beige/70 p-4" key={name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="font-semibold">{amount}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-sky-blue">
                    <div
                      className="h-full rounded-full bg-teal"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-sky-blue px-6 py-5">
            <div>
              <h3 className="font-bold">Próximos eventos</h3>
              <p className="mt-1 text-sm text-teal">
                Eventos que requieren seguimiento
              </p>
            </div>
            {can('eventos.ver') ? (
              <Link
                href="/eventos"
                className="text-sm font-semibold text-teal hover:underline"
              >
                Ver todos →
              </Link>
            ) : null}
          </div>
          <div className="divide-y divide-sky-blue">
            {events.map((event) => (
              <div
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={event.name}
              >
                <div>
                  <p className="font-semibold">{event.name}</p>
                  <p className="mt-1 text-sm text-teal">{event.date}</p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${event.color}`}
                >
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
