'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { PageHero } from '../../components/ui/PageHero';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../services/api';
import {
  getAlert,
  getAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
  markAllAlertsAsRead,
  type AlertItem,
  type AlertQuery,
  type AlertType,
} from '../../services/alerts.service';

const alertTypes: Record<AlertType, string> = {
  event_responsibility: 'Responsable de evento',
  budget_pending: 'Presupuesto pendiente',
  budget_decided: 'Decisión de presupuesto',
  budget_limit: 'Límite de presupuesto',
  inventory_low: 'Inventario bajo',
  event_cancelled: 'Evento cancelado',
};

const fieldClassName =
  'rounded-lg border border-sky-blue bg-white px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function severityLabel(severity: AlertItem['severity']) {
  return severity === 'warning' ? 'Requiere atención' : 'Información';
}

function severityClassName(severity: AlertItem['severity']) {
  return severity === 'warning'
    ? 'bg-amber-50 text-amber-800'
    : 'bg-violet/10 text-violet';
}

export default function AlertasPage() {
  const { can } = useAuth();
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [filters, setFilters] = useState<AlertQuery>({ limit: 20 });
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getAlerts>
  > | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const canEdit = can('alertas.editar');

  useEffect(() => {
    let isMounted = true;
    void Promise.all([getAlerts(filters), getUnreadAlertCount()])
      .then(([alerts, count]) => {
        if (!isMounted) return;
        setData(alerts);
        setUnreadCount(count);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(apiErrorMessage(loadError));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [filters, revision]);

  function reload() {
    setLoading(true);
    setError('');
    setRevision((current) => current + 1);
  }

  function updateFilter<Key extends keyof AlertQuery>(
    key: Key,
    value: AlertQuery[Key],
  ) {
    setLoading(true);
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function showDetail(id: string) {
    setBusyId(id);
    setError('');
    try {
      setSelectedAlert(await getAlert(id));
      detailDialog.current?.showModal();
    } catch (detailError) {
      setError(apiErrorMessage(detailError));
    } finally {
      setBusyId(null);
    }
  }

  async function markRead(id: string) {
    setBusyId(id);
    setError('');
    try {
      await markAlertAsRead(id);
      detailDialog.current?.close();
      reload();
    } catch (readError) {
      setError(apiErrorMessage(readError));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setBusyId('all');
    setError('');
    try {
      await markAllAlertsAsRead();
      reload();
    } catch (readError) {
      setError(apiErrorMessage(readError));
    } finally {
      setBusyId(null);
    }
  }

  const pagination = data?.pagination;

  return (
    <AppShell hideTitle title="Alertas">
      <div className="grid gap-6">
        <PageHero
          title="Centro de alertas"
          description="Consulta las novedades y situaciones que requieren atención en tu empresa."
          actions={
            <>
              <span className="rounded-full bg-violet/10 px-3 py-2 text-sm font-semibold text-violet">
                {unreadCount} sin leer
              </span>
              {canEdit ? (
                <Button
                  disabled={unreadCount === 0 || busyId === 'all'}
                  onClick={() => void markAllRead()}
                  variant="secondary"
                >
                  {busyId === 'all'
                    ? 'Actualizando…'
                    : 'Marcar todas como leídas'}
                </Button>
              ) : null}
              <Button disabled={loading} onClick={reload}>
                Actualizar
              </Button>
            </>
          }
        />
        <ModuleBanner
          icon="alerta.svg"
          title="Novedades de tu empresa"
          description="Filtra las alertas por estado, severidad o tipo para encontrar lo que necesitas revisar."
        />

        <section className="module-panel" aria-label="Filtros de alertas">
          <div className="module-panel__heading">
            <h2 className="text-xl font-bold">Filtrar alertas</h2>
          </div>
          <div className="module-panel__content grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              Estado
              <select
                className={fieldClassName}
                onChange={(event) =>
                  updateFilter(
                    'unread',
                    event.target.value as AlertQuery['unread'],
                  )
                }
                value={filters.unread ?? ''}
              >
                <option value="">Todas</option>
                <option value="true">Sin leer</option>
                <option value="false">Leídas</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Severidad
              <select
                className={fieldClassName}
                onChange={(event) =>
                  updateFilter(
                    'severity',
                    event.target.value as AlertQuery['severity'],
                  )
                }
                value={filters.severity ?? ''}
              >
                <option value="">Todas</option>
                <option value="warning">Requiere atención</option>
                <option value="info">Información</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Tipo
              <select
                className={fieldClassName}
                onChange={(event) =>
                  updateFilter('type', event.target.value as AlertQuery['type'])
                }
                value={filters.type ?? ''}
              >
                <option value="">Todos los tipos</option>
                {Object.entries(alertTypes).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error ? <ErrorMessage message={error} /> : null}
        {loading ? (
          <LoadingState label="Consultando alertas…" />
        ) : data?.items.length ? (
          <section aria-label="Alertas actuales" className="grid gap-3">
            {data.items.map((alert) => (
              <Card
                className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
                  alert.readAt ? 'opacity-75' : ''
                }`}
                key={alert.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClassName(alert.severity)}`}
                    >
                      {severityLabel(alert.severity)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {alertTypes[alert.type]}
                    </span>
                    {!alert.readAt ? (
                      <span className="text-xs font-semibold text-teal">
                        Nueva
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-bold">{alert.title}</h3>
                  <p className="mt-1 break-words text-sm text-muted">
                    {alert.message}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {formatDate(alert.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    disabled={busyId === alert.id}
                    onClick={() => void showDetail(alert.id)}
                    type="button"
                    variant="secondary"
                  >
                    Ver detalle
                  </Button>
                  {canEdit && !alert.readAt ? (
                    <Button
                      disabled={busyId === alert.id}
                      onClick={() => void markRead(alert.id)}
                      type="button"
                    >
                      Marcar leída
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </section>
        ) : (
          <EmptyState
            description="Cuando haya novedades relevantes para ti, aparecerán aquí."
            title="No hay alertas para los filtros seleccionados"
          />
        )}

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Página {pagination.page} de {pagination.totalPages} ·{' '}
              {pagination.total} alertas
            </p>
            <div className="flex gap-3">
              <Button
                disabled={pagination.page === 1 || loading}
                onClick={() => updateFilter('page', pagination.page - 1)}
                type="button"
                variant="secondary"
              >
                Anterior
              </Button>
              <Button
                disabled={pagination.page === pagination.totalPages || loading}
                onClick={() => updateFilter('page', pagination.page + 1)}
                type="button"
                variant="secondary"
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <dialog
        aria-labelledby="alert-detail-title"
        className="w-[min(100%-2rem,34rem)] rounded-[1.375rem] border border-sky-blue bg-white p-0 text-ink shadow-[0_14px_30px_rgba(20,33,61,0.2)] backdrop:bg-ink/45"
        onClose={() => setSelectedAlert(null)}
        ref={detailDialog}
      >
        {selectedAlert ? (
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
                  {alertTypes[selectedAlert.type]}
                </p>
                <h2 className="mt-2 text-2xl font-bold" id="alert-detail-title">
                  {selectedAlert.title}
                </h2>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${severityClassName(selectedAlert.severity)}`}
              >
                {severityLabel(selectedAlert.severity)}
              </span>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-muted">
              {selectedAlert.message}
            </p>
            <dl className="mt-6 grid gap-3 border-t border-sky-blue pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Fecha</dt>
                <dd className="text-right font-semibold">
                  {formatDate(selectedAlert.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Estado</dt>
                <dd className="font-semibold">
                  {selectedAlert.readAt ? 'Leída' : 'Sin leer'}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-3">
              {canEdit && !selectedAlert.readAt ? (
                <Button
                  disabled={busyId === selectedAlert.id}
                  onClick={() => void markRead(selectedAlert.id)}
                  type="button"
                >
                  Marcar leída
                </Button>
              ) : null}
              <Button
                onClick={() => detailDialog.current?.close()}
                type="button"
                variant="secondary"
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </AppShell>
  );
}
