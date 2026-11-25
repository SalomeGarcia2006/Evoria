'use client';

import type { PdfReportKind, ReportKind, ReportQuery } from '@evoria/contracts';
import { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '../../services/api';
import {
  downloadPdfReport,
  getReport,
  type ReportData,
} from '../../services/reports.service';
import { Button } from '../ui/Button';
import styles from './ReportsExplorer.module.css';

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
const label = (value: unknown) => String(value ?? '—').replaceAll('_', ' ');

function columns(kind: ReportKind) {
  switch (kind) {
    case 'events':
      return ['Evento', 'Fecha', 'Estado', 'Invitados', 'Tipo'];
    case 'budgets':
      return ['Evento', 'Estado', 'Asignado', 'Gastado', 'Disponible'];
    case 'inventory':
      return ['Recurso', 'Tipo', 'Disponibles', 'Reservadas', 'Estado'];
    case 'resources':
      return ['Recurso', 'Evento', 'Cantidad', 'Fecha', 'Costo'];
    case 'providers':
      return [
        'Proveedor',
        'Servicios',
        'Confirmados',
        'Eventos',
        'Valor confirmado',
      ];
    case 'schedules':
      return ['Evento', 'Total', 'Pendientes', 'En progreso', 'Completadas'];
  }
}

function cells(item: Record<string, unknown>, kind: ReportKind) {
  switch (kind) {
    case 'events':
      return [
        item.name,
        date(item.startAt),
        label(item.status),
        item.invitados ?? 0,
        item.type ?? 'Sin tipo',
      ];
    case 'budgets':
      return [
        item.eventName,
        label(item.eventStatus),
        money(item.allocatedCop),
        money(item.spentCop),
        money(item.remainingCop),
      ];
    case 'inventory':
      return [
        item.name,
        item.type,
        item.availableQuantity ?? 0,
        item.reservedQuantity ?? 0,
        label(item.status),
      ];
    case 'resources':
      return [
        item.inventoryName,
        item.eventName,
        item.quantity ?? 0,
        date(item.assignedAt),
        money(item.costAmountCop),
      ];
    case 'providers':
      return [
        item.providerName,
        item.serviceCount ?? 0,
        item.confirmedCount ?? 0,
        item.eventCount ?? 0,
        money(item.confirmedAmountCop),
      ];
    case 'schedules':
      return [
        item.eventName,
        item.total ?? 0,
        item.pendiente ?? 0,
        item.en_progreso ?? 0,
        item.completado ?? 0,
      ];
  }
}

export function ReportsExplorer() {
  const [kind, setKind] = useState<ReportKind>('events');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportData>();
  const [eventOptions, setEventOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [eventPdfId, setEventPdfId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<PdfReportKind>();

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
      if (!active) return;
      setLoading(true);
      setError('');
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

  useEffect(() => {
    let active = true;
    getReport('events', { page: 1, limit: 100 })
      .then((report) => {
        if (!active) return;
        setEventOptions(
          report.items.map((item) => {
            const event = item as unknown as Record<string, unknown>;
            return {
              id: String(event.id),
              name: String(event.name ?? 'Evento sin nombre'),
            };
          }),
        );
      })
      .catch(() => {
        if (active) setEventOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('es-CO');
    return !normalized
      ? (data?.items ?? [])
      : (data?.items ?? []).filter((item) =>
          JSON.stringify(item).toLocaleLowerCase('es-CO').includes(normalized),
        );
  }, [data?.items, search]);
  const reset = () => {
    setFrom('');
    setTo('');
    setStatus('');
    setSearch('');
    setPage(1);
  };
  const changeKind = (next: ReportKind) => {
    setKind(next);
    setPage(1);
    setStatus('');
    setSearch('');
  };
  const exportFile = async (exportKind: PdfReportKind) => {
    if (exporting) return;
    setExporting(exportKind);
    try {
      const exportQuery =
        exportKind === 'event'
          ? { eventId: eventPdfId }
          : exportKind === 'company' || exportKind === 'teams'
            ? {}
            : query;
      const blob = await downloadPdfReport(exportKind, exportQuery);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-${exportKind}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setExporting(undefined);
    }
  };

  return (
    <section
      aria-label="Explorar reportes"
      className={styles.panel}
      data-tour="reports-explorer"
    >
      <div className={styles.heading}>
        <h2>Explorar reportes</h2>
        <p>Elige una categoría, filtra y exporta lo que ves.</p>
      </div>
      <div
        aria-label="Tipo de reporte"
        className={styles.tabs}
        data-tour="report-types"
        role="tablist"
      >
        {(Object.keys(reportNames) as ReportKind[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className={kind === value ? styles.tabActive : styles.tab}
            onClick={() => changeKind(value)}
          >
            {reportNames[value]}
          </button>
        ))}
      </div>
      <div className={styles.filters} data-tour="report-filters">
        <label>
          Desde
          <input
            type="date"
            value={from}
            disabled={kind === 'inventory'}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            disabled={kind === 'inventory'}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Estado
          <select
            value={status}
            disabled={kind === 'inventory'}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="borrador">Creado</option>
            <option value="planificado">Planificado</option>
            <option value="en_progreso">En progreso</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className={styles.search}>
          Buscar
          <input
            value={search}
            placeholder={`Buscar en ${reportNames[kind].toLowerCase()}`}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button variant="secondary" className={styles.clear} onClick={reset}>
          Limpiar
        </Button>
        <Button
          className={styles.export}
          data-tour="report-export-current"
          onClick={() => exportFile(kind)}
          disabled={loading || Boolean(exporting)}
        >
          ↓ {exporting === kind ? 'Preparando…' : 'Exportar PDF'}
        </Button>
      </div>
      {error ? (
        <p data-tour="report-results" role="alert" className={styles.error}>
          {error}
        </p>
      ) : loading ? (
        <p className={styles.empty} data-tour="report-results">
          Consultando {reportNames[kind].toLowerCase()}…
        </p>
      ) : !visibleItems.length ? (
        <p className={styles.empty} data-tour="report-results">
          No hay resultados para los filtros seleccionados.
        </p>
      ) : (
        <div className={styles.tableWrap} data-tour="report-results">
          <table>
            <thead>
              <tr>
                {columns(kind).map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => {
                const entry = item as unknown as Record<string, unknown>;
                return (
                  <tr
                    key={`${kind}-${String(entry.id ?? entry.eventId ?? entry.providerId ?? index)}`}
                  >
                    {cells(entry, kind).map((cell, cellIndex) => (
                      <td
                        key={`${String(cell)}-${cellIndex}`}
                        className={cellIndex === 0 ? styles.mainCell : ''}
                      >
                        {cellIndex === 2 &&
                        (kind === 'events' ||
                          kind === 'budgets' ||
                          kind === 'inventory') ? (
                          <span className={styles.status}>{String(cell)}</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <nav
          aria-label="Paginación"
          className={styles.pagination}
          data-tour="report-pagination"
        >
          <p>
            Página {data.pagination.page} de {data.pagination.totalPages} ·{' '}
            {data.pagination.total} resultados
          </p>
          <div>
            <Button
              variant="secondary"
              disabled={data.pagination.page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={
                data.pagination.page >= data.pagination.totalPages || loading
              }
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}
      <section
        aria-label="Documentos PDF"
        className={styles.documents}
        data-tour="report-documents"
      >
        <div className={styles.documentsHeading}>
          <h2>Documentos PDF</h2>
          <p>
            Genera documentos listos para compartir. No modifican ningún dato.
          </p>
        </div>
        <div className={styles.documentGrid}>
          <article>
            <h3>Ficha de empresa</h3>
            <p>Datos generales y resumen consolidado.</p>
            <Button
              variant="secondary"
              onClick={() => exportFile('company')}
              disabled={Boolean(exporting)}
            >
              Generar PDF
            </Button>
          </article>
          <article>
            <h3>Listado de equipos</h3>
            <p>Equipos y responsables de la empresa.</p>
            <Button
              variant="secondary"
              onClick={() => exportFile('teams')}
              disabled={Boolean(exporting)}
            >
              Generar PDF
            </Button>
          </article>
          <article>
            <h3>Detalle de un evento</h3>
            <label className="sr-only" htmlFor="report-event-pdf">
              Evento
            </label>
            <select
              data-tour="report-event-selector"
              id="report-event-pdf"
              value={eventPdfId}
              onChange={(event) => setEventPdfId(event.target.value)}
            >
              <option value="">Selecciona un evento</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => exportFile('event')}
              disabled={!eventPdfId || Boolean(exporting)}
            >
              Generar PDF
            </Button>
          </article>
        </div>
      </section>
    </section>
  );
}
