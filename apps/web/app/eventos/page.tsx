'use client';

import { AppShell } from '../../components/layout/AppShell';
import { EventForm } from '../../components/events/EventForm';
import { EventList } from '../../components/events/EventList';
import { useRef, useState } from 'react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { Button } from '../../components/ui/Button';

export default function EventosPage() {
  const eventDialog = useRef<HTMLDialogElement>(null);
  const [revision, setRevision] = useState(0);

  function openCreateForm() {
    eventDialog.current?.showModal();
  }

  function closeCreateForm() {
    eventDialog.current?.close();
  }

  return (
    <AppShell title="Eventos">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Eventos</h1>
            <p className="mt-1 text-sm text-teal">
              Consulta y administra los eventos de tu empresa.
            </p>
          </div>
          <PermissionGate permission="eventos.crear">
            <Button onClick={openCreateForm} type="button">
              + Nuevo evento
            </Button>
          </PermissionGate>
        </div>
        <EventList onCreate={openCreateForm} revision={revision} />

        <PermissionGate permission="eventos.crear">
          <dialog
            aria-labelledby="event-dialog-title"
            className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-4xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
            ref={eventDialog}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
                  Eventos
                </p>
                <h2 className="mt-1 text-2xl font-bold" id="event-dialog-title">
                  Nuevo evento
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
