'use client';

import type { ResourceStatus } from '@evoria/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createResource,
  updateResource,
  type ResourceItem,
} from '../../services/recursos.service';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';

const editableStatuses: Array<{ value: ResourceStatus; label: string }> = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'mantenimiento', label: 'En mantenimiento' },
];

type ResourceFormProps = {
  resource?: ResourceItem;
  onSaved?: (resource: ResourceItem) => void;
};

export function ResourceForm({ resource, onSaved }: ResourceFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: resource?.name ?? '',
    type: resource?.type ?? '',
    description: resource?.description ?? '',
    unitCost: String(resource?.unitCost ?? ''),
    totalQuantity: String(resource?.totalQuantity ?? ''),
    status:
      resource?.status === 'mantenimiento' ? 'mantenimiento' : 'disponible',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string): void {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const unitCost = Number(form.unitCost);
    const totalQuantity = Number(form.totalQuantity);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError('Ingresa un costo unitario válido.');
      return;
    }
    if (!Number.isInteger(totalQuantity) || totalQuantity < 0) {
      setError(
        'La cantidad total debe ser un número entero igual o mayor a cero.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type.trim(),
        description: form.description.trim() || undefined,
        unitCost,
        totalQuantity,
        status: form.status as ResourceStatus,
      };
      const saved = resource
        ? await updateResource(resource.id, payload)
        : await createResource(payload);

      if (onSaved) {
        onSaved(saved);
      } else {
        router.push(resource ? `/recursos/${resource.id}` : '/recursos');
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo guardar el recurso.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-5 rounded-xl border border-sky-blue bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      {error ? <ErrorMessage message={error} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Nombre</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            maxLength={120}
            minLength={2}
            onChange={(event) => updateField('name', event.target.value)}
            required
            value={form.name}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Categoría</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            maxLength={80}
            minLength={2}
            onChange={(event) => updateField('type', event.target.value)}
            placeholder="Ej. Mobiliario"
            required
            value={form.type}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Estado</span>
          <select
            className="rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => updateField('status', event.target.value)}
            value={form.status}
          >
            {editableStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Cantidad total</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            min="0"
            onChange={(event) =>
              updateField('totalQuantity', event.target.value)
            }
            required
            step="1"
            type="number"
            value={form.totalQuantity}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Costo unitario</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            min="0"
            onChange={(event) => updateField('unitCost', event.target.value)}
            required
            step="0.01"
            type="number"
            value={form.unitCost}
          />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Descripción</span>
          <textarea
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            maxLength={1000}
            onChange={(event) => updateField('description', event.target.value)}
            rows={4}
            value={form.description}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-sky-blue pt-5">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? 'Guardando…'
            : resource
              ? 'Guardar cambios'
              : 'Crear recurso'}
        </Button>
        <Button onClick={() => router.back()} type="button" variant="secondary">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
