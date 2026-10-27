'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingState } from '../../components/ui/LoadingState';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { useRecursos } from '../../hooks/useRecursos';
import { resourceStatusLabels, type ResourceStatus } from '../../types/recurso';

export default function InventarioPage() {
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    status: '' as ResourceStatus | '',
    page: 1,
  });
  const { recursos, pagination, isLoading, error, retry } =
    useRecursos(filters);
  return (
    <AppShell title="Inventario">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PermissionGate permission="asignaciones.ver">
            <Link
              href="/recursos/asignaciones"
              className="font-semibold text-teal underline"
            >
              Asignar recursos a eventos →
            </Link>
          </PermissionGate>
          <div>
            <h2 className="text-3xl font-bold">Inventario</h2>
            <p className="mt-2 text-teal">
              Administra los equipos, materiales y servicios disponibles de tu
              empresa.
            </p>
          </div>
          <PermissionGate permission="inventario.ajustar">
            <Link
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white"
              href="/inventario/nuevo"
            >
              ＋ Nuevo recurso
            </Link>
          </PermissionGate>
        </div>
        <Card className="min-w-0">
          <form
            className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setFilters({
                search: String(data.get('search') ?? '').trim(),
                type: String(data.get('type') ?? '').trim(),
                status: String(data.get('status') ?? '') as ResourceStatus | '',
                page: 1,
              });
            }}
          >
            <label className="grid min-w-0 gap-2 text-sm font-semibold">
              Buscar
              <input
                className="min-w-0 rounded-lg border border-sky-blue px-3 py-2"
                name="search"
                placeholder="Nombre o tipo"
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">
              Tipo
              <input
                className="min-w-0 rounded-lg border border-sky-blue px-3 py-2"
                name="type"
                placeholder="Ej. Tecnología"
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">
              Estado
              <select
                className="min-w-0 rounded-lg border border-sky-blue bg-white px-3 py-2"
                name="status"
              >
                <option value="">Activos</option>
                {Object.entries(resourceStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="self-end">
              Buscar
            </Button>
          </form>
        </Card>
        {isLoading ? (
          <LoadingState label="Cargando recursos…" />
        ) : error ? (
          <Card className="min-w-0">
            <ErrorMessage message={error} />
            <Button type="button" variant="secondary" onClick={retry}>
              Reintentar
            </Button>
          </Card>
        ) : (
          <Card className="min-w-0">
            <p className="mb-4 text-sm text-teal">
              {pagination?.total ?? 0} recursos encontrados
            </p>
            {recursos.length === 0 ? (
              <p role="status" className="py-6 text-teal">
                No hay recursos que coincidan con la búsqueda.
              </p>
            ) : (
              <DataTable
                rows={recursos}
                rowKey={(resource) => resource.id}
                columns={[
                  {
                    key: 'name',
                    header: 'Recurso',
                    render: (resource) => resource.name,
                  },
                  {
                    key: 'type',
                    header: 'Tipo',
                    render: (resource) => resource.type,
                  },
                  {
                    key: 'total',
                    header: 'Total',
                    render: (resource) => resource.totalQuantity,
                  },
                  {
                    key: 'available',
                    header: 'Disponibles',
                    render: (resource) => resource.availableQuantity,
                  },
                  {
                    key: 'reserved',
                    header: 'Reservados',
                    render: (resource) => resource.reservedQuantity,
                  },
                  {
                    key: 'status',
                    header: 'Estado',
                    render: (resource) => resourceStatusLabels[resource.status],
                  },
                  {
                    key: 'action',
                    header: 'Acción',
                    render: (resource) => (
                      <Link
                        className="font-semibold text-teal hover:underline"
                        href={`/inventario/${resource.id}`}
                      >
                        Ver detalle →
                      </Link>
                    ),
                  },
                ]}
              />
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={filters.page <= 1}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                Anterior
              </Button>
              <span className="text-sm text-teal">
                Página {pagination?.page ?? filters.page} de{' '}
                {Math.max(1, pagination?.totalPages ?? 1)}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={filters.page >= (pagination?.totalPages ?? 0)}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Siguiente
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
