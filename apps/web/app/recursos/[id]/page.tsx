'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { ResourceForm } from '../../../components/resources/ResourceForm';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useAuth } from '../../../hooks/useAuth';
import {
  deactivateResource,
  getResource,
  type ResourceItem,
} from '../../../services/recursos.service';

const statusLabels = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  inactivo: 'Inactivo',
} as const;

export default function RecursoDetallePage() {
  const { can } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<ResourceItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getResource(id)
      .then((result) => {
        if (isMounted) setResource(result);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el recurso.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleDeactivate() {
    if (
      !resource ||
      !window.confirm(`¿Deseas desactivar "${resource.name}"?`)
    ) {
      return;
    }

    setIsDeactivating(true);
    setError(null);
    try {
      setResource(await deactivateResource(resource.id));
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'No se pudo desactivar el recurso.',
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
        {error ? <ErrorMessage message={error} /> : null}
        {isLoading ? <LoadingState label="Cargando recurso…" /> : null}
        {!isLoading && !resource && !error ? (
          <Card>
            <h1 className="text-xl font-bold">Recurso no encontrado</h1>
          </Card>
        ) : null}
        {resource ? (
          isEditing ? (
            <ResourceForm
              onSaved={(savedResource) => {
                setResource(savedResource);
                setIsEditing(false);
              }}
              resource={resource}
            />
          ) : (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
                    {resource.type}
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">{resource.name}</h1>
                </div>
                <StatusBadge status={statusLabels[resource.status]} />
              </div>
              <p className="mt-5 text-teal">
                {resource.description ?? 'Sin descripción registrada.'}
              </p>
              <div className="mt-7 grid gap-4 border-t border-sky-blue pt-6 sm:grid-cols-3">
                <DetailMetric
                  label="Disponibles"
                  value={`${resource.availableQuantity} unidades`}
                />
                <DetailMetric
                  label="Cantidad total"
                  value={`${resource.totalQuantity} unidades`}
                />
                <DetailMetric
                  label="Costo unitario"
                  value={new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    maximumFractionDigits: 0,
                  }).format(resource.unitCost)}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {can('recursos.editar') && resource.status !== 'inactivo' ? (
                  <Button onClick={() => setIsEditing(true)} type="button">
                    Editar recurso
                  </Button>
                ) : null}
                {can('recursos.eliminar') && resource.status !== 'inactivo' ? (
                  <Button
                    disabled={isDeactivating}
                    onClick={() => void handleDeactivate()}
                    type="button"
                    variant="secondary"
                  >
                    {isDeactivating ? 'Desactivando…' : 'Desactivar'}
                  </Button>
                ) : null}
              </div>
            </Card>
          )
        ) : null}
      </div>
    </AppShell>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-beige p-4">
      <p className="text-sm text-teal">{label}</p>
      <p className="mt-2 font-bold">{value}</p>
    </div>
  );
}
