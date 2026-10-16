'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Recurso } from '../../types/recurso';

const demoResources: Recurso[] = [
  {
    id: 'r-01',
    name: 'Sillas plegables',
    type: 'Mobiliario',
    availableQuantity: 120,
    status: 'Disponible',
  },
  {
    id: 'r-02',
    name: 'Proyector audiovisual',
    type: 'Tecnología',
    availableQuantity: 8,
    status: 'Disponible',
  },
  {
    id: 'r-03',
    name: 'Carpas 3 × 3 m',
    type: 'Mobiliario',
    availableQuantity: 2,
    status: 'Stock bajo',
  },
  {
    id: 'r-04',
    name: 'Micrófonos inalámbricos',
    type: 'Tecnología',
    availableQuantity: 14,
    status: 'Disponible',
  },
  {
    id: 'r-05',
    name: 'Mesas rectangulares',
    type: 'Mobiliario',
    availableQuantity: 0,
    status: 'Agotado',
  },
];

export default function RecursosPage() {
  const resources = demoResources;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const visibleResources = useMemo(
    () =>
      resources.filter((resource) => {
        const matchesQuery = resource.name
          .toLowerCase()
          .includes(query.toLowerCase());
        return (
          matchesQuery && (category === 'Todas' || resource.type === category)
        );
      }),
    [resources, query, category],
  );

  return (
    <AppShell title="Recursos">
      <div className="grid gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Operación
            </p>
            <h2 className="mt-2 text-3xl font-bold">Catálogo de recursos</h2>
            <p className="mt-1 text-teal">
              Consulta existencias y disponibilidad para tus eventos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              Demostración · datos locales
            </span>
            <Link
              className="inline-flex items-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              href="/recursos/nuevo"
            >
              ＋ Nuevo recurso
            </Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              'Recursos registrados',
              String(resources.length),
              'En el catálogo',
            ],
            [
              'Unidades disponibles',
              String(
                resources.reduce(
                  (sum, resource) => sum + (resource.availableQuantity ?? 0),
                  0,
                ),
              ),
              'Suma de existencias',
            ],
            [
              'Por revisar',
              String(
                resources.filter((resource) => resource.status !== 'Disponible')
                  .length,
              ),
              'Stock bajo o agotado',
            ],
          ].map(([title, value, hint]) => (
            <Card key={title}>
              <p className="text-sm text-teal">{title}</p>
              <p className="mt-3 text-3xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-teal">{hint}</p>
            </Card>
          ))}
        </div>
        <Card className="p-0">
          <div className="flex flex-col gap-4 border-b border-sky-blue px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-bold">Todos los recursos</h3>
              <p className="mt-1 text-sm text-teal">
                {visibleResources.length} resultados
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="resource-search">
                Buscar recurso
              </label>
              <input
                className="min-w-56 rounded-lg border border-sky-blue bg-white px-3 py-2 text-sm"
                id="resource-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar recurso..."
                value={query}
              />
              <label className="sr-only" htmlFor="resource-category">
                Categoría
              </label>
              <select
                className="rounded-lg border border-sky-blue bg-white px-3 py-2 text-sm"
                id="resource-category"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option>Todas</option>
                <option>Mobiliario</option>
                <option>Tecnología</option>
              </select>
            </div>
          </div>
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Recurso',
                render: (resource) => (
                  <span className="font-semibold">{resource.name}</span>
                ),
              },
              {
                key: 'type',
                header: 'Categoría',
                render: (resource) => resource.type ?? '—',
              },
              {
                key: 'quantity',
                header: 'Disponibles',
                render: (resource) => (
                  <span className="font-semibold">
                    {resource.availableQuantity ?? 0}{' '}
                    <span className="font-normal text-teal">unid.</span>
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Estado',
                render: (resource) => (
                  <StatusBadge status={resource.status ?? 'Sin estado'} />
                ),
              },
              {
                key: 'actions',
                header: 'Acción',
                render: (resource) => (
                  <Link
                    className="font-semibold text-teal hover:underline"
                    href={`/recursos/${resource.id}`}
                  >
                    Ver detalle →
                  </Link>
                ),
              },
            ]}
            rowKey={(resource) => resource.id}
            rows={visibleResources}
          />
          <p className="border-t border-sky-blue px-6 py-3 text-xs text-teal">
            La API de recursos aún no está implementada; los cambios de esta
            vista no se guardan.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
