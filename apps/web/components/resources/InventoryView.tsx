'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { ResourceDialog } from './ResourceDialog';
import { AppShell } from '../layout/AppShell';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/LoadingState';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { PermissionGate } from '../auth/PermissionGate';
import { useRecursos } from '../../hooks/useRecursos';
import { resourceStatusLabels, type ResourceStatus } from '../../types/recurso';

const resourceStatusClasses: Record<ResourceStatus, string> = {
  disponible: 'bg-teal/15 text-teal',
  mantenimiento: 'bg-amber-100 text-amber-800',
  inactivo: 'bg-sky-blue text-navy',
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function InventoryView({
  initialCreate = false,
  initialResourceId,
}: {
  initialCreate?: boolean;
  initialResourceId?: string;
}) {
  const { can } = useAuth();
  const router = useRouter();
  const [panel, setPanel] = useState<
    { kind: 'create' } | { kind: 'detail'; id: string } | null
  >(() =>
    initialCreate
      ? { kind: 'create' }
      : initialResourceId
        ? { kind: 'detail', id: initialResourceId }
        : null,
  );
  const feedback = useFeedback();
  const { notify } = feedback;
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const refreshRequested = useRef(false);
  const { recursos, isLoading, error, retry } = useRecursos({}, true);
  const activeResources = recursos.filter(
    (resource) => resource.status !== 'inactivo',
  );
  const available = activeResources.reduce(
    (total, resource) =>
      total +
      (resource.status === 'disponible' ? resource.availableQuantity : 0),
    0,
  );
  const reserved = activeResources.reduce(
    (total, resource) => total + resource.reservedQuantity,
    0,
  );
  const resourceTypes = Array.from(
    new Set(activeResources.map((resource) => resource.type)),
  ).sort((first, second) => first.localeCompare(second, 'es'));
  const normalizedSearch = normalizeText(search);
  const visibleResources = activeResources.filter(
    (resource) =>
      (!selectedType || resource.type === selectedType) &&
      (!normalizedSearch ||
        [resource.name, resource.type, resource.description ?? ''].some(
          (value) => normalizeText(value).includes(normalizedSearch),
        )),
  );
  useEffect(() => {
    if (error) notify(error, 'error');
  }, [error, notify]);

  useEffect(() => {
    if (!refreshRequested.current || isLoading) return;
    refreshRequested.current = false;
    if (!error) notify('Inventario actualizado correctamente.');
  }, [error, isLoading, notify]);

  function refreshInventory() {
    feedback.dismiss();
    refreshRequested.current = true;
    retry();
  }

  function closePanel() {
    setPanel(null);
    if (initialCreate || initialResourceId)
      router.replace('/inventario', { scroll: false });
  }
  return (
    <AppShell hideTitle title="Inventario">
      <div className="grid min-w-0 gap-5">
        <header className="events-hero">
          <div>
            <h1 className="text-4xl font-bold">Inventario</h1>
            <p className="mt-2 text-muted">
              Consulta y administra los equipos y materiales de tu empresa.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={isLoading}
              variant="secondary"
              onClick={refreshInventory}
            >
              {isLoading ? 'Actualizando…' : 'Actualizar'}
            </Button>
            <PermissionGate permission="inventario.ajustar">
              <Button
                onClick={() => {
                  feedback.dismiss();
                  setPanel({ kind: 'create' });
                }}
              >
                Nuevo recurso
              </Button>
            </PermissionGate>
          </div>
        </header>
        <FeedbackMessages feedback={feedback} />
        {!can('inventario.ver') ? (
          <Card>No tienes permiso para consultar el inventario.</Card>
        ) : isLoading ? (
          <LoadingState label="Cargando recursos…" />
        ) : error ? (
          <Card>
            <p className="text-red-800">{error}</p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                feedback.dismiss();
                retry();
              }}
            >
              Reintentar
            </Button>
          </Card>
        ) : (
          <>
            <section
              aria-label="Resumen de inventario"
              className="grid gap-4 sm:grid-cols-3"
            >
              {[
                {
                  label: 'Recursos activos',
                  value: activeResources.length,
                  detail: 'Equipos y materiales registrados',
                  icon: '/icons/activosrecursos.svg',
                  tone: 'bg-linear-to-br from-violet to-[#9B87FF] shadow-[0_10px_20px_rgba(106,76,255,0.22)]',
                },
                {
                  label: 'Unidades disponibles',
                  value: available,
                  detail: 'Listas para asignar a eventos',
                  icon: '/icons/unidadesdiponibles.svg',
                  tone: 'bg-linear-to-br from-teal to-[#5BE0D2] shadow-[0_10px_20px_rgba(18,181,166,0.2)]',
                },
                {
                  label: 'Unidades reservadas',
                  value: reserved,
                  detail: 'Comprometidas en eventos activos',
                  icon: '/icons/FECHA.svg',
                  tone: 'bg-linear-to-br from-coral to-amber shadow-[0_10px_20px_rgba(255,93,115,0.2)]',
                },
              ].map((metric) => (
                <Card
                  className="flex items-center gap-4"
                  key={metric.label}
                  density="compact"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl font-bold ${metric.tone}`}
                  >
                    <Image
                      alt=""
                      aria-hidden="true"
                      height={24}
                      src={metric.icon}
                      width={24}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-muted">{metric.label}</p>
                    <p className="mt-1 text-2xl font-bold">
                      {new Intl.NumberFormat('es-CO').format(metric.value)}
                    </p>
                    <p className="mt-1 text-xs text-muted">{metric.detail}</p>
                  </div>
                </Card>
              ))}
            </section>
            <section
              className="events-list-panel p-5"
              aria-label="Recursos del inventario"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sky-blue pb-5">
                <div>
                  <h3 className="text-xl font-bold">Recursos del inventario</h3>
                  <p className="mt-1 text-sm text-muted">
                    {visibleResources.length} de {activeResources.length}{' '}
                    recursos visibles
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
                  <label className="sr-only" htmlFor="inventory-search">
                    Buscar recurso
                  </label>
                  <input
                    className="min-w-48 flex-1 rounded-xl border border-sky-blue bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue lg:w-52"
                    id="inventory-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="⌕  Buscar recurso..."
                    type="search"
                    value={search}
                  />
                  <label className="sr-only" htmlFor="inventory-type">
                    Categoría
                  </label>
                  <select
                    className="rounded-xl border border-sky-blue bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                    id="inventory-type"
                    onChange={(event) => setSelectedType(event.target.value)}
                    value={selectedType}
                  >
                    <option value="">Todas las categorías</option>
                    {resourceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <PermissionGate permission="asignaciones.ver">
                    <Link
                      className="rounded-xl border border-violet/30 bg-violet/5 px-4 py-2 text-sm font-semibold text-violet transition hover:bg-violet/10"
                      href="/recursos/asignaciones"
                    >
                      Asignar a eventos →
                    </Link>
                  </PermissionGate>
                </div>
              </div>
              {!activeResources.length ? (
                <div className="py-10 text-center">
                  <h3 className="font-bold">Todavía no hay recursos activos</h3>
                  <p className="mt-2 text-sm text-muted">
                    Los recursos disponibles y en mantenimiento aparecerán aquí
                    al registrarlos.
                  </p>
                </div>
              ) : !visibleResources.length ? (
                <div className="py-10 text-center">
                  <h3 className="font-bold">No encontramos recursos</h3>
                  <p className="mt-2 text-sm text-muted">
                    Prueba con otro nombre o categoría.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {visibleResources.map((resource) => (
                    <Card
                      key={resource.id}
                      density="compact"
                      className="flex min-w-0 flex-col rounded-[1.375rem] border-violet/20 border-t-[3px] border-t-violet p-5 shadow-[0_14px_30px_rgba(20,33,61,0.12)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-words text-xs font-bold uppercase tracking-[.14em] text-muted">
                          {resource.type}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${resourceStatusClasses[resource.status]}`}
                        >
                          {resourceStatusLabels[resource.status]}
                        </span>
                      </div>
                      <h4
                        title={resource.name}
                        className="mt-5 line-clamp-2 break-words text-2xl font-bold leading-tight"
                      >
                        {resource.name}
                      </h4>
                      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
                        <div className="min-w-0">
                          <p className="whitespace-nowrap tabular-nums text-2xl font-bold leading-none tracking-tight text-violet">
                            {new Intl.NumberFormat('es-CO').format(
                              resource.status === 'disponible'
                                ? resource.availableQuantity
                                : 0,
                            )}
                          </p>
                          <p className="mt-2 text-sm font-medium text-muted">
                            Unidades disponibles
                          </p>
                        </div>
                        <dl className="grid gap-2 rounded-xl bg-violet/5 px-3 py-3 text-xs">
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted">Total</dt>
                            <dd className="font-bold">
                              {new Intl.NumberFormat('es-CO').format(
                                resource.totalQuantity,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted">Reservadas</dt>
                            <dd className="font-bold">
                              {new Intl.NumberFormat('es-CO').format(
                                resource.reservedQuantity,
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="my-5 border-t border-violet/20" />
                      <Button
                        className="mt-auto self-end px-0 py-0 text-base text-violet shadow-none hover:bg-transparent"
                        variant="ghost"
                        onClick={() => {
                          feedback.dismiss();
                          setPanel({ kind: 'detail', id: resource.id });
                        }}
                      >
                        Ver detalle →
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {panel && (panel.kind !== 'create' || can('inventario.ajustar')) && (
          <ResourceDialog
            key={panel.kind === 'create' ? 'new' : panel.id}
            existingResources={recursos}
            resourceId={panel.kind === 'detail' ? panel.id : undefined}
            onClose={closePanel}
            onFormAlert={(title, message) =>
              feedback.guide(message, title, 'error')
            }
            onChanged={(message) => {
              retry();
              if (message) notify(message);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
