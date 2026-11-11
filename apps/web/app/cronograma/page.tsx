'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { getAllEvents, type EventItem } from '../../services/events.service';
import {
  cancelSchedule,
  createSchedule,
  getSchedules,
  updateSchedule,
  type ScheduleItem,
  type SchedulePayload,
  type ScheduleStatus,
} from '../../services/schedules.service';
import { getUsers, type CompanyUser } from '../../services/users.service';

const fieldClassName =
  'rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

const statusLabels: Record<ScheduleStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const statusClasses: Record<ScheduleStatus, string> = {
  pendiente: 'bg-amber/15 text-amber-900',
  en_progreso: 'bg-teal/15 text-teal',
  completado: 'bg-violet/10 text-violet',
  cancelado: 'bg-coral/10 text-coral',
};

type ScheduleForm = {
  eventId: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  responsibleUserId: string;
};

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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

function getAutomaticStatus(
  startAt: string,
  endAt: string,
): Exclude<ScheduleStatus, 'cancelado'> {
  const now = new Date();

  if (new Date(endAt) < now) return 'completado';
  if (new Date(startAt) <= now) return 'en_progreso';
  return 'pendiente';
}

function AlertOverlay({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) return null;

  return (
    <div
      aria-label="Alerta del cronograma"
      aria-live="assertive"
      className="login-alert-backdrop fixed inset-0 z-50 grid place-items-center p-6"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="login-alert-modal">
        <button
          aria-label="Cerrar alerta"
          className="login-alert-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <div className="login-alert-icon" aria-hidden="true">
          ⚠️
        </div>
        <p className="login-alert-kicker">Revisa los datos de la actividad</p>
        <p className="login-alert-message">{message}</p>
        <button className="login-alert-button" onClick={onClose} type="button">
          Entendido
        </button>
      </div>
    </div>
  );
}

function emptyForm(eventId = ''): ScheduleForm {
  return {
    eventId,
    name: '',
    description: '',
    startAt: '',
    endAt: '',
    responsibleUserId: '',
  };
}

