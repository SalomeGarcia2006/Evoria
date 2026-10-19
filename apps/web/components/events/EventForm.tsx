'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createEvent,
  type CreateEventPayload,
  type EventStatus,
} from '../../services/events.service';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';

const statusOptions: Array<{ value: EventStatus; label: string }> = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'planificado', label: 'Planificado' },
  { value: 'en_progreso', label: 'En ejecución' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
];

function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function EventForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '18:00',
    location: '',
    type: 'Congreso',
    status: 'planificado' as EventStatus,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string): void {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.startDate || !form.endDate) {
      setError('Selecciona las fechas de inicio y finalización.');
      return;
    }

    const startAt = combineDateAndTime(form.startDate, form.startTime);
    const endAt = combineDateAndTime(form.endDate, form.endTime);

    if (new Date(endAt) < new Date(startAt)) {
      setError(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
      return;
    }

    const payload: CreateEventPayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startAt,
      endAt,
      location: form.location.trim() || undefined,
      type: form.type.trim() || undefined,
      status: form.status,
    };

    setIsSubmitting(true);

    try {
      await createEvent(payload);
      router.push('/eventos');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo crear el evento.',
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
            type="text"
            value={form.name}
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
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Fecha de inicio</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => updateField('startDate', event.target.value)}
            required
            type="date"
            value={form.startDate}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Fecha de finalización</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => updateField('endDate', event.target.value)}
            required
            type="date"
            value={form.endDate}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Hora de inicio</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => updateField('startTime', event.target.value)}
            required
            type="time"
            value={form.startTime}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Hora de finalización</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => updateField('endTime', event.target.value)}
            required
            type="time"
            value={form.endTime}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Ubicación</span>
          <input
            className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            maxLength={255}
            onChange={(event) => updateField('location', event.target.value)}
            type="text"
            value={form.location}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Tipo</span>
          <select
            className="rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) => updateField('type', event.target.value)}
            value={form.type}
          >
            <option>Congreso</option>
            <option>Boda</option>
            <option>Seminario</option>
            <option>Evento corporativo</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Estado</span>
          <select
            className="rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
            onChange={(event) =>
              updateField('status', event.target.value as EventStatus)
            }
            value={form.status}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-sky-blue pt-5">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Guardando…' : 'Guardar evento'}
        </Button>
        <Button
          onClick={() => router.push('/eventos')}
          type="button"
          variant="secondary"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
