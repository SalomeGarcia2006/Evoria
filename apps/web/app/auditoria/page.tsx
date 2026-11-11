'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingState } from '../../components/ui/LoadingState';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import { PageHero } from '../../components/ui/PageHero';
import {
  getAuditLogs,
  type AuditLogItem,
  type AuditLogList,
  type AuditLogQuery,
} from '../../services/audits.service';
import { getUsers, type CompanyUser } from '../../services/users.service';

const fieldClassName =
  'rounded-[0.875rem] border border-sky-blue bg-beige/45 px-3 py-2.5 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

const initialFilters = {
  userId: '',
  module: '',
  action: '',
  startDate: '',
  endDate: '',
};

function formatLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AuditoriaPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [auditData, setAuditData] = useState<AuditLogList | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersUnavailable, setUsersUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let isMounted = true;
    void getUsers()
      .then((items) => {
        if (isMounted) setUsers(items);
      })
      .catch(() => {
        if (isMounted) setUsersUnavailable(true);
      })
      .finally(() => {
        if (isMounted) setIsLoadingUsers(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const query: AuditLogQuery = {
      ...appliedFilters,
      page,
      limit,
      endDate: appliedFilters.endDate
        ? `${appliedFilters.endDate}T23:59:59.999`
        : undefined,
    };
    void getAuditLogs(query)
      .then((data) => {
        if (isMounted) setAuditData(data);
      })
      .catch((loadError: unknown) => {
        if (isMounted)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No fue posible cargar la auditoría.',
          );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [appliedFilters, limit, page, revision]);

  const moduleOptions = useMemo(
    () =>
      Array.from(new Set(auditData?.items.map((item) => item.module) ?? [])),
    [auditData],
  );
  const actionOptions = useMemo(
    () =>
      Array.from(new Set(auditData?.items.map((item) => item.action) ?? [])),
    [auditData],
  );

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setPage(1);
    setAppliedFilters(filters);
    setRevision((current) => current + 1);
  }

  function clearFilters() {
    setIsLoading(true);
    setError('');
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
    setRevision((current) => current + 1);
  }

  function changeLimit(nextLimit: number) {
    setIsLoading(true);
    setError('');
    setLimit(nextLimit);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setIsLoading(true);
    setError('');
    setPage(nextPage);
  }

  const rows: AuditLogItem[] = auditData?.items ?? [];
  const pagination = auditData?.pagination;

  return (
    <AppShell title="Auditoría">
      <div className="grid gap-5">
        <PageHero
          description="Consulta las acciones registradas y conserva la trazabilidad de tu operación."
          title="Auditoría"
        />

        <ModuleBanner
          description="Revisa quién hizo cada cambio y encuentra rápidamente la información que necesitas."
          icon="auditoria.svg"
          title="Trazabilidad de tu operación"
        />

        <Card className="p-0">
          <div className="border-b border-sky-blue bg-beige/45 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted">
              Consulta del historial
            </p>
            <h2 className="mt-1 text-xl font-bold">Filtra los registros</h2>
            <p className="mt-1 text-sm text-muted">
              Combina usuario, módulo, acción y fechas para acotar la búsqueda.
            </p>
          </div>
          <form
            className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5"
            onSubmit={applyFilters}
          >
            <label className="grid gap-2 text-sm font-semibold">
              Usuario
              <select
                className={fieldClassName}
                disabled={isLoadingUsers || usersUnavailable}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    userId: event.target.value,
                  }))
                }
                value={filters.userId}
              >
                <option value="">
                  {usersUnavailable
                    ? 'Usuarios no disponibles'
                    : 'Todos los usuarios'}
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Módulo
              <input
                className={fieldClassName}
                list="audit-modules"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    module: event.target.value,
                  }))
                }
                placeholder="Ej. eventos"
                value={filters.module}
              />
              <datalist id="audit-modules">
                {moduleOptions.map((module) => (
                  <option key={module} value={module} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Acción
              <input
                className={fieldClassName}
                list="audit-actions"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    action: event.target.value,
                  }))
                }
                placeholder="Ej. crear"
                value={filters.action}
              />
              <datalist id="audit-actions">
                {actionOptions.map((action) => (
                  <option key={action} value={action} />
                ))}
              </datalist>
            </label>
            <DateRangePicker
              endDate={filters.endDate}
              label="Periodo consultado"
              onChange={(startDate, endDate) =>
                setFilters((current) => ({
                  ...current,
                  startDate,
                  endDate,
                }))
              }
              startDate={filters.startDate}
            />
            <div className="flex flex-wrap items-end gap-3 border-t border-sky-blue pt-5 md:col-span-2 xl:col-span-5">
              <Button type="submit">Consultar</Button>
              <Button onClick={clearFilters} type="button" variant="secondary">
                Limpiar
              </Button>
            </div>
          </form>
        </Card>

        {error ? <ErrorMessage message={error} /> : null}
        <Card className="p-0">
          <div className="flex flex-col gap-3 border-b border-sky-blue bg-beige/45 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted">
                Registro de actividad
              </p>
              <h3 className="mt-1 text-xl font-bold">Historial de acciones</h3>
              <p className="mt-1 text-sm text-muted">
                {pagination
                  ? `${pagination.total} registros encontrados.`
                  : 'Consultando registros.'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-muted">
              Mostrar
              <select
                className="rounded-lg border border-sky-blue bg-white px-2 py-1 text-sm"
                onChange={(event) => changeLimit(Number(event.target.value))}
                value={limit}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
          {isLoading ? (
            <div className="p-6">
              <LoadingState label="Cargando registros de auditoría…" />
            </div>
          ) : rows.length > 0 ? (
            <DataTable
              columns={[
                {
                  key: 'date',
                  header: 'Fecha y hora',
                  render: (item) => (
                    <span className="whitespace-nowrap font-medium text-navy">
                      {formatDate(item.createdAt)}
                    </span>
                  ),
                },
                {
                  key: 'user',
                  header: 'Usuario',
                  render: (item) => item.userName,
                },
                {
                  key: 'module',
                  header: 'Módulo',
                  render: (item) => (
                    <span className="font-medium capitalize text-navy">
                      {formatLabel(item.module)}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  header: 'Acción',
                  render: (item) => (
                    <span className="inline-flex rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold capitalize text-violet">
                      {formatLabel(item.action)}
                    </span>
                  ),
                },
                {
                  key: 'entity',
                  header: 'Entidad',
                  render: (item) => (
                    <span className="font-medium text-navy">{item.entity}</span>
                  ),
                },
                {
                  key: 'detail',
                  header: 'Detalle',
                  render: (item) => item.description,
                },
              ]}
              rowKey={(item) => item.id}
              rows={rows}
            />
          ) : (
            <p className="p-6 text-sm text-muted">
              No hay registros para los filtros seleccionados.
            </p>
          )}
          {pagination && pagination.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-blue px-6 py-4">
              <p className="text-sm text-muted">
                Página {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={pagination.page === 1 || isLoading}
                  onClick={() => changePage(Math.max(1, pagination.page - 1))}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
                <Button
                  disabled={
                    pagination.page === pagination.totalPages || isLoading
                  }
                  onClick={() =>
                    changePage(
                      Math.min(pagination.totalPages, pagination.page + 1),
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
