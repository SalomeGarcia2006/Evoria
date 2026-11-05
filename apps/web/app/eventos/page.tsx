'use client';

import { AppShell } from '../../components/layout/AppShell';
import { EventForm } from '../../components/events/EventForm';
import { EventList } from '../../components/events/EventList';
import type { EventItem } from '../../services/events.service';
import { useRef, useState } from 'react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { Button } from '../../components/ui/Button';

export default function EventosPage() {
  const eventDialog = useRef<HTMLDialogElement>(null);
  const [revision, setRevision] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  function openCreateForm() {
    setEditingEvent(null);
    setFormKey((current) => current + 1);
    eventDialog.current?.showModal();
  }

  function openEditForm(event: EventItem) {
    setEditingEvent(event);
    setFormKey((current) => current + 1);
    eventDialog.current?.showModal();
  }

  function closeCreateForm() {
    eventDialog.current?.close();
    setEditingEvent(null);
  }

  return (
    <AppShell hideTitle title="Eventos">
      <div className="events-page grid gap-6">
        <section className="events-hero">
          <div>
            <h1 className="text-4xl font-bold">Eventos</h1>
            <p className="mt-2 max-w-xl text-base text-muted">
              Organiza cada detalle de tus próximos encuentros desde un solo
              lugar.
            </p>
          </div>
          <PermissionGate permission="eventos.crear">
            <Button onClick={openCreateForm} type="button">
              + Nuevo evento
            </Button>
          </PermissionGate>
        </section>
        <section className="events-banner">
          <span className="events-banner__icon" aria-hidden="true">
            <span>✓</span>
          </span>
          <div>
            <h2 className="text-xl font-bold">
              Todo listo para tu próximo evento
            </h2>
            <p className="mt-1 text-sm text-muted">
              Consulta fechas, ubicaciones y avances desde un solo lugar.
            </p>
          </div>
        </section>
        <EventList
          onCreate={openCreateForm}
          onEdit={openEditForm}
          revision={revision}
        />

        <PermissionGate permission="eventos.crear">
          <dialog
            aria-labelledby="event-dialog-title"
            className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-4xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
            ref={eventDialog}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
                  Eventos
                </p>
                <h2 className="mt-1 text-2xl font-bold" id="event-dialog-title">
                  {editingEvent ? 'Editar evento' : 'Nuevo evento'}
                </h2>
              </div>
              <Button
                aria-label="Cerrar formulario"
                className="px-3 text-xl leading-none"
                onClick={closeCreateForm}
                type="button"
                variant="ghost"
              >
                ×
              </Button>
            </div>
            <div className="p-6">
              <EventForm
                initialEvent={editingEvent ?? undefined}
                key={`${formKey}-${editingEvent?.id ?? 'new'}`}
                onCancel={closeCreateForm}
                onSuccess={() => {
                  closeCreateForm();
                  setRevision((current) => current + 1);
                }}
              />
            </div>
          </dialog>
        </PermissionGate>
      </div>
    </AppShell>
  );
}