export default function CronogramaPage() {
  const { can } = useAuth();
  const feedback = useFeedback();
  const dialog = useRef<HTMLDialogElement>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm());
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const minimumStartDate = getTomorrowDate();

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getAllEvents(),
      can('usuarios.ver') ? getUsers().catch(() => []) : Promise.resolve([]),
    ])
      .then(([eventItems, userResult]) => {
        if (!isMounted) return;
        const activeEvents = eventItems.filter(
          (event) => event.status !== 'cancelado',
        );
        setEvents(activeEvents);
        setUsers(userResult);
        if (activeEvents[0]) setIsLoadingSchedules(true);
        setSelectedEventId((current) => current || activeEvents[0]?.id || '');
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar los eventos.',
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingEvents(false);
      });

    return () => {
      isMounted = false;
    };
  }, [can]);

  useEffect(() => {
    if (!selectedEventId) return;
    let isMounted = true;

    getSchedules(selectedEventId)
      .then((items) => {
        if (!isMounted) return;
        setSchedules(items);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar las actividades.',
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingSchedules(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedEventId]);

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm(selectedEventId));
    setValidationAlert(null);
    dialog.current?.showModal();
  }

  function openEditForm(schedule: ScheduleItem) {
    setEditing(schedule);
    setForm({
      eventId: schedule.eventId,
      name: schedule.name,
      description: schedule.description ?? '',
      startAt: toLocalDateTime(schedule.startAt),
      endAt: toLocalDateTime(schedule.endAt),
      responsibleUserId: schedule.responsibleUserId ?? '',
    });
    setValidationAlert(null);
    dialog.current?.showModal();
  }

  function closeForm() {
    dialog.current?.close();
    setEditing(null);
    setValidationAlert(null);
  }

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidationAlert(null);

    const missingFields = [
      !form.name.trim() && 'Nombre de la actividad',
      !form.startAt && 'Fecha de inicio',
      !form.endAt && 'Fecha de finalización',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setValidationAlert(
        `Completa los siguientes campos obligatorios: ${missingFields.join(', ')}.`,
      );
      return;
    }

    if (!editing && form.startAt.slice(0, 10) < minimumStartDate) {
      setValidationAlert(
        'La fecha de inicio debe ser posterior a la fecha de hoy.',
      );
      return;
    }

    if (form.endAt < form.startAt) {
      setValidationAlert(
        'La fecha de finalización no puede ser anterior a la fecha de inicio.',
      );
      return;
    }

    setIsSaving(true);

    const payload: SchedulePayload = {
      name: form.name.trim(),
      description: form.description.trim() || (editing ? null : undefined),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      responsibleUserId: form.responsibleUserId || (editing ? null : undefined),
      status: getAutomaticStatus(form.startAt, form.endAt),
    };

    try {
      const saved = editing
        ? await updateSchedule(editing.id, payload)
        : await createSchedule(form.eventId, payload);

      if (saved.eventId === selectedEventId) {
        setSchedules((current) =>
          editing
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved].sort(
                (left, right) =>
                  new Date(left.startAt).getTime() -
                  new Date(right.startAt).getTime(),
              ),
        );
        setIsLoadingSchedules(false);
      } else {
        setSelectedEventId(saved.eventId);
        setSchedules([saved]);
        setIsLoadingSchedules(false);
      }
      closeForm();
      feedback.notify(
        editing
          ? 'Actividad actualizada correctamente.'
          : 'Actividad creada correctamente.',
      );
    } catch (saveError) {
      setValidationAlert(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo guardar la actividad.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel(schedule: ScheduleItem) {
    const confirmed = await feedback.confirm(
      '¿Vas a cancelar esta actividad?',
      `La actividad “${schedule.name}” quedará cancelada y no podrá continuar en el cronograma.`,
      'Sí, cancelar actividad',
      'warning',
      'CANCELAR',
    );
    if (!confirmed) return;

    setCancellingId(schedule.id);
    setError(null);
    try {
      const saved = await cancelSchedule(schedule.id);
      setSchedules((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'No se pudo cancelar la actividad.',
      );
    } finally {
      setCancellingId(null);
    }
  }

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const formEvent = events.find((event) => event.id === form.eventId);
  const userNameById = new Map(users.map((user) => [user.id, user.name]));

  return (
    <AppShell hideTitle title="Cronograma">
      <div className="grid gap-6">
        <header className="events-hero">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-violet">
              Planificación operativa
            </p>
            <h1 className="mt-1 text-4xl font-bold">Cronograma</h1>
            <p className="mt-2 max-w-xl text-base text-muted">
              Organiza las actividades de cada evento y mantén a tu equipo al
              día.
            </p>
          </div>
          <PermissionGate permission="cronogramas.crear">
            <Button
              disabled={events.length === 0}
              onClick={openCreateForm}
              type="button"
            >
              + Nueva actividad
            </Button>
          </PermissionGate>
        </header>

        <section className="events-banner">
          <span className="events-banner__icon" aria-hidden="true">
            <Image
              alt=""
              className="brightness-0 invert"
              height={24}
              src="/icons/cronograma.svg"
              width={24}
            />
          </span>
          <div>
            <h2 className="text-xl font-bold">
              Tu agenda de eventos, en orden
            </h2>
            <p className="mt-1 text-sm text-muted">
              Revisa horarios, responsables y el avance de cada actividad.
            </p>
          </div>
        </section>

        {isLoadingEvents ? (
          <LoadingState label="Cargando eventos…" />
        ) : events.length === 0 ? (
          <Card className="border-dashed text-center">
            <p className="font-semibold">
              No hay eventos activos para programar.
            </p>
            <p className="mt-1 text-sm text-muted">
              Crea un evento antes de registrar actividades.
            </p>
          </Card>
        ) : (
          <section className="events-list-panel">
            <div className="events-list-panel__toolbar flex-col items-stretch pb-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.14em] text-muted">
                  Actividades programadas
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {selectedEvent?.name ?? 'Cronograma de eventos'}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedEvent
                    ? `${schedules.length} ${schedules.length === 1 ? 'actividad programada' : 'actividades programadas'}.`
                    : 'Selecciona un evento para ver sus actividades.'}
                </p>
              </div>
              <label className="grid max-w-full gap-1 text-sm font-semibold sm:w-80">
                <span className="text-muted">Evento</span>
                <select
                  className={fieldClassName}
                  onChange={(event) => {
                    setIsLoadingSchedules(true);
                    setSelectedEventId(event.target.value);
                  }}
                  value={selectedEventId}
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {isLoadingSchedules ? (
              <div className="p-6">
                <LoadingState label="Cargando actividades…" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="grid min-h-56 place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet/10 text-xl text-violet">
                    +
                  </span>
                  <h3 className="mt-3 font-bold">Aún no hay actividades</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted">
                    Crea la primera actividad para organizar este evento.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="events-table min-w-[62rem]">
                  <thead>
                    <tr>
                      <th>Actividad</th>
                      <th>Fecha y hora</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((item) => {
                      const status =
                        item.status === 'cancelado'
                          ? item.status
                          : getAutomaticStatus(item.startAt, item.endAt);
                      const responsible = item.responsibleUserId
                        ? (userNameById.get(item.responsibleUserId) ??
                          'Usuario asignado')
                        : 'Sin responsable';

                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="max-w-72">
                              <p className="font-semibold">{item.name}</p>
                              <p className="mt-1 line-clamp-1 text-sm text-muted">
                                {item.description || 'Sin descripción'}
                              </p>
                            </div>
                          </td>
                          <td>
                            <div className="events-table__detail min-w-56">
                              <span className="events-table__icon text-violet">
                                ◷
                              </span>
                              <div>
                                <p className="font-semibold text-navy">
                                  {formatDate(item.startAt)}
                                </p>
                                <p className="mt-1 text-xs">
                                  Hasta {formatDate(item.endAt)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <p className="font-medium">{responsible}</p>
                            <p className="mt-1 text-xs text-muted">
                              Responsable
                            </p>
                          </td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[status]}`}
                            >
                              {statusLabels[status]}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap justify-end gap-2">
                              {can('cronogramas.editar') &&
                              item.status !== 'cancelado' ? (
                                <Button
                                  className="px-3 py-1.5 text-xs"
                                  onClick={() => openEditForm(item)}
                                  type="button"
                                  variant="secondary"
                                >
                                  Editar
                                </Button>
                              ) : null}
                              {can('cronogramas.eliminar') &&
                              item.status !== 'cancelado' ? (
                                <Button
                                  className="px-3 py-1.5 text-xs"
                                  disabled={cancellingId === item.id}
                                  onClick={() => void handleCancel(item)}
                                  type="button"
                                >
                                  {cancellingId === item.id
                                    ? 'Cancelando…'
                                    : 'Cancelar'}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="events-list-panel__footer">
              Mostrando {schedules.length}{' '}
              {schedules.length === 1 ? 'actividad' : 'actividades'} de este
              evento.
            </p>
          </section>
        )}

        <dialog
          aria-labelledby="activity-dialog-title"
          className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-[1.75rem] border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
          onClose={() => setEditing(null)}
          ref={dialog}
        >
          <div className="flex items-start justify-between gap-4 border-b border-sky-blue bg-linear-to-r from-violet/10 via-white to-teal/10 p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.16em] text-violet">
                Cronograma
              </p>
              <h2
                className="mt-1 text-2xl font-bold"
                id="activity-dialog-title"
              >
                {editing ? 'Editar actividad' : 'Nueva actividad'}
              </h2>
            </div>
            <Button
              aria-label="Cerrar formulario"
              className="px-3 text-xl leading-none"
              onClick={closeForm}
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </div>
          <form
            className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8"
            noValidate
            onSubmit={saveSchedule}
          >
            <label className="grid gap-2 rounded-[1.25rem] border border-sky-blue bg-beige/50 p-4 text-sm font-semibold sm:col-span-2">
              Evento
              <select
                className={fieldClassName}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm({ ...form, eventId: event.target.value })
                }
                required
                value={form.eventId}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            {formEvent ? (
              <p className="rounded-xl border border-teal/15 bg-teal/5 px-4 py-3 text-sm text-muted sm:col-span-2">
                <span className="font-semibold text-navy">
                  Periodo del evento:
                </span>{' '}
                {formatDate(formEvent.startAt)} — {formatDate(formEvent.endAt)}
              </p>
            ) : null}
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Nombre de la actividad
              <input
                className={fieldClassName}
                maxLength={120}
                minLength={2}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                value={form.name}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Descripción
              <textarea
                className={fieldClassName}
                maxLength={1000}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows={3}
                value={form.description}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Fecha y hora de inicio
              <input
                className={fieldClassName}
                min={!editing ? `${minimumStartDate}T00:00` : undefined}
                onChange={(event) =>
                  setForm({ ...form, startAt: event.target.value })
                }
                required
                type="datetime-local"
                value={form.startAt}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Fecha y hora de finalización
              <input
                className={fieldClassName}
                min={
                  !editing
                    ? form.startAt || `${minimumStartDate}T00:00`
                    : undefined
                }
                onChange={(event) =>
                  setForm({ ...form, endAt: event.target.value })
                }
                required
                type="datetime-local"
                value={form.endAt}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Responsable
              <select
                className={fieldClassName}
                onChange={(event) =>
                  setForm({ ...form, responsibleUserId: event.target.value })
                }
                value={form.responsibleUserId}
              >
                <option value="">Sin responsable</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 flex gap-3 border-t border-sky-blue pt-5 sm:col-span-2">
              <Button disabled={isSaving} type="submit">
                {isSaving ? 'Guardando…' : 'Guardar actividad'}
              </Button>
              <Button onClick={closeForm} type="button" variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
          <AlertOverlay
            message={validationAlert}
            onClose={() => setValidationAlert(null)}
          />
        </dialog>
        <AlertOverlay message={error} onClose={() => setError(null)} />
        <FeedbackMessages feedback={feedback} />
      </div>
    </AppShell>
  );
}
