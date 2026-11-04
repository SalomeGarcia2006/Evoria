'use client';
import { useEffect, useState } from 'react';
import {
  PROVIDER_CATEGORIES,
  type Provider,
  type ProviderCategory,
  type ProviderList,
  type ProviderStatus,
} from '@evoria/contracts';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ProviderFormDialog } from '../../components/providers/ProviderFormDialog';
import { ConfirmProviderAction } from '../../components/providers/ConfirmProviderAction';
import { categoryLabels, inputClass } from '../../components/providers/fields';
import {
  getProviders,
  deactivateProvider,
} from '../../services/providers.service';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';

export default function ProveedoresPage() {
  const { user } = useAuth();
  return <ProvidersContent key={`${user?.tenant?.id}:${user?.id}`} />;
}
function ProvidersContent() {
  const { can } = useAuth();
  const allowed = can('proveedores.ver');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProviderCategory | ''>('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProviderStatus | ''>('');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: ProviderList;
    error?: string;
  }>();
  const [panel, setPanel] = useState<Provider | 'create' | null>(null);
  const [deactivating, setDeactivating] = useState<Provider | null>(null);
  const [notice, setNotice] = useState('');
  const key = JSON.stringify([search, category, status, page, revision]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const timer = setTimeout(() => {
      getProviders({
        search,
        category: category || undefined,
        status: status || undefined,
        page,
        limit: 10,
      })
        .then((data) => {
          if (active) setResult({ key, data });
        })
        .catch((error: unknown) => {
          if (active)
            setResult({
              key,
              error: apiErrorMessage(error),
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allowed, search, category, status, page, key]);
  const data = result?.key === key ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  function saved(message: string) {
    setPanel(null);
    setDeactivating(null);
    setNotice(message);
    setRevision((value) => value + 1);
  }
  return (
    <AppShell title="Proveedores">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Proveedores</h1>
            <p className="mt-2 text-teal">
              Contactos y categorías de los proveedores de tu empresa.
            </p>
          </div>
          {can('proveedores.crear') && (
            <Button onClick={() => setPanel('create')}>Crear proveedor</Button>
          )}
        </div>
        {notice && (
          <p role="status" className="rounded-lg bg-sky-blue p-3">
            {notice}
          </p>
        )}
        <Card className="min-w-0">
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              Buscar por nombre o contacto
              <input
                className={inputClass}
                maxLength={120}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Categoría
              <select
                aria-label="Categoría"
                className={inputClass}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as ProviderCategory | '');
                  setPage(1);
                }}
              >
                <option value="">Todas las categorías</option>
                {PROVIDER_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {categoryLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Estado
              <select
                className={inputClass}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as ProviderStatus | '');
                  setPage(1);
                }}
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
          </div>
          {error ? (
            <>
              <ErrorMessage message={error} />
              <Button onClick={() => setRevision((value) => value + 1)}>
                Reintentar
              </Button>
            </>
          ) : !data ? (
            <LoadingState label="Cargando proveedores…" />
          ) : (
            <>
              {!data.items.length ? (
                <p className="py-8 text-center text-teal">
                  No hay proveedores que coincidan con estos filtros.
                </p>
              ) : (
                <DataTable
                  rows={data.items}
                  rowKey={(item) => item.id}
                  columns={[
                    {
                      key: 'name',
                      header: 'Proveedor',
                      render: (item) => <strong>{item.name}</strong>,
                    },
                    {
                      key: 'categories',
                      header: 'Categorías',
                      render: (item) =>
                        item.categoryKeys
                          .map((value) => categoryLabels[value])
                          .join(', '),
                    },
                    ...(
                      ['contactName', 'phone', 'email', 'location'] as const
                    ).map((value, index) => ({
                      key: value,
                      header: ['Contacto', 'Teléfono', 'Correo', 'Ubicación'][
                        index
                      ],
                      render: (item: Provider) => item[value] || '—',
                    })),
                    {
                      key: 'status',
                      header: 'Estado',
                      render: (item) => (
                        <span
                          className={
                            item.status === 'activo'
                              ? 'font-semibold text-teal'
                              : 'text-slate-500'
                          }
                        >
                          {item.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      ),
                    },
                    {
                      key: 'actions',
                      header: 'Acciones',
                      render: (item) => (
                        <div className="flex gap-2">
                          {can('proveedores.editar') && (
                            <Button
                              variant="ghost"
                              onClick={() => setPanel(item)}
                            >
                              Editar
                            </Button>
                          )}
                          {can('proveedores.desactivar') &&
                            item.status === 'activo' && (
                              <Button
                                variant="ghost"
                                onClick={() => setDeactivating(item)}
                              >
                                Desactivar
                              </Button>
                            )}
                        </div>
                      ),
                    },
                  ]}
                />
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  {data.pagination.total} proveedores · Página {page} de{' '}
                  {Math.max(1, data.pagination.totalPages)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
        {panel && (
          <ProviderFormDialog
            provider={panel === 'create' ? undefined : panel}
            onClose={() => setPanel(null)}
            onSaved={() => saved('Proveedor guardado correctamente.')}
          />
        )}
        {deactivating && (
          <ConfirmProviderAction
            title="Desactivar proveedor"
            description={`¿Desactivar a ${deactivating.name}? Sus acuerdos históricos se conservarán.`}
            action={() => deactivateProvider(deactivating.id)}
            onClose={() => setDeactivating(null)}
            onSaved={() => saved('Proveedor desactivado correctamente.')}
          />
        )}
      </div>
    </AppShell>
  );
}
