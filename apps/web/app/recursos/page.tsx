'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import {
  deactivateResource,
  getResources,
  type ResourceItem,
} from '../../services/recursos.service';

const statusLabels = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  inactivo: 'Inactivo',
} as const;

function resourceStatus(resource: ResourceItem): string {
  if (resource.status !== 'disponible') return statusLabels[resource.status];
  if (resource.availableQuantity === 0) return 'Agotado';
  if (resource.availableQuantity < resource.totalQuantity) return 'Stock bajo';
  return statusLabels.disponible;
}

export default function RecursosPage() {
  const { can } = useAuth();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getResources()
      .then((result) => {
        if (isMounted) setResources(result.items);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudieron cargar los recursos.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(
    () => ['Todas', ...new Set(resources.map((resource) => resource.type))],
    [resources],
  );
  const visibleResources = useMemo(
    () =>
      resources.filter((resource) => {
        const normalizedQuery = query.trim().toLowerCase();
        const matchesQuery =
          !normalizedQuery ||
          resource.name.toLowerCase().includes(normalizedQuery) ||
          resource.type.toLowerCase().includes(normalizedQuery);
        return (
          matchesQuery && (category === 'Todas' || resource.type === category)
        );
      }),
    [resources, query, category],
  );

  async function handleDeactivate(resource: ResourceItem) {
    if (!window.confirm(`¿Deseas desactivar el recurso "${resource.name}"?`)) {
      return;
    }

    setDeletingId(resource.id);
    setError(null);
    try {
      await deactivateResource(resource.id);
      setResources((currentResources) =>
        currentResources.filter(
          (currentResource) => currentResource.id !== resource.id,
        ),
      );
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'No se pudo desactivar el recurso.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<ResourceItem>[] = [
    {
      key: 'name',
      header: 'Recurso',
      render: (resource) => (
        <Link
          className="font-semibold text-navy underline-offset-4 hover:underline"
          href={`/recursos/${resource.id}`}
        >
          {resource.name}
        </Link>
      ),
    },
    { key: 'type', header: 'Categoría', render: (resource) => resource.type },
    {
      key: 'availableQuantity',
      header: 'Disponibles',
      render: (resource) => (
        <span className="font-semibold">
          {resource.availableQuantity}{' '}
          <span className="font-normal text-teal">
            de {resource.totalQuantity}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (resource) => <StatusBadge status={resourceStatus(resource)} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (resource) => (
        <div className="flex flex-wrap gap-2">
          <Link
            className="text-sm font-semibold text-teal hover:underline"
            href={`/recursos/${resource.id}`}
          >
            Ver
          </Link>
          {can('recursos.eliminar') ? (
            <button
              className="text-sm font-semibold text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deletingId === resource.id}
              onClick={() => void handleDeactivate(resource)}
              type="button"
            >
              {deletingId === resource.id ? 'Desactivando…' : 'Desactivar'}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Recursos">
      <div className="grid gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Operación
            </p>
            <h1 className="mt-2 text-3xl font-bold">Catálogo de recursos</h1>
            <p className="mt-1 text-teal">
              Consulta existencias y disponibilidad para tus eventos.
            </p>
          </div>
          {can('recursos.crear') ? (
            <Link
              className="inline-flex items-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              href="/recursos/nuevo"
            >
              + Nuevo recurso
            </Link>
          ) : null}
        </div>

        {error ? <ErrorMessage message={error} /> : null}
        {isLoading ? <LoadingState label="Cargando recursos…" /> : null}

        {!isLoading ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-sm text-teal">Recursos registrados</p>
                <p className="mt-3 text-3xl font-bold">{resources.length}</p>
                <p className="mt-1 text-xs text-teal">En el catálogo</p>
              </Card>
              <Card>
                <p className="text-sm text-teal">Unidades disponibles</p>
                <p className="mt-3 text-3xl font-bold">
                  {resources.reduce(
                    (sum, resource) => sum + resource.availableQuantity,
                    0,
                  )}
                </p>
                <p className="mt-1 text-xs text-teal">Suma de existencias</p>
              </Card>
              <Card>
                <p className="text-sm text-teal">Por revisar</p>
                <p className="mt-3 text-3xl font-bold">
                  {
                    resources.filter(
                      (resource) => resourceStatus(resource) !== 'Disponible',
                    ).length
                  }
                </p>
                <p className="mt-1 text-xs text-teal">
                  Stock bajo, agotado o mantenimiento
                </p>
              </Card>
            </div>

            <Card className="p-0">
              <div className="flex flex-col gap-4 border-b border-sky-blue px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-bold">Todos los recursos</h2>
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
                    {categories.map((resourceCategory) => (
                      <option key={resourceCategory}>{resourceCategory}</option>
                    ))}
                  </select>
                </div>
              </div>
              {resources.length === 0 ? (
                <p className="p-8 text-center text-sm text-teal">
                  No hay recursos registrados todavía.
                </p>
              ) : (
                <DataTable
                  columns={columns}
                  rowKey={(resource) => resource.id}
                  rows={visibleResources}
                />
              )}
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
