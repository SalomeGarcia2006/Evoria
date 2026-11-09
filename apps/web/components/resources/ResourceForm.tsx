'use client';
import { useState, type FormEvent } from 'react';
import { saveResource } from '../../services/recursos.service';
import {
  resourceStatusLabels,
  type Recurso,
  type ResourceStatus,
} from '../../types/recurso';
import { Button } from '../ui/Button';
import { FeedbackMessages, useFeedback } from '../ui/Feedback';
import { apiErrorMessage } from '../../services/api';

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
  const feedback = useFeedback();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const type = String(data.get('type') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const status = String(data.get('status') ?? '').trim();
    const unitCostValue = String(data.get('unitCost') ?? '').trim();
    const totalQuantityValue = String(data.get('totalQuantity') ?? '').trim();
    const unitCost = Number(unitCostValue);
    const totalQuantity = Number(totalQuantityValue);

    const missingFields = [
      !name && 'Nombre del recurso',
      !type && 'Tipo',
      !status && 'Estado',
      !totalQuantityValue && 'Cantidad total',
      !unitCostValue && 'Costo unitario',
      !description && 'Descripción',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      feedback.guide(
        `Falta completar: ${missingFields.join(', ')}.`,
        'Campos obligatorios',
        'error',
      );
      return;
    }

    if (
      name.length < 2 ||
      type.length < 2 ||
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      !Number.isInteger(totalQuantity) ||
      totalQuantity < (resource?.reservedQuantity ?? 0)
    ) {
      feedback.guide(
        `El nombre y el tipo deben tener al menos dos caracteres. Indica un costo no negativo y una cantidad total entera de al menos ${resource?.reservedQuantity ?? 0} unidades para cubrir las reservas existentes.`,
        'Revisa los datos del recurso',
        'error',
      );
      return;
    }
    setIsSaving(true);
    onSavingChange?.(true);
    feedback.dismiss();
    try {
      onSaved(
        await saveResource(
          {
            name,
            type,
            unitCost,
            totalQuantity,
            description,
            status: status as ResourceStatus,
          },
          resource?.id,
        ),
      );
    } catch (error) {
      feedback.notify(apiErrorMessage(error), 'error');
    } finally {
      setIsSaving(false);
      onSavingChange?.(false);
    }
  }
  const inputClass =
    'min-w-0 rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal';
  return (
    <form noValidate onSubmit={submit} className="grid min-w-0 gap-5">
      <FeedbackMessages feedback={feedback} />
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
            required
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
            required
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
