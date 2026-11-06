'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  createEvent,
  getAllEvents,
  updateEvent,
  type CreateEventPayload,
  type EventItem,
} from '../../services/events.service';
import { getUsers, type CompanyUser } from '../../services/users.service';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { OpenStreetMapLocationPicker } from './OpenStreetMapLocationPicker';

const eventTypes = [
  'Congreso',
  'Seminario',
  'Taller',
  'Conferencia',
  'Feria',
  'Concierto',
  'Boda',
  'Graduación',
  'Evento corporativo',
  'Lanzamiento de producto',
  'Evento deportivo',
  'Evento benéfico',
];

function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateForInput(tomorrow);
}

function formatTimeForInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formFromEvent(event?: EventItem) {
  const startAt = event ? new Date(event.startAt) : null;
  const endAt = event ? new Date(event.endAt) : null;

  return {
    name: event?.name ?? '',
    description: event?.description ?? '',
    startDate: startAt ? formatDateForInput(startAt) : '',
    endDate: endAt ? formatDateForInput(endAt) : '',
    startTime: startAt ? formatTimeForInput(startAt) : '09:00',
    endTime: endAt ? formatTimeForInput(endAt) : '18:00',
    location: event?.location ?? '',
    type: event?.type ?? '',
    baseBudget: event ? String(event.baseBudget) : '',
    responsibleUserId: event?.responsibleUserId ?? '',
  };
}

