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

export function EventResources({
  eventId,
  cancelled = false,
  editable = false,
}: {
  eventId: string;
  cancelled?: boolean;
  editable?: boolean;
}) {
  const { can } = useAuth();
  const canView = can('asignaciones.ver');
  const canAssign =
    editable &&
    canView &&
    can('asignaciones.crear') &&
    can('inventario.ver') &&
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
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const selected = inventory.find((item) => item.id === selectedId);

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
  }, [canView, eventId, revision]);

  useEffect(() => {
    if (!canAssign) return;
    let active = true;
    getAvailableInventory()
      .then((items) => {
        if (active) {
          setInventory(items);
          setInventoryError('');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setInventory([]);
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
  }, [canAssign, eventId, revision]);

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
      setError(
        'Selecciona un recurso y una cantidad entera dentro de las existencias disponibles.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await assignEventResource(eventId, selected.id, amount);
      setSelectedId('');
      setQuantity('1');
      setLoading(true);
      setNotice(
        'Recurso asignado. Las existencias se actualizarán con la reserva.',
      );
      setRevision((value) => value + 1);
    } catch (error) {
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
    if (
      !editable ||
      !canView ||
      !can('asignaciones.eliminar') ||
      busy ||
      !window.confirm(
        `¿Liberar las ${item.quantity} unidades de ${item.inventoryItem.name}?`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await releaseEventResource(eventId, item.inventoryItemId);
      setLoading(true);
      setRevision((value) => value + 1);
      setNotice(
        'Recurso liberado. Las unidades vuelven a estar disponibles en inventario.',
      );
    } catch (error) {
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
    <Card className="min-w-0">
      <h3 className="text-xl font-bold">Recursos del evento</h3>
      <p className="mt-2 text-sm text-teal">
        {editable
          ? 'Cada asignación reserva unidades del inventario. Liberar devuelve todas las unidades de ese recurso.'
          : 'Unidades del inventario reservadas para este evento. Las reservas y devoluciones se gestionan en Asignaciones.'}
      </p>
      {cancelled && editable ? (
        <p className="mt-3 text-sm text-teal">
          Este evento está cancelado. Puedes consultar y liberar sus recursos,
          pero no asignar más unidades.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 rounded-lg bg-beige p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <div className="my-4">
          <ErrorMessage message={error} />
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
          <ErrorMessage message={loadError} />
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
          <ErrorMessage message={inventoryError} />
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
        <form onSubmit={assign} className="my-6 flex flex-wrap items-end gap-4">
          <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">
            Recurso de inventario
            <select
              className="rounded-lg border border-sky-blue bg-white p-2"
              value={selectedId}
              required
              disabled={busy || loading}
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
          <label className="grid gap-2 text-sm font-semibold">
            Cantidad
            <input
              className="w-28 rounded-lg border border-sky-blue p-2"
              type="number"
              min={1}
              max={selected?.availableQuantity}
              step={1}
              required
              disabled={busy || loading}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy || loading || !selected}>
            {busy ? 'Procesando…' : 'Asignar recurso'}
          </Button>
          {!inventoryError && inventory.length === 0 ? (
            <p className="w-full text-sm text-teal">
              No hay unidades disponibles para asignar.
            </p>
          ) : null}
        </form>
      ) : editable &&
        !cancelled &&
        can('asignaciones.crear') &&
        !can('inventario.ver') ? (
        <p className="my-4 text-sm text-teal">
          Necesitas permiso para consultar inventario y seleccionar los recursos
          disponibles.
        </p>
      ) : null}
      {loading ? (
        <LoadingState label="Cargando asignaciones…" />
      ) : loadError ? null : assignments.length === 0 ? (
        <p className="my-5 text-teal">
          No hay recursos asignados a este evento.
        </p>
      ) : (
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
      )}
    </Card>
  );
}
