'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  assignEventResource,
  getAvailableInventory,
  getEventResources,
  releaseEventResource,
  type EventResourceAssignment,
} from '../../services/recursos.service';
import type { Recurso } from '../../types/recurso';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { ErrorMessage } from '../ui/ErrorMessage';
import { LoadingState } from '../ui/LoadingState';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { apiErrorMessage } from '../../services/api';
import { Field, inputClass } from '../providers/fields';
import { EmptyState } from '../ui/EmptyState';
import { AssignmentIcon } from './AssignmentIcon';

export function EventResources({
  eventId,
  cancelled = false,
  editable = false,
  budgetReady = true,
  onChanged,
  onBusyChange,
  inDialog = false,
}: {
  eventId: string;
  cancelled?: boolean;
  editable?: boolean;
  budgetReady?: boolean;
  onChanged?: () => void;
  onBusyChange?: (busy: boolean) => void;
  inDialog?: boolean;
}) {
  const { can } = useAuth();
  const canView = can('asignaciones.ver');
  const canAssign =
    editable &&
    canView &&
    can('asignaciones.crear') &&
    can('inventario.ver') &&
    budgetReady &&
    !cancelled;
  const [assignments, setAssignments] = useState<EventResourceAssignment[]>([]);
  const [inventory, setInventory] = useState<Recurso[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLoadedKey, setInventoryLoadedKey] = useState('');
  const feedback = useFeedback();
  const { notify } = feedback;
  const [revision, setRevision] = useState(0);
  const inventoryKey = `${eventId}:${revision}:${canAssign}`;
  const inventoryLoading = canAssign && inventoryLoadedKey !== inventoryKey;
  const selected = inventory.find((item) => item.id === selectedId);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    getEventResources(eventId)
      .then((items) => {
        if (active) {
          setAssignments(items);
          setLoadError('');
        }
      })
      .catch((error: unknown) => {
        if (active && editable) notify(apiErrorMessage(error), 'error');
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar las asignaciones.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, eventId, revision, editable, notify]);

  useEffect(() => {
    if (!canAssign) return;
    let active = true;
    getAvailableInventory()
      .then((items) => {
        if (active) {
          setInventory(items);
          setInventoryError('');
          setInventoryLoadedKey(inventoryKey);
        }
      })
      .catch((error: unknown) => {
        if (active) notify(apiErrorMessage(error), 'error');
        if (active) {
          setInventory([]);
          setInventoryLoadedKey(inventoryKey);
          setInventoryError(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar las existencias.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [canAssign, eventId, revision, notify, inventoryKey]);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(quantity);
    if (busy || !canAssign) return;
    if (
      !selected ||
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > selected.availableQuantity
    ) {
      feedback.guide(
        'Selecciona un recurso y una cantidad entera dentro de las existencias disponibles.',
        'Revisa los datos de la reserva',
        'error',
      );
      return;
    }
    setBusy(true);
    setError('');
    feedback.dismiss();
    try {
      await assignEventResource(eventId, selected.id, amount);
      onChanged?.();
      setSelectedId('');
      setQuantity('1');
      setLoading(true);
      feedback.notify(
        'Recurso asignado. Las existencias se actualizarán con la reserva.',
      );
      setRevision((value) => value + 1);
    } catch (error) {
      feedback.notify(apiErrorMessage(error), 'error');
      setError(
        error instanceof Error
          ? error.message
          : 'No fue posible asignar el recurso.',
      );
      setRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  async function release(item: EventResourceAssignment) {
    if (!editable || !canView || !can('asignaciones.eliminar') || busy) return;
    if (
      !(await feedback.confirm(
        'Liberar recurso',
        `¿Liberar las ${item.quantity} unidades de ${item.inventoryItem.name}? Las unidades volverán a estar disponibles en el inventario y su costo se liberará del presupuesto del evento.`,
        'Liberar unidades',
        'warning',
        'CANCELAR',
      ))
    )
      return;
    setBusy(true);
    setError('');
    feedback.dismiss();
    try {
      await releaseEventResource(eventId, item.inventoryItemId);
      onChanged?.();
      setLoading(true);
      setRevision((value) => value + 1);
      feedback.notify(
        'Recurso liberado. Las unidades vuelven a estar disponibles en inventario.',
      );
    } catch (error) {
      feedback.notify(apiErrorMessage(error), 'error');
      setError(
        error instanceof Error
          ? error.message
          : 'No fue posible liberar el recurso.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!canView) return null;
  return (
    <Card
      aria-label={inDialog ? 'Reservas de inventario' : undefined}
      className={`min-w-0 ${inDialog ? 'h-full' : ''}`}
    >
      <FeedbackMessages feedback={feedback} />
      <div className="flex items-center gap-3">
        {inDialog && <AssignmentIcon name="inventario" />}
        <h3 className="text-xl font-bold">
          {inDialog ? 'Reservas de inventario' : 'Recursos del evento'}
        </h3>
      </div>
      <p className="mt-2 text-sm text-muted">
        {editable
          ? 'Cada asignación reserva unidades del inventario. Liberar devuelve todas las unidades de ese recurso.'
          : 'Unidades del inventario reservadas para este evento. Las reservas y devoluciones se gestionan en Asignaciones.'}
      </p>
      {cancelled && editable ? (
        <p className="mt-3 text-sm text-muted">
          Este evento está cancelado. Puedes consultar y liberar sus recursos,
          pero no asignar más unidades.
        </p>
      ) : null}
      {editable && !cancelled && !budgetReady && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Para reservar unidades, primero consulta e inicia el presupuesto del
          evento en Presupuestos.
        </p>
      )}
      {error ? (
        <div className="my-4">
          <p className="text-sm text-red-800">{error}</p>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            Actualizar asignaciones
          </Button>
        </div>
      ) : null}
      {loadError ? (
        <div className="my-4">
          {editable ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
              {loadError}
            </p>
          ) : (
            <ErrorMessage message={loadError} />
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            Reintentar asignaciones
          </Button>
        </div>
      ) : null}
      {inventoryError ? (
        <div className="my-4">
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {inventoryError}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Reintentar inventario
          </Button>
        </div>
      ) : null}
      {canAssign ? (
        <form
          noValidate
          onSubmit={assign}
          className={
            inDialog
              ? 'my-5 grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem] xl:grid-cols-[minmax(0,1fr)_5.5rem_auto]'
              : 'my-6 flex flex-wrap items-end gap-4'
          }
        >
          <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">
            Recurso de inventario
            <select
              className={inputClass}
              value={selectedId}
              required
              disabled={busy || loading || inventoryLoading}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Selecciona un recurso</option>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.type} · {item.availableQuantity}{' '}
                  disponibles
                </option>
              ))}
            </select>
          </label>
          <div className={inDialog ? 'min-w-0' : 'w-28'}>
            <Field
              label="Cantidad"
              type="number"
              min={1}
              max={selected?.availableQuantity}
              step={1}
              required
              disabled={busy || loading || inventoryLoading}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <Button
            className={
              inDialog
                ? 'min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 xl:col-span-1'
                : undefined
            }
            type="submit"
            disabled={busy || loading || inventoryLoading || !selected}
          >
            {busy ? 'Procesando…' : 'Asignar recurso'}
          </Button>
          {inventoryLoading && (
            <div
              className={inDialog ? 'sm:col-span-2 xl:col-span-3' : 'w-full'}
            >
              <LoadingState label="Cargando inventario disponible…" />
            </div>
          )}
          {!inventoryLoading && !inventoryError && inventory.length === 0 ? (
            <p
              className={
                inDialog
                  ? 'text-sm text-muted sm:col-span-2 xl:col-span-3'
                  : 'w-full text-sm text-muted'
              }
            >
              No hay unidades disponibles para asignar.
            </p>
          ) : null}
        </form>
      ) : editable &&
        !cancelled &&
        can('asignaciones.crear') &&
        !can('inventario.ver') ? (
        <p className="my-4 text-sm text-muted">
          Necesitas permiso para consultar inventario y seleccionar los recursos
          disponibles.
        </p>
      ) : null}
      {loading ? (
        <LoadingState label="Cargando asignaciones…" />
      ) : loadError ? null : assignments.length === 0 ? (
        inDialog ? (
          <EmptyState
            title="Todavía no hay reservas"
            description="Selecciona un recurso y una cantidad para reservar unidades para este evento."
          />
        ) : (
          <p className="my-5 text-muted">
            No hay recursos asignados a este evento.
          </p>
        )
      ) : (
        <>
          {editable && (
            <div
              className={
                inDialog
                  ? 'grid gap-3 border-t border-sky-blue pt-5'
                  : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
              }
            >
              {assignments.map((item) => (
                <article
                  className="min-w-0 rounded-xl border border-sky-blue p-4"
                  key={item.id}
                >
                  <h4 className="break-words font-semibold">
                    {item.inventoryItem.name}
                  </h4>
                  <p className="mt-2 text-sm text-muted">
                    {item.quantity} unidades reservadas · Costo unitario:{' '}
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                    }).format(item.inventoryItem.unitCost)}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Asignado:{' '}
                    {new Date(item.assignedAt).toLocaleString('es-CO')}
                  </p>
                  {editable && can('asignaciones.eliminar') && (
                    <Button
                      className="mt-3"
                      type="button"
                      variant="secondary"
                      disabled={busy || loading}
                      onClick={() => void release(item)}
                    >
                      Liberar recurso
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
          {!editable && (
            <div>
              <DataTable
                rows={assignments}
                rowKey={(item) => item.id}
                columns={[
                  {
                    key: 'name',
                    header: 'Recurso',
                    render: (item) => item.inventoryItem.name,
                  },
                  {
                    key: 'quantity',
                    header: 'Unidades asignadas',
                    render: (item) => item.quantity,
                  },
                  {
                    key: 'cost',
                    header: 'Costo unitario',
                    render: (item) =>
                      new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                      }).format(item.inventoryItem.unitCost),
                  },
                  {
                    key: 'date',
                    header: 'Fecha de asignación',
                    render: (item) =>
                      new Date(item.assignedAt).toLocaleString('es-CO'),
                  },
                  ...(editable && can('asignaciones.eliminar')
                    ? [
                        {
                          key: 'action',
                          header: 'Acción',
                          render: (item: EventResourceAssignment) => (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busy || loading}
                              onClick={() => void release(item)}
                            >
                              Liberar recurso
                            </Button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
