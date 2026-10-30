'use client';
import { useState, type FormEvent } from 'react';
import { saveResource } from '../../services/recursos.service';
import {
  resourceStatusLabels,
  type Recurso,
  type ResourceStatus,
} from '../../types/recurso';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';

export function ResourceForm({
  resource,
  onSaved,
  onCancel,
  onSavingChange,
}: {
  resource?: Recurso;
  onSaved: (resource: Recurso) => void;
  onCancel?: () => void;
  onSavingChange?: (isSaving: boolean) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const type = String(data.get('type') ?? '').trim();
    const unitCost = Number(data.get('unitCost'));
    const totalQuantity = Number(data.get('totalQuantity'));
    if (
      name.length < 2 ||
      type.length < 2 ||
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      !Number.isInteger(totalQuantity) ||
      totalQuantity < 0
    ) {
      setError('Revisa el nombre, el tipo, el costo y la cantidad total.');
      return;
    }
    setIsSaving(true);
    onSavingChange?.(true);
    setError('');
    try {
      onSaved(
        await saveResource(
          {
            name,
            type,
            unitCost,
            totalQuantity,
            description: String(data.get('description') ?? ''),
            status: String(data.get('status')) as ResourceStatus,
          },
          resource?.id,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No fue posible guardar el recurso.',
      );
    } finally {
      setIsSaving(false);
      onSavingChange?.(false);
    }
  }
  const inputClass =
    'min-w-0 rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal';
  return (
    <form onSubmit={submit} className="grid min-w-0 gap-5">
      {error ? <ErrorMessage message={error} /> : null}
      <fieldset
        disabled={isSaving}
        className="grid min-w-0 gap-5 sm:grid-cols-2"
      >
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          Nombre del recurso
          <input
            name="name"
            className={inputClass}
            defaultValue={resource?.name}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Tipo
          <input
            name="type"
            className={inputClass}
            defaultValue={resource?.type}
            placeholder="Ej. Tecnología"
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Estado
          <select
            name="status"
            className={inputClass}
            defaultValue={resource?.status ?? 'disponible'}
          >
            {Object.entries(resourceStatusLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
                disabled={
                  !!resource?.reservedQuantity && value !== 'disponible'
                }
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Cantidad total
          <input
            name="totalQuantity"
            className={inputClass}
            type="number"
            min={resource?.reservedQuantity ?? 0}
            step={1}
            required
            defaultValue={resource?.totalQuantity}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Costo unitario (COP)
          <input
            name="unitCost"
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={resource?.unitCost}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          Descripción
          <textarea
            name="description"
            className={inputClass}
            maxLength={1000}
            rows={3}
            defaultValue={resource?.description}
          />
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar recurso'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
