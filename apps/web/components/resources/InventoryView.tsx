'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import { resourceStatusLabels } from '../../types/recurso';

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
  useEffect(() => {
    if (error) notify(error, 'error');
  }, [error, notify]);
  function closePanel() {
    setPanel(null);
    if (initialCreate || initialResourceId)
      router.replace('/inventario', { scroll: false });
  }
  return (
    <AppShell title="Inventario">
      <div className="grid min-w-0 gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Inventario</h2>
            <p className="mt-2 text-muted">
              Equipos y materiales activos de tu empresa. Abre una tarjeta para
              consultar o ajustar el recurso.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={retry}>
              Actualizar
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
        <PermissionGate permission="asignaciones.ver">
          <Link
            href="/recursos/asignaciones"
            className="font-semibold text-muted underline"
          >
            Asignar recursos a eventos →
          </Link>
        </PermissionGate>
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
                ['Recursos activos', activeResources.length],
                ['Unidades disponibles', available],
                ['Unidades reservadas', reserved],
              ].map(([label, value]) => (
                <Card key={label} density="compact">
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-2 text-xl font-bold">{value}</p>
                </Card>
              ))}
            </section>
            {!activeResources.length ? (
              <Card>
                <h3 className="font-bold">Todavía no hay recursos activos</h3>
                <p className="mt-2 text-sm text-muted">
                  Los recursos disponibles y en mantenimiento aparecerán aquí al
                  registrarlos.
                </p>
              </Card>
            ) : (
              <section
                aria-label="Recursos activos"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              >
                {activeResources.map((resource) => (
                  <Card
                    key={resource.id}
                    density="compact"
                    className="flex min-w-0 flex-col"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3
                        title={resource.name}
                        className="line-clamp-2 break-words text-base font-bold"
                      >
                        {resource.name}
                      </h3>
                      <span className="rounded-full bg-beige px-3 py-1 text-xs font-semibold">
                        {resourceStatusLabels[resource.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{resource.type}</p>
                    {resource.description && (
                      <p
                        className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs"
                        title={resource.description}
                      >
                        {resource.description}
                      </p>
                    )}
                    <dl className="my-3 grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['Total', resource.totalQuantity],
                        [
                          'Disponibles',
                          resource.status === 'disponible'
                            ? resource.availableQuantity
                            : 0,
                        ],
                        ['Reservadas', resource.reservedQuantity],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-muted">{label}</dt>
                          <dd className="mt-1 text-lg font-bold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Button
                      className="mt-auto self-start"
                      variant="secondary"
                      onClick={() => {
                        feedback.dismiss();
                        setPanel({ kind: 'detail', id: resource.id });
                      }}
                    >
                      Ver detalle →
                    </Button>
                  </Card>
                ))}
              </section>
            )}
          </>
        )}
        {panel && (panel.kind !== 'create' || can('inventario.ajustar')) && (
          <ResourceDialog
            key={panel.kind === 'create' ? 'new' : panel.id}
            resourceId={panel.kind === 'detail' ? panel.id : undefined}
            onClose={closePanel}
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
