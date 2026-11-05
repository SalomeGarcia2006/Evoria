'use client';

import type { EventBudgetDetail } from '@evoria/contracts';
import { ProviderDialogShell } from '../providers/ProviderDialogShell';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { cop } from './BudgetAmountsView';

export type BudgetHistorySection = 'inventory' | 'providers' | 'extras';

const titles = {
  inventory: 'Detalle de inventario histórico',
  providers: 'Detalle de servicios de proveedores',
  extras: 'Detalle de costos adicionales aprobados',
};

export function BudgetHistoryDialog({
  section,
  budget,
  onClose,
}: {
  section: BudgetHistorySection;
  budget: EventBudgetDetail;
  onClose: () => void;
}) {
  const approvedExtras = [...budget.requests]
    .reverse()
    .filter(
      (request) =>
        request.type === 'costo_adicional' && request.status === 'aprobada',
    );
  return (
    <ProviderDialogShell
      title={titles[section]}
      busy={false}
      onClose={onClose}
      size="wide"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cerrar historial
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-5">
        <div className="rounded-xl bg-sky-blue/25 p-4">
          <p className="text-sm text-muted">Historial del evento</p>
          <h3 className="mt-1 break-words text-xl font-bold">
            {budget.eventName}
          </h3>
        </div>
        {section === 'inventory' && (
          <>
            <p className="text-sm text-muted">
              Las devoluciones permanecen en el historial y su costo se libera
              del presupuesto.
            </p>
            {!budget.inventoryLines.length ? (
              <EmptyState title="No hay asignaciones registradas para este evento" />
            ) : (
              <DataTable
                rows={budget.inventoryLines}
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', header: 'Recurso', render: (row) => row.name },
                  {
                    key: 'quantity',
                    header: 'Unidades',
                    render: (row) => row.quantity,
                  },
                  {
                    key: 'cost',
                    header: 'Costo histórico',
                    render: (row) => cop(row.costAmountCop),
                  },
                  {
                    key: 'status',
                    header: 'Estado',
                    render: (row) => row.status,
                  },
                ]}
              />
            )}
          </>
        )}
        {section === 'providers' && (
          <>
            <p className="text-sm text-muted">
              Los servicios cancelados se conservan en el historial y no cuentan
              como gasto confirmado.
            </p>
            {!budget.providerLines.length ? (
              <EmptyState title="No hay acuerdos registrados para este evento" />
            ) : (
              <DataTable
                rows={budget.providerLines}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: 'provider',
                    header: 'Proveedor',
                    render: (row) => row.providerName,
                  },
                  {
                    key: 'name',
                    header: 'Servicio',
                    render: (row) => row.serviceName,
                  },
                  {
                    key: 'date',
                    header: 'Fecha acordada',
                    render: (row) => row.startDate,
                  },
                  {
                    key: 'amount',
                    header: 'Valor',
                    render: (row) => cop(row.agreedAmountCop),
                  },
                  {
                    key: 'status',
                    header: 'Estado',
                    render: (row) =>
                      row.status === 'cancelado'
                        ? 'Cancelado · no cuenta como gasto'
                        : 'Confirmado',
                  },
                ]}
              />
            )}
          </>
        )}
        {section === 'extras' &&
          (!approvedExtras.length ? (
            <EmptyState title="No hay costos adicionales aprobados para este evento" />
          ) : (
            <DataTable
              rows={approvedExtras}
              rowKey={(request) => request.id}
              columns={[
                {
                  key: 'reason',
                  header: 'Motivo',
                  render: (request) => (
                    <p className="whitespace-pre-wrap break-words">
                      {request.reason}
                    </p>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Valor aprobado',
                  render: (request) => cop(request.amountCop),
                },
                {
                  key: 'date',
                  header: 'Fecha de aprobación',
                  render: (request) =>
                    request.decidedAt
                      ? new Date(request.decidedAt).toLocaleString('es-CO')
                      : '—',
                },
                {
                  key: 'approver',
                  header: 'Aprobado por',
                  render: (request) => request.decidedBy ?? '—',
                },
              ]}
            />
          ))}
      </div>
    </ProviderDialogShell>
  );
}
