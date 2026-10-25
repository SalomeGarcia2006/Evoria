'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../components/ui/LoadingState';
import { PermissionGate } from '../../../components/auth/PermissionGate';
import { ResourceForm } from '../../../components/resources/ResourceForm';
import {
  getResource,
  deactivateResource,
} from '../../../services/recursos.service';
import { type Recurso, resourceStatusLabels } from '../../../types/recurso';

export default function RecursoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<{
    id: string;
    resource?: Recurso;
    error?: string;
  }>({ id: '' });
  const [attempt, setAttempt] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    getResource(id)
      .then((resource) => {
        if (active) setResult({ id, resource });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            id,
            error:
              error instanceof Error
                ? error.message
                : 'No fue posible cargar el recurso.',
          });
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  const resource = result.id === id ? result.resource : undefined;
  async function deactivate() {
    if (
      isDeactivating ||
      !window.confirm(
        '¿Desactivar este recurso? Dejará de aparecer en el catálogo de recursos activos.',
      )
    )
      return;
    setIsDeactivating(true);
    setActionError('');
    setNotice('');
    try {
      setResult({ id, resource: await deactivateResource(id) });
      setNotice('Recurso desactivado correctamente.');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No fue posible desactivar el recurso.',
      );
    } finally {
      setIsDeactivating(false);
    }
  }
  return (
    <AppShell title="Detalle del recurso">
      <div className="mx-auto grid max-w-3xl gap-6">
        <Link
          className="text-sm font-semibold text-teal hover:underline"
          href="/recursos"
        >
          ← Volver al catálogo
        </Link>
        {result.id !== id ? (
          <LoadingState label="Cargando recurso…" />
        ) : result.error ? (
          <Card>
            <ErrorMessage message={result.error} />
            <Button
              type="button"
              onClick={() => {
                setResult({ id: '' });
                setAttempt((value) => value + 1);
              }}
            >
              Reintentar
            </Button>
          </Card>
        ) : resource ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-3xl font-bold">{resource.name}</h2>
              <span className="text-sm text-teal">
                {resourceStatusLabels[resource.status]}
              </span>
            </div>
            {notice ? (
              <p className="mt-4 text-sm text-teal" role="status">
                {notice}
              </p>
            ) : null}
            {actionError ? <ErrorMessage message={actionError} /> : null}
            {isEditing ? (
              <div className="mt-6">
                <ResourceForm
                  key={resource.id}
                  resource={resource}
                  onSaved={(saved) => {
                    setResult({ id, resource: saved });
                    setIsEditing(false);
                    setNotice('Recurso actualizado correctamente.');
                  }}
                  onCancel={() => setIsEditing(false)}
                />
              </div>
            ) : (
              <>
                <p className="mt-3 font-semibold text-teal">{resource.type}</p>
                <p className="mt-4 whitespace-pre-wrap text-teal">
                  {resource.description || 'Sin descripción.'}
                </p>
                <dl className="my-6 grid gap-4 sm:grid-cols-2">
                  {[
                    ['Cantidad total', resource.totalQuantity],
                    ['Disponibles', resource.availableQuantity],
                    ['Reservados', resource.reservedQuantity],
                    [
                      'Costo unitario',
                      new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                      }).format(resource.unitCost),
                    ],
                  ].map(([label, value]) => (
                    <div className="rounded-xl bg-beige p-4" key={label}>
                      <dt className="text-sm text-teal">{label}</dt>
                      <dd className="mt-2 font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                {resource.status !== 'inactivo' ? (
                  <div className="flex flex-wrap gap-3">
                    <PermissionGate permission="inventario.ajustar">
                      <Button
                        type="button"
                        disabled={isDeactivating}
                        onClick={() => {
                          setIsEditing(true);
                          setActionError('');
                          setNotice('');
                        }}
                      >
                        Editar recurso
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="inventario.ajustar">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isDeactivating}
                        onClick={() => void deactivate()}
                      >
                        {isDeactivating
                          ? 'Desactivando…'
                          : 'Desactivar recurso'}
                      </Button>
                    </PermissionGate>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
