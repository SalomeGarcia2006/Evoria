'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  createEvent,
  getAllEvents,
  getEventTypes,
  updateEvent,
  type CreateEventPayload,
  type EventItem,
} from '../../services/events.service';
import { getProfiles } from '../../services/profiles-api.service';
import { getUsers, type CompanyUser } from '../../services/users.service';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';
import { ErrorMessage } from '../ui/ErrorMessage';
import { OpenStreetMapLocationPicker } from './OpenStreetMapLocationPicker';
import { useAuth } from '../../hooks/useAuth';

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
    invitados: event ? String(event.invitados ?? 0) : '',
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
  const { can, user } = useAuth();
  const tenantId = user?.tenant?.id;
  const canViewProfiles = can('perfiles.ver');
  const isEditing = Boolean(initialEvent);
  const minimumStartDate = getTomorrowDate();
  const [form, setForm] = useState(() => formFromEvent(initialEvent));
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [usersError, setUsersError] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [typesAttempt, setTypesAttempt] = useState(0);
  const [typesResult, setTypesResult] = useState<{
    tenantId: string;
    attempt: number;
    types: string[];
    error: boolean;
  } | null>(null);
  const currentTypes =
    typesResult &&
    typesResult.tenantId === tenantId &&
    typesResult.attempt === typesAttempt
      ? typesResult
      : null;
  const eventTypes = currentTypes?.types ?? [];
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const isCreationWizard = !isEditing;

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
    if (!tenantId) return;
    let active = true;
    void getEventTypes()
      .then((types) => {
        if (active)
          setTypesResult({
            tenantId,
            attempt: typesAttempt,
            types,
            error: false,
          });
      })
      .catch(() => {
        if (active)
          setTypesResult({
            tenantId,
            attempt: typesAttempt,
            types: [],
            error: true,
          });
      });
    return () => {
      active = false;
    };
  }, [tenantId, typesAttempt]);

  useEffect(() => {
    if (!canViewProfiles) return;

    let active = true;
    void Promise.all([getUsers(), getProfiles()])
      .then(([items, profiles]) => {
        if (!active) return;
        const profilesWithEventsAccess = new Set(
          profiles
            .filter(
              (profile) =>
                profile.status === 'activo' &&
                profile.permissions.some(
                  (permission) => permission.key === 'eventos.ver',
                ),
            )
            .map((profile) => profile.id),
        );
        setUsers(
          items.filter(
            (companyUser) =>
              companyUser.status === 'activo' &&
              companyUser.profile !== null &&
              profilesWithEventsAccess.has(companyUser.profile.id),
          ),
        );
      })
      .catch(() => {
        if (active) setUsersError(true);
      })
      .finally(() => {
        if (active) setIsLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, [canViewProfiles]);

  useEffect(() => {
    void getAllEvents()
      .then(setEvents)
      .catch(() => setEventsError(true))
      .finally(() => setIsLoadingEvents(false));
  }, []);

  function validateGeneralInformation(): boolean {
    setError(null);
    setValidationAlert(null);

    if (!currentTypes || currentTypes.error) {
      setValidationAlert(
        currentTypes?.error
          ? 'No fue posible cargar los tipos de evento. Inténtalo de nuevo.'
          : 'Espera mientras se cargan los tipos de evento.',
      );
      return false;
    }

    const missingFields = [
      !form.name.trim() && 'Nombre',
      !form.description.trim() && 'Descripción',
      !form.type && 'Tipo de evento',
      form.baseBudget === '' && 'Presupuesto base',
      form.invitados === '' && 'Número de invitados',
      !form.responsibleUserId && 'Persona responsable',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setValidationAlert(
        `Completa los siguientes campos obligatorios: ${missingFields.join(', ')}.`,
      );
      return false;
    }

    if (isLoadingUsers) {
      setValidationAlert('Espera mientras cargamos las personas responsables.');
      return false;
    }

    if (!canViewProfiles || usersError) {
      setValidationAlert(
        'No fue posible validar los permisos de la persona responsable.',
      );
      return false;
    }

    if (!users.some((person) => person.id === form.responsibleUserId)) {
      setValidationAlert(
        'La persona responsable debe tener permiso para ver los eventos.',
      );
      return false;
    }

    const baseBudget = Number(form.baseBudget);
    if (!Number.isSafeInteger(baseBudget) || baseBudget < 0) {
      setValidationAlert(
        'El presupuesto base debe ser un monto entero en COP.',
      );
      return false;
    }

    const invitados = Number(form.invitados);
    if (!Number.isSafeInteger(invitados) || invitados < 0) {
      setValidationAlert(
        'El número de invitados debe ser un número entero igual o mayor a cero.',
      );
      return false;
    }

    if (isLoadingEvents) {
      setValidationAlert('Espera mientras validamos los datos del evento.');
      return false;
    }

    if (eventsError) {
      setValidationAlert('No fue posible validar los datos del evento.');
      return false;
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
      return false;
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
      return false;
    }

    return true;
  }

  function validateSchedule(): boolean {
    const missingFields = [
      !form.startDate && 'Fecha de inicio',
      !form.endDate && 'Fecha de finalización',
      !form.startTime && 'Hora de inicio',
      !form.endTime && 'Hora de finalización',
      !form.location.trim() && 'Ubicación',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setValidationAlert(
        `Completa los siguientes campos obligatorios: ${missingFields.join(', ')}.`,
      );
      return false;
    }

    if (!isEditing && form.startDate < minimumStartDate) {
      setValidationAlert(
        'La fecha de inicio debe ser posterior a la fecha de hoy.',
      );
      return false;
    }

    if (form.endDate < form.startDate) {
      setValidationAlert(
        'La fecha de finalización no puede ser anterior a la fecha de inicio.',
      );
      return false;
    }

    if (form.endDate === form.startDate && form.endTime <= form.startTime) {
      setValidationAlert(
        'La hora de finalización debe ser posterior a la hora de inicio.',
      );
      return false;
    }

    return true;
  }

  function continueToSchedule() {
    setValidationAlert(null);
    setStep(2);
  }

  async function submitEvent() {
    if (!validateGeneralInformation() || !validateSchedule()) return;

    const startAt = combineDateAndTime(form.startDate, form.startTime);
    const endAt = combineDateAndTime(form.endDate, form.endTime);

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
      baseBudget: Number(form.baseBudget),
      invitados: Number(form.invitados),
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitEvent();
  }

  function closeSuccessAlert() {
    setSuccessAlert(false);
    if (onSuccess) {
      onSuccess();
      return;
    }
    router.push('/eventos');
  }

  const inputClassName =
    'rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

  const generalFields = (
    <>
      <label className="grid gap-2 md:col-span-2">
        <span className="text-sm font-semibold">Nombre del evento</span>
        <input
          className={inputClassName}
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
          className={inputClassName}
          maxLength={1000}
          onChange={(event) => updateField('description', event.target.value)}
          required
          rows={isCreationWizard ? 5 : 4}
          value={form.description}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Tipo de evento</span>
        <select
          className={inputClassName}
          disabled={!currentTypes || currentTypes.error}
          onChange={(event) => updateField('type', event.target.value)}
          required
          value={form.type}
        >
          <option disabled value="">
            {!currentTypes
              ? 'Cargando tipos...'
              : currentTypes.error
                ? 'No se pudieron cargar los tipos'
                : 'Selecciona un tipo'}
          </option>
          {initialEvent?.type && !eventTypes.includes(initialEvent.type) && (
            <option value={initialEvent.type}>
              {initialEvent.type} (tipo anterior)
            </option>
          )}
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {currentTypes?.error ? (
          <button
            className="text-left text-sm font-semibold text-violet underline"
            onClick={() => setTypesAttempt((attempt) => attempt + 1)}
            type="button"
          >
            Reintentar cargar tipos
          </button>
        ) : null}
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Presupuesto base (COP)</span>
        <input
          className={inputClassName}
          min="0"
          onChange={(event) => updateField('baseBudget', event.target.value)}
          required
          step="1"
          type="number"
          value={form.baseBudget}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Número de invitados</span>
        <input
          className={inputClassName}
          min="0"
          onChange={(event) => updateField('invitados', event.target.value)}
          required
          step="1"
          type="number"
          value={form.invitados}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Persona responsable</span>
        <select
          className={inputClassName}
          disabled={
            !canViewProfiles ||
            usersError ||
            isLoadingUsers ||
            users.length === 0
          }
          onChange={(event) =>
            updateField('responsibleUserId', event.target.value)
          }
          required
          value={form.responsibleUserId}
        >
          <option disabled value="">
            {!canViewProfiles
              ? 'No se pueden validar permisos'
              : isLoadingUsers
                ? 'Cargando personas...'
                : 'Selecciona una persona'}
          </option>
          {users.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} · {person.profile?.name ?? 'Sin perfil'}
            </option>
          ))}
        </select>
        {!canViewProfiles ? (
          <span className="text-sm text-red-700">
            Necesitas permiso para consultar perfiles y validar responsables.
          </span>
        ) : usersError ? (
          <span className="text-sm text-red-700">
            No fue posible validar los permisos de las personas.
          </span>
        ) : users.length === 0 && !isLoadingUsers ? (
          <span className="text-sm text-muted">
            No hay personas activas con permiso para ver eventos.
          </span>
        ) : null}
      </label>
    </>
  );

  const scheduleFields = (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid min-w-0 gap-4">
        <DateRangePicker
          endDate={form.endDate}
          label="Fechas del evento"
          min={isEditing ? undefined : minimumStartDate}
          onChange={(startDate, endDate) =>
            setForm((current) => ({ ...current, startDate, endDate }))
          }
          required
          startDate={form.startDate}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Hora de inicio</span>
            <input
              className={inputClassName}
              onChange={(event) => updateField('startTime', event.target.value)}
              required
              type="time"
              value={form.startTime}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Hora de finalización</span>
            <input
              className={inputClassName}
              onChange={(event) => updateField('endTime', event.target.value)}
              required
              type="time"
              value={form.endTime}
            />
          </label>
        </div>
      </div>
      <div className="min-w-0 border-t border-sky-blue pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
        <OpenStreetMapLocationPicker
          onChange={updateLocation}
          value={form.location}
        />
      </div>
    </div>
  );

  return (
    <>
      <form
        className="grid min-h-0 gap-6"
        noValidate
        onSubmit={
          isCreationWizard ? (event) => event.preventDefault() : handleSubmit
        }
      >
        {error ? <ErrorMessage message={error} /> : null}
        {isCreationWizard ? (
          <>
            <div
              aria-label={`Paso ${step} de 2`}
              className="grid grid-cols-2 gap-4 border-b border-sky-blue pb-5"
              role="list"
            >
              {[
                ['1', 'Información general'],
                ['2', 'Programación y ubicación'],
              ].map(([number, label], index) => {
                const currentStep = index + 1;
                const completed = step > currentStep;
                const active = step === currentStep;
                return (
                  <div
                    aria-current={active ? 'step' : undefined}
                    className="flex min-w-0 items-center gap-3"
                    key={number}
                    role="listitem"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${active ? 'bg-navy text-white' : completed ? 'bg-teal text-white' : 'border border-sky-blue bg-white text-muted'}`}
                    >
                      {completed ? '✓' : number}
                    </span>
                    <span
                      className={`min-w-0 text-sm font-semibold ${active ? 'text-navy' : completed ? 'text-teal' : 'text-muted'}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {step === 1 ? (
              <section
                aria-labelledby="event-general-title"
                className="grid gap-5"
              >
                <div>
                  <p className="text-sm font-semibold text-violet">Paso 1</p>
                  <h3
                    className="mt-1 text-xl font-bold"
                    id="event-general-title"
                  >
                    Información general
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Define los datos principales y a la persona responsable.
                  </p>
                </div>
                <div className="grid items-start gap-5 md:grid-cols-2">
                  {generalFields}
                </div>
              </section>
            ) : (
              <section
                aria-labelledby="event-schedule-title"
                className="grid gap-5"
              >
                <div>
                  <p className="text-sm font-semibold text-violet">Paso 2</p>
                  <h3
                    className="mt-1 text-xl font-bold"
                    id="event-schedule-title"
                  >
                    Programación y ubicación
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Selecciona el periodo, horario y punto exacto del evento.
                  </p>
                </div>
                {scheduleFields}
              </section>
            )}

            <div className="event-wizard-actions sticky bottom-0 z-10 flex flex-wrap justify-between gap-3 border-t border-sky-blue py-4 backdrop-blur-sm">
              {step === 1 ? (
                <Button
                  onClick={() =>
                    onCancel ? onCancel() : router.push('/eventos')
                  }
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              ) : (
                <Button
                  onClick={() => setStep(1)}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
              )}
              {step === 1 ? (
                <Button onClick={continueToSchedule} type="button">
                  Continuar
                </Button>
              ) : (
                <Button
                  disabled={isSubmitting}
                  onClick={() => void submitEvent()}
                  type="button"
                >
                  {isSubmitting ? 'Creando…' : 'Crear evento'}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid items-start gap-5 md:grid-cols-2">
              {generalFields}
              <div className="md:col-span-2">{scheduleFields}</div>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-sky-blue pt-5">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Guardando…' : 'Guardar evento'}
              </Button>
              <Button
                onClick={() =>
                  onCancel ? onCancel() : router.push('/eventos')
                }
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
            </div>
          </>
        )}
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
