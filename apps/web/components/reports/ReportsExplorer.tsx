'use client';

import type { ReportKind, ReportQuery } from '@evoria/contracts';
import { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '../../services/api';
import {
  downloadReport,
  getReport,
  type ReportData,
} from '../../services/reports.service';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const reportNames: Record<ReportKind, string> = {
  events: 'Eventos',
  budgets: 'Presupuestos',
  inventory: 'Inventario',
  resources: 'Asignaciones',
  providers: 'Proveedores',
  schedules: 'Cronogramas',
};

const date = (value: unknown) =>
  typeof value === 'string'
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(
        new Date(value),
      )
    : '—';
const money = (value: unknown) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

function Item({
  item,
  kind,
}: {
  item: Record<string, unknown>;
  kind: ReportKind;
}) {
  const title = String(
    item.name ??
      item.eventName ??
      item.providerName ??
      item.inventoryName ??
      'Sin nombre',
  );
  const description =
    kind === 'events'
      ? `${item.type ?? 'Sin tipo'} · ${date(item.startAt)} · ${item.invitados ?? 0} invitados`
      : kind === 'budgets'
        ? `Asignado ${money(item.allocatedCop)} · Gastado ${money(item.spentCop)} · Disponible ${money(item.remainingCop)}`
        : kind === 'inventory'
          ? `${item.type ?? 'Recurso'} · ${item.availableQuantity ?? 0} disponibles de ${item.totalQuantity ?? 0}`
          : kind === 'resources'
            ? `${item.eventName ?? 'Evento'} · ${item.quantity ?? 0} unidades · ${date(item.assignedAt)}`
            : kind === 'providers'
              ? `${item.serviceCount ?? 0} servicios · ${item.eventCount ?? 0} eventos · Confirmado ${money(item.confirmedAmountCop)}`
              : `${item.total ?? 0} actividades · ${item.completado ?? 0} completadas`;
  const status = item.status ?? item.eventStatus;
  return (
    <article className="grid gap-1 border-b border-sky-blue py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {typeof status === 'string' && (
        <span className="w-fit rounded-full bg-lilac px-3 py-1 text-xs font-semibold text-violet">
          {status.replace('_', ' ')}
        </span>
      )}
    </article>
  );
}

export function ReportsExplorer() {
  const [kind, setKind] = useState<ReportKind>('events');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const query = useMemo<ReportQuery>(
    () => ({
      page,
      limit: 10,
      ...(kind === 'inventory'
        ? {}
        : {
            from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
            to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
            status: (status as ReportQuery['status']) || undefined,
          }),
    }),
    [from, kind, page, status, to],
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError('');
      }
    });
    getReport(kind, query)
      .then((report) => {
        if (active) setData(report);
      })
      .catch((reason: unknown) => {
        if (active) {
          setData(undefined);
          setError(apiErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, query]);

  const pagination = data?.pagination;
  const changeKind = (next: ReportKind) => {
    setKind(next);
    setPage(1);
    setStatus('');
  };
  const exportCsv = async () => {
    try {
      const blob = await downloadReport(kind, query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-${kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    }
  };

  return (
    <section aria-label="Explorador de reportes" className="module-panel">
      <div className="module-panel__heading">
        <div>
          <h2 className="text-xl font-bold">Explorar reportes</h2>
          <p className="mt-1 text-sm text-muted">
            Filtra, consulta y exporta la información actual de tu empresa.
          </p>
        </div>
      </div>
      <div className="module-panel__content grid gap-5">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Tipo de reporte"
        >
          {(Object.keys(reportNames) as ReportKind[]).map((value) => (
            <Button
              key={value}
              variant={kind === value ? 'primary' : 'secondary'}
              onClick={() => changeKind(value)}
            >
              {reportNames[value]}
            </Button>
          ))}
        </div>
        {kind !== 'inventory' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              Desde
              <input
                className="rounded-xl border border-sky-blue bg-white px-3 py-2 text-navy"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Hasta
              <input
                className="rounded-xl border border-sky-blue bg-white px-3 py-2 text-navy"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Estado
              <select
                className="rounded-xl border border-sky-blue bg-white px-3 py-2 text-navy"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="planificado">Planificado</option>
                <option value="en_progreso">En progreso</option>
                <option value="finalizado">Finalizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </label>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={exportCsv} disabled={loading}>
            Exportar CSV
          </Button>
        </div>
        {error ? (
          <Card>
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted">
            Consultando {reportNames[kind].toLowerCase()}…
          </p>
        ) : !data?.items.length ? (
          <Card>
            <p className="text-sm text-muted">
              No hay resultados para los filtros seleccionados.
            </p>
          </Card>
        ) : (
          <div>
            {data.items.map((item, index) => {
              const entry = item as unknown as Record<string, unknown>;
              return (
                <Item
                  key={`${kind}-${String(entry.id ?? entry.eventId ?? entry.providerId ?? index)}`}
                  item={entry}
                  kind={kind}
                />
              );
            })}
          </div>
        )}
        {pagination && pagination.totalPages > 1 && (
          <nav
            className="flex flex-wrap items-center justify-between gap-3"
            aria-label="Paginación"
          >
            <p className="text-sm text-muted">
              Página {pagination.page} de {pagination.totalPages} ·{' '}
              {pagination.total} resultados
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}
