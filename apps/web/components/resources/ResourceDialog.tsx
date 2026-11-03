'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getResource,
  deactivateResource,
} from '../../services/recursos.service';
import { type Recurso, resourceStatusLabels } from '../../types/recurso';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';
import { ResourceForm } from './ResourceForm';

export function ResourceDialog({
  resourceId,
  onClose,
  onChanged,
}: {
  resourceId?: string;
  onClose: () => void;
  onChanged: (message?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { can } = useAuth();
  const canAdjust = can('inventario.ajustar');
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = `${resourceId}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    resource?: Recurso;
    error?: string;
  } | null>(null);
  const resource = result?.key === key ? result.resource : undefined;
  const error = result?.key === key ? result.error : undefined;
  const loading = !!resourceId && result?.key !== key;

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  useEffect(() => {
    if (!resourceId) return;
    let active = true;
    getResource(resourceId)
      .then((item) => {
        if (active) setResult({ key, resource: item });
      })
      .catch((loadError: unknown) => {
        if (active)
          setResult({
            key,
            error:
              loadError instanceof Error
                ? loadError.message
                : 'No fue posible cargar el recurso.',
          });
      });
    return () => {
      active = false;
    };
  }, [resourceId, key]);

  function close() {
    if (!busy) dialog.current?.close();
  }

  function saved(item: Recurso) {
    if (!resourceId) {
      onChanged('Recurso creado correctamente.');
      dialog.current?.close();
      return;
    }
    setResult({ key, resource: item });
    setEditing(false);
    setNotice('Recurso actualizado correctamente.');
    onChanged();
  }

  async function deactivate() {
    if (!resource || !canAdjust || busy) return;
    setBusy(true);
    setActionError('');
    try {
      const item = await deactivateResource(resource.id);
      setResult({ key, resource: item });
      setConfirming(false);
      setNotice('Recurso desactivado correctamente.');
      onChanged();
    } catch (deactivateError) {
      setActionError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'No fue posible desactivar el recurso.',
      );
    } finally {
      setBusy(false);
    }
  }

  const title = !resourceId
    ? 'Nuevo recurso'
    : editing
      ? 'Editar recurso'
      : confirming
        ? 'Desactivar recurso'
        : (resource?.name ?? 'Detalle del recurso');
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-busy={busy || loading}
      className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Inventario
          </p>
          <h2 id={titleId} className="mt-1 break-words text-2xl font-bold">
            {title}
          </h2>
        </div>
        <Button
          aria-label="Cerrar ventana"
          className="shrink-0 px-3 text-xl leading-none"
          disabled={busy}
          onClick={close}
          type="button"
          variant="ghost"
        >
          ×
        </Button>
      </div>
      <div className="grid min-w-0 gap-5 p-6">
        {loading ? (
          <LoadingState label="Cargando recurso…" />
        ) : error ? (
          <>
            <ErrorMessage message={error} />
            <Button
              onClick={() => setAttempt((value) => value + 1)}
              type="button"
              variant="secondary"
            >
              Reintentar
            </Button>
          </>
        ) : !resourceId && canAdjust ? (
          <ResourceForm
            onSaved={saved}
            onCancel={close}
            onSavingChange={setBusy}
          />
        ) : resource ? (
          <>
            {notice ? (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                {notice}
              </p>
            ) : null}
            {actionError ? <ErrorMessage message={actionError} /> : null}
            {editing && canAdjust ? (
              <ResourceForm
                resource={resource}
                onSaved={saved}
                onCancel={() => setEditing(false)}
                onSavingChange={setBusy}
              />
            ) : confirming && canAdjust ? (
              <>
                <p className="break-words text-sm text-teal">
                  ¿Desactivar {resource.name}? Dejará de aparecer en el
                  inventario de recursos activos.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={busy}
                    type="button"
                    onClick={() => void deactivate()}
                  >
                    {busy ? 'Desactivando…' : 'Confirmar desactivación'}
                  </Button>
                  <Button
                    disabled={busy}
                    variant="secondary"
                    type="button"
                    onClick={() => setConfirming(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="break-words font-semibold text-teal">
                    {resource.type}
                  </p>
                  <span className="rounded-full bg-sky-blue px-3 py-1 text-xs font-semibold">
                    {resourceStatusLabels[resource.status]}
                  </span>
                </div>
                <p className="break-words whitespace-pre-wrap text-sm text-teal">
                  {resource.description || 'Sin descripción.'}
                </p>
                <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
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
                    <div
                      className="min-w-0 rounded-xl bg-beige p-4"
                      key={label}
                    >
                      <dt className="text-sm text-teal">{label}</dt>
                      <dd className="mt-2 break-words font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-3">
                  {canAdjust && resource.status !== 'inactivo' ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => {
                          setEditing(true);
                          setActionError('');
                          setNotice('');
                        }}
                      >
                        Editar recurso
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setConfirming(true);
                          setActionError('');
                          setNotice('');
                        }}
                      >
                        Desactivar recurso
                      </Button>
                    </>
                  ) : null}
                  <Button variant="secondary" type="button" onClick={close}>
                    Cerrar
                  </Button>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </dialog>
  );
}
