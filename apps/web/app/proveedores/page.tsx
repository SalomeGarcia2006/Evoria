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
import { Button } from '../../components/ui/Button';
import { PageHero } from '../../components/ui/PageHero';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import panelHeadingStyles from '../../components/ui/PanelHeading.module.css';
import cardStyles from '../../components/ui/InventoryStyleCard.module.css';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
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
  const feedback = useFeedback();
  const allowed = can('proveedores.ver');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProviderCategory | ''>('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProviderStatus | ''>('');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    queryKey: string;
    data?: ProviderList;
    error?: string;
  }>();
  const [panel, setPanel] = useState<Provider | 'create' | null>(null);
  const [deactivating, setDeactivating] = useState<Provider | null>(null);
  const [notice, setNotice] = useState('');
  const queryKey = JSON.stringify([search, category, status, page]);
  const key = JSON.stringify([queryKey, revision]);
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
          if (active) setResult({ key, queryKey, data });
        })
        .catch((error: unknown) => {
          if (active)
            setResult((previous) => ({
              key,
              queryKey,
              data: previous?.queryKey === queryKey ? previous.data : undefined,
              error: apiErrorMessage(error),
            }));
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allowed, search, category, status, page, key, queryKey]);
  const data = result?.queryKey === queryKey ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  function saved(message: string, showModal = false) {
    setPanel(null);
    setDeactivating(null);
    setNotice(showModal ? '' : message);
    if (showModal) feedback.notify(message);
    setRevision((value) => value + 1);
  }
  return (
    <AppShell hideTitle title="Proveedores">
      <div className="grid min-w-0 gap-6">
        <FeedbackMessages feedback={feedback} />
        <PageHero
          title="Proveedores"
          description="Contactos y categorías de los proveedores de tu empresa."
          actions={
            can('proveedores.crear') && (
              <Button onClick={() => setPanel('create')}>
                Crear proveedor
              </Button>
            )
          }
        />
        <ModuleBanner
          icon="provedores.svg"
          title="Contactos para tus eventos"
          description="Consulta los proveedores y filtra el directorio por nombre, categoría o estado."
        />
        {notice && (
          <p role="status" className="rounded-lg bg-sky-blue p-3">
            {notice}
          </p>
        )}
        <section
          className="module-panel"
          aria-label="Directorio de proveedores"
        >
          <div
            className={`module-panel__heading ${panelHeadingStyles.heading}`}
          >
            <h2 className="text-xl font-bold">Directorio de proveedores</h2>
            <p className="mt-1 text-sm text-muted">
              Busca y administra los contactos de tu empresa.
            </p>
          </div>
          <div className="module-panel__content">
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
            {error && data && (
              <>
                <ErrorMessage message={error} />
                <Button onClick={() => setRevision((value) => value + 1)}>
                  Reintentar
                </Button>
              </>
            )}
            {error && !data ? (
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
                  <p className="py-8 text-center text-muted">
                    No hay proveedores que coincidan con estos filtros.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {data.items.map((item) => (
                      <article
                        key={item.id}
                        className={`${cardStyles.card} flex flex-col`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="break-words text-xs font-bold uppercase tracking-[.14em] text-muted">
                            {item.categoryKeys
                              .map((value) => categoryLabels[value])
                              .join(', ')}
                          </p>
                          <span className="shrink-0 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
                            {item.status === 'activo' ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <h3 className="mt-5 break-words text-2xl font-bold leading-tight">
                          {item.name}
                        </h3>
                        <dl className="my-5 grid gap-2 rounded-xl bg-violet/5 p-3 text-sm">
                          {(
                            [
                              ['Contacto', item.contactName],
                              ['Teléfono', item.phone],
                              ['Correo', item.email],
                              ['Ubicación', item.location],
                            ] as const
                          ).map(([label, value]) => (
                            <div
                              key={label}
                              className="flex flex-wrap justify-between gap-x-3"
                            >
                              <dt className="text-muted">{label}</dt>
                              <dd className="min-w-0 break-all text-right font-semibold">
                                {value || '—'}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {item.status === 'activo' &&
                          (can('proveedores.editar') ||
                            can('proveedores.desactivar')) && (
                            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-violet/20 pt-3">
                              {can('proveedores.editar') && (
                                <Button
                                  variant="ghost"
                                  onClick={() => setPanel(item)}
                                >
                                  Editar
                                </Button>
                              )}
                              {can('proveedores.desactivar') && (
                                <Button
                                  variant="ghost"
                                  onClick={() => setDeactivating(item)}
                                >
                                  Desactivar
                                </Button>
                              )}
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
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
          </div>
        </section>
        {panel && (
          <ProviderFormDialog
            provider={panel === 'create' ? undefined : panel}
            onClose={() => setPanel(null)}
            onSaved={() =>
              panel === 'create'
                ? saved('Proveedor guardado correctamente.')
                : saved(
                    'La información del proveedor se actualizó correctamente.',
                    true,
                  )
            }
          />
        )}
        {deactivating && (
          <ConfirmProviderAction
            title="Desactivar proveedor"
            confirmationText="DESACTIVAR"
            description={`¿Desactivar a ${deactivating.name}? No podrá seleccionarse para nuevos servicios. Sus acuerdos se conservarán y actualmente no es posible reactivarlo desde la aplicación.`}
            action={() => deactivateProvider(deactivating.id)}
            onClose={() => setDeactivating(null)}
            onSaved={() => saved('Proveedor desactivado correctamente.')}
          />
        )}
      </div>
    </AppShell>
  );
}
