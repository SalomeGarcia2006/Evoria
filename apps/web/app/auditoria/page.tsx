'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';

const auditActions = [
  'Inicio de sesión',
  'Cierre de sesión',
  'Creación de evento',
  'Modificación de evento',
  'Eliminación o desactivación',
  'Asignación de recurso',
  'Cambio de inventario',
  'Cambio de permisos',
  'Generación de reporte',
] as const;

type AuditAction = (typeof auditActions)[number];

type AuditRecord = {
  id: string;
  date: string;
  dateTime: string;
  user: string;
  action: AuditAction;
  detail: string;
};

const auditRecords: AuditRecord[] = [
  {
    id: 'AUD-001',
    date: '2026-10-26',
    dateTime: '26 oct 2026 · 09:42',
    user: 'Laura Gómez',
    action: 'Inicio de sesión',
    detail: 'Accedió al panel de la empresa.',
  },
  {
    id: 'AUD-002',
    date: '2026-10-26',
    dateTime: '26 oct 2026 · 09:18',
    user: 'Carlos Ruiz',
    action: 'Creación de evento',
    detail: 'Creó el evento Feria de innovación.',
  },
  {
    id: 'AUD-003',
    date: '2026-10-25',
    dateTime: '25 oct 2026 · 16:05',
    user: 'Mariana Torres',
    action: 'Asignación de recurso',
    detail: 'Asignó 40 sillas al evento Feria de innovación.',
  },
  {
    id: 'AUD-004',
    date: '2026-10-25',
    dateTime: '25 oct 2026 · 14:21',
    user: 'Laura Gómez',
    action: 'Cambio de permisos',
    detail: 'Actualizó los permisos del perfil Operaciones.',
  },
  {
    id: 'AUD-005',
    date: '2026-10-24',
    dateTime: '24 oct 2026 · 11:30',
    user: 'Carlos Ruiz',
    action: 'Cambio de inventario',
    detail: 'Ajustó la disponibilidad de proyectores.',
  },
  {
    id: 'AUD-006',
    date: '2026-10-24',
    dateTime: '24 oct 2026 · 10:15',
    user: 'Mariana Torres',
    action: 'Modificación de evento',
    detail: 'Actualizó la ubicación del evento Jornada de bienestar.',
  },
  {
    id: 'AUD-007',
    date: '2026-10-23',
    dateTime: '23 oct 2026 · 17:42',
    user: 'Laura Gómez',
    action: 'Eliminación o desactivación',
    detail: 'Desactivó el recurso Mesa auxiliar.',
  },
  {
    id: 'AUD-008',
    date: '2026-10-23',
    dateTime: '23 oct 2026 · 15:08',
    user: 'Carlos Ruiz',
    action: 'Generación de reporte',
    detail: 'Generó el reporte de uso de recursos.',
  },
  {
    id: 'AUD-009',
    date: '2026-10-22',
    dateTime: '22 oct 2026 · 18:00',
    user: 'Mariana Torres',
    action: 'Cierre de sesión',
    detail: 'Cerró su sesión en la plataforma.',
  },
];

const fieldClassName =
  'rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export default function AuditoriaPage() {
  const [filters, setFilters] = useState({ action: '', date: '' });
  const [appliedFilters, setAppliedFilters] = useState<{
    action: AuditAction;
    date: string;
  } | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);

  const visibleRecords = useMemo(
    () =>
      appliedFilters
        ? auditRecords.filter(
            (record) =>
              record.action === appliedFilters.action &&
              record.date === appliedFilters.date,
          )
        : auditRecords,
    [appliedFilters],
  );

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationAlert(null);

    const missingFields = [
      !filters.action && 'Acción',
      !filters.date && 'Fecha',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setValidationAlert(
        `Completa los siguientes campos obligatorios: ${missingFields.join(', ')}.`,
      );
      return;
    }

    setAppliedFilters({
      action: filters.action as AuditAction,
      date: filters.date,
    });
  }

  function clearFilters() {
    setFilters({ action: '', date: '' });
    setAppliedFilters(null);
    setValidationAlert(null);
  }

  return (
    <AppShell title="Auditoría">
      <div className="grid gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Seguimiento administrativo
          </p>
          <h2 className="mt-2 text-3xl font-bold">Auditoría</h2>
          <p className="mt-1 text-teal">
            Consulta las acciones importantes realizadas en la plataforma.
          </p>
        </header>

        <Card>
          <form
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
            noValidate
            onSubmit={applyFilters}
          >
            <label className="grid gap-2 text-sm font-semibold">
              Acción
              <select
                className={fieldClassName}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    action: event.target.value,
                  }))
                }
                required
                value={filters.action}
              >
                <option disabled value="">
                  Selecciona una acción
                </option>
                {auditActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Fecha
              <input
                className={fieldClassName}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                required
                type="date"
                value={filters.date}
              />
            </label>
            <div className="flex items-end gap-3">
              <Button type="submit">Consultar</Button>
              <Button onClick={clearFilters} type="button" variant="secondary">
                Limpiar
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-0">
          <div className="flex flex-col gap-2 border-b border-sky-blue px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold">Historial de acciones</h3>
              <p className="mt-1 text-sm text-teal">
                Vista visual con registros de ejemplo.
              </p>
            </div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              Sin integración API
            </span>
          </div>
          {visibleRecords.length > 0 ? (
            <DataTable
              columns={[
                {
                  key: 'date',
                  header: 'Fecha y hora',
                  render: (item) => item.dateTime,
                },
                { key: 'user', header: 'Usuario', render: (item) => item.user },
                {
                  key: 'action',
                  header: 'Acción',
                  render: (item) => item.action,
                },
                {
                  key: 'detail',
                  header: 'Detalle',
                  render: (item) => item.detail,
                },
              ]}
              rowKey={(item) => item.id}
              rows={visibleRecords}
            />
          ) : (
            <p className="p-6 text-sm text-teal">
              No hay registros de ejemplo para los filtros seleccionados.
            </p>
          )}
        </Card>
      </div>

      {validationAlert ? (
        <div
          aria-label="Alerta de validación de auditoría"
          aria-live="assertive"
          className="login-alert-backdrop fixed inset-0 z-50 grid place-items-center p-6"
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
            <p className="login-alert-kicker">
              Revisa los filtros de auditoría
            </p>
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
    </AppShell>
  );
}
