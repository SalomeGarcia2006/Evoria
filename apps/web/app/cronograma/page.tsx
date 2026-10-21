'use client';

import { useRef } from 'react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';

type ScheduleActivity = {
  id: string;
  event: string;
  activity: string;
  startsAt: string;
  endsAt: string;
  status: string;
  responsible: string;
};

const scheduledActivities: ScheduleActivity[] = [
  {
    id: 'ACT-001',
    event: 'Encuentro de innovación',
    activity: 'Montaje de auditorio',
    startsAt: '18 oct 2026 · 07:00',
    endsAt: '18 oct 2026 · 09:00',
    status: 'Pendiente',
    responsible: 'Laura Gómez',
  },
  {
    id: 'ACT-002',
    event: 'Encuentro de innovación',
    activity: 'Registro de asistentes',
    startsAt: '18 oct 2026 · 08:00',
    endsAt: '18 oct 2026 · 09:30',
    status: 'En curso',
    responsible: 'Carlos Ruiz',
  },
  {
    id: 'ACT-003',
    event: 'Feria de emprendimiento',
    activity: 'Verificación de expositores',
    startsAt: '24 oct 2026 · 08:30',
    endsAt: '24 oct 2026 · 10:00',
    status: 'Programada',
    responsible: 'Mariana Torres',
  },
];

const fieldClassName =
  'rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export default function CronogramaPage() {
  const createDialog = useRef<HTMLDialogElement>(null);

  return (
    <AppShell title="Cronograma">
      <div className="grid gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Planificación operativa
            </p>
            <h2 className="mt-2 text-3xl font-bold">Actividades programadas</h2>
            <p className="mt-1 text-teal">
              Organiza las tareas de cada evento y da seguimiento a sus
              responsables.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              Vista previa · sin guardado
            </span>
            <PermissionGate permission="cronogramas.crear">
              <Button
                onClick={() => createDialog.current?.showModal()}
                type="button"
              >
                + Nueva actividad
              </Button>
            </PermissionGate>
          </div>
        </header>

        <Card className="p-0">
          <div className="flex flex-col gap-2 border-b border-sky-blue px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold">Cronograma de eventos</h3>
              <p className="mt-1 text-sm text-teal">
                Actividades de ejemplo para visualizar la planificación.
              </p>
            </div>
            <span className="text-sm font-semibold text-teal">
              {scheduledActivities.length} actividades
            </span>
          </div>
          <DataTable
            columns={[
              { key: 'id', header: 'ID', render: (activity) => activity.id },
              {
                key: 'event',
                header: 'Evento',
                render: (activity) => (
                  <span className="font-semibold">{activity.event}</span>
                ),
              },
              {
                key: 'activity',
                header: 'Actividad',
                render: (activity) => activity.activity,
              },
              {
                key: 'start',
                header: 'Inicio',
                render: (activity) => activity.startsAt,
              },
              {
                key: 'end',
                header: 'Fin',
                render: (activity) => activity.endsAt,
              },
              {
                key: 'status',
                header: 'Estado',
                render: (activity) => <StatusBadge status={activity.status} />,
              },
              {
                key: 'responsible',
                header: 'Responsable',
                render: (activity) => activity.responsible,
              },
            ]}
            rowKey={(activity) => activity.id}
            rows={scheduledActivities}
          />
        </Card>

        <PermissionGate permission="cronogramas.crear">
          <dialog
            aria-labelledby="new-activity-title"
            className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
            ref={createDialog}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
                  Cronograma
                </p>
                <h2 className="mt-1 text-2xl font-bold" id="new-activity-title">
                  Nueva actividad
                </h2>
                <p className="mt-1 text-sm text-teal">
                  Define la información que se guardará cuando el módulo tenga
                  API.
                </p>
              </div>
              <Button
                aria-label="Cerrar formulario"
                className="px-3 text-xl leading-none"
                onClick={() => createDialog.current?.close()}
                type="button"
                variant="ghost"
              >
                ×
              </Button>
            </div>
            <form className="grid gap-5 p-6 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Nombre de la actividad
                <input
                  className={fieldClassName}
                  placeholder="Ej. Confirmar montaje de sonido"
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Descripción
                <textarea
                  className={fieldClassName}
                  placeholder="Describe lo que se debe realizar."
                  rows={3}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Evento
                <select className={fieldClassName} defaultValue="">
                  <option disabled value="">
                    Selecciona un evento
                  </option>
                  <option>Encuentro de innovación</option>
                  <option>Feria de emprendimiento</option>
                  <option>Jornada de bienestar</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Responsable
                <select className={fieldClassName} defaultValue="">
                  <option disabled value="">
                    Selecciona un responsable
                  </option>
                  <option>Laura Gómez</option>
                  <option>Carlos Ruiz</option>
                  <option>Mariana Torres</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Estado
                <select className={fieldClassName} defaultValue="Programada">
                  <option>Programada</option>
                  <option>En curso</option>
                  <option>Completada</option>
                  <option>Cancelada</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Fecha y hora de inicio
                <input className={fieldClassName} type="datetime-local" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Fecha y hora de finalización
                <input className={fieldClassName} type="datetime-local" />
              </label>
              <div className="flex flex-wrap items-center gap-3 border-t border-sky-blue pt-5 sm:col-span-2">
                <Button disabled type="button">
                  Guardar actividad
                </Button>
                <Button
                  onClick={() => createDialog.current?.close()}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <p className="text-xs text-teal">
                  El guardado se habilitará al conectar el contrato de
                  cronogramas.
                </p>
              </div>
            </form>
          </dialog>
        </PermissionGate>
      </div>
    </AppShell>
  );
}