function normalizeEventText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function EventForm({
  initialEvent,
  onCancel,
  onSuccess,
}: {
  initialEvent?: EventItem;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialEvent);
  const minimumStartDate = getTomorrowDate();
  const [form, setForm] = useState(() => formFromEvent(initialEvent));
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [usersError, setUsersError] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(
    (field: keyof typeof form, value: string): void => {
      setForm((currentForm) => ({ ...currentForm, [field]: value }));
    },
    [],
  );
  const updateLocation = useCallback(
    (value: string) => updateField('location', value),
    [updateField],
  );

  useEffect(() => {
    void getUsers()
      .then((items) =>
        setUsers(items.filter((user) => user.status === 'activo')),
      )
      .catch(() => setUsersError(true));
  }, []);

  useEffect(() => {
    void getAllEvents()
      .then(setEvents)
      .catch(() => setEventsError(true))
      .finally(() => setIsLoadingEvents(false));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationAlert(null);

    const missingFields = [
      !form.name.trim() && 'Nombre',
      !form.description.trim() && 'Descripción',
      !form.startDate && 'Fecha de inicio',
      !form.endDate && 'Fecha de finalización',
      !form.startTime && 'Hora de inicio',
      !form.endTime && 'Hora de finalización',
      !form.location.trim() && 'Ubicación',
      !form.type && 'Tipo de evento',
      form.baseBudget === '' && 'Presupuesto base',
      !form.responsibleUserId && 'Persona responsable',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setValidationAlert(
        `Completa los siguientes campos obligatorios: ${missingFields.join(', ')}.`,
      );
      return;
    }

    const baseBudget = Number(form.baseBudget);
    if (!Number.isSafeInteger(baseBudget) || baseBudget < 0) {
      setValidationAlert(
        'El presupuesto base debe ser un monto entero en COP.',
      );
      return;
    }

    if (!isEditing && form.startDate < minimumStartDate) {
      setValidationAlert(
        'La fecha de inicio debe ser posterior a la fecha de hoy.',
      );
      return;
    }

    if (form.endDate < form.startDate) {
      setValidationAlert(
        'La fecha de finalización no puede ser anterior a la fecha de inicio.',
      );
      return;
    }

    if (form.endDate === form.startDate && form.endTime <= form.startTime) {
      setValidationAlert(
        'La hora de finalización debe ser posterior a la hora de inicio.',
      );
      return;
    }

    const startAt = combineDateAndTime(form.startDate, form.startTime);
    const endAt = combineDateAndTime(form.endDate, form.endTime);

    if (isLoadingEvents) {
      setValidationAlert('Espera mientras validamos la disponibilidad.');
      return;
    }

    if (eventsError) {
      setValidationAlert(
        'No fue posible validar la disponibilidad de la persona responsable.',
      );
      return;
    }

    if (
      events.some(
        (existingEvent) =>
          existingEvent.id !== initialEvent?.id &&
          normalizeEventText(existingEvent.name) ===
            normalizeEventText(form.name),
      )
    ) {
      setValidationAlert('Ya existe un evento con ese nombre.');
      return;
    }

    if (
      events.some(
        (existingEvent) =>
          existingEvent.id !== initialEvent?.id &&
          normalizeEventText(existingEvent.description) ===
            normalizeEventText(form.description),
      )
    ) {
      setValidationAlert('Ya existe un evento con esa descripción.');
      return;
    }

    const conflictingEvent = events.find(
      (existingEvent) =>
        existingEvent.responsibleUserId === form.responsibleUserId &&
        existingEvent.id !== initialEvent?.id &&
        existingEvent.status !== 'cancelado' &&
        new Date(existingEvent.startAt) < new Date(endAt) &&
        new Date(existingEvent.endAt) > new Date(startAt),
    );

    if (conflictingEvent) {
      setValidationAlert(
        `La persona responsable ya está asignada al evento “${conflictingEvent.name}” en ese horario.`,
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
      baseBudget,
      responsibleUserId: form.responsibleUserId,
    };

    setIsSubmitting(true);

    try {
      if (initialEvent) await updateEvent(initialEvent.id, payload);
      else await createEvent(payload);
      setSuccessAlert(true);
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

  function closeSuccessAlert() {
    setSuccessAlert(false);
    if (onSuccess) {
      onSuccess();
      return;
    }
    router.push('/eventos');
  }

  return (
    <>
      <form
        className="grid gap-5 rounded-xl border border-sky-blue bg-white p-6 shadow-sm"
        noValidate
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
              onChange={(event) =>
                updateField('description', event.target.value)
              }
              required
              rows={4}
              value={form.description}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Fecha de inicio</span>
            <input
              className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
              min={isEditing ? undefined : minimumStartDate}
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
              min={form.startDate || minimumStartDate}
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
          <OpenStreetMapLocationPicker
            onChange={updateLocation}
            value={form.location}
          />
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Tipo</span>
            <select
              className="rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
              onChange={(event) => updateField('type', event.target.value)}
              required
              value={form.type}
            >
              <option disabled value="">
                Selecciona un tipo
              </option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">
              Presupuesto base (COP)
            </span>
            <input
              className="rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
              min="0"
              onChange={(event) =>
                updateField('baseBudget', event.target.value)
              }
              required
              step="1"
              type="number"
              value={form.baseBudget}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Persona responsable</span>
            <select
              className="rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
              disabled={usersError}
              onChange={(event) =>
                updateField('responsibleUserId', event.target.value)
              }
              required
              value={form.responsibleUserId}
            >
              <option disabled value="">
                Selecciona una persona
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.profile.name}
                </option>
              ))}
            </select>
            {usersError ? (
              <span className="text-sm text-red-700">
                No fue posible cargar las personas disponibles.
              </span>
            ) : null}
          </label>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-sky-blue pt-5">
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Guardando…' : 'Guardar evento'}
          </Button>
          <Button
            onClick={() => (onCancel ? onCancel() : router.push('/eventos'))}
            type="button"
            variant="secondary"
          >
            Cancelar
          </Button>
        </div>
      </form>
      {validationAlert ? (
        <div
          aria-label="Alerta de validación del evento"
          aria-live="assertive"
          className="login-alert-backdrop fixed inset-0 z-[1100] grid place-items-center p-6"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="login-alert-modal">
            <button
              aria-label="Cerrar alerta"
              className="login-alert-close"
              onClick={() => setValidationAlert(null)}
              type="button"
            >
              ×
            </button>
            <div className="login-alert-icon" aria-hidden="true">
              ⚠️
            </div>
            <p className="login-alert-kicker">Revisa los datos del evento</p>
            <p className="login-alert-message">{validationAlert}</p>
            <button
              className="login-alert-button"
              onClick={() => setValidationAlert(null)}
              type="button"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
      {successAlert ? (
        <div
          aria-label="Evento creado correctamente"
          aria-live="polite"
          className="login-alert-backdrop fixed inset-0 z-[1100] grid place-items-center p-6"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="event-success-modal">
            <div className="event-success-icon" aria-hidden="true">
              ✓
            </div>
            <p className="event-success-title">
              {isEditing
                ? '¡Listo, evento actualizado exitosamente!'
                : '¡Listo, evento creado exitosamente!'}
            </p>
            <p className="event-success-message">
              {isEditing
                ? 'Los cambios del evento se guardaron correctamente.'
                : 'El evento se creó correctamente.'}
            </p>
            <button
              className="event-success-button"
              onClick={closeSuccessAlert}
              type="button"
            >
              Ver eventos
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
