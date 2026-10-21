'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTenants, type TenantOption } from '../../services/tenants.service';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function TenantSelector({ revision }: { revision?: string }) {
  const { user, selectTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const isPlatform = user?.scope === 'platform';

  useEffect(() => {
    if (!isPlatform || !user?.isDeveloper) return;
    let active = true;
    getTenants()
      .then((items) => {
        if (!active) return;
        setTenants(items.filter((item) => item.status === 'activo'));
        setSelectedId((current) =>
          items.some((item) => item.id === current && item.status === 'activo')
            ? current
            : '',
        );
        setLoadError('');
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar las empresas.',
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isPlatform, user?.id, user?.isDeveloper, revision, attempt]);

  async function changeCompany(tenantId: string | null) {
    if (isChanging || (tenantId !== null && !tenantId)) return;
    setIsChanging(true);
    setActionError('');
    setNotice('');
    try {
      await selectTenant(tenantId);
      setSelectedId('');
      setNotice(
        tenantId
          ? 'Te uniste a la empresa correctamente.'
          : 'Saliste de la empresa. Estás en tu sesión de Desarrollador.',
      );
      if (!tenantId) setIsLoading(true);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No fue posible cambiar de empresa. Inténtalo de nuevo.',
      );
    } finally {
      setIsChanging(false);
    }
  }

  if (!user?.isDeveloper) return null;

  return (
    <Card>
      <h3 className="text-lg font-bold">Mi empresa</h3>
      {notice ? (
        <p className="mt-3 text-sm text-teal" role="status">
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {user.scope === 'tenant' && user.tenant ? (
        <div className="mt-4 grid gap-4 rounded-xl bg-beige p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal">
              Empresa activa
            </p>
            <p className="mt-1 font-semibold">{user.tenant.name}</p>
            <p className="mt-1 text-sm text-teal">
              Tienes acceso como Administrador. Puedes salir cuando quieras para
              elegir otra empresa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-teal underline"
            >
              Ir al dashboard
            </Link>
            <Button
              type="button"
              variant="secondary"
              disabled={isChanging}
              onClick={() => void changeCompany(null)}
            >
              {isChanging ? 'Saliendo…' : 'Salir de la empresa'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <p className="text-sm text-teal">
            Selecciona una empresa para unirte y trabajar en ella.
          </p>
          {isLoading ? (
            <p role="status" className="text-sm text-teal">
              Cargando empresas…
            </p>
          ) : loadError ? (
            <div>
              <p role="alert" className="mb-3 text-sm text-red-800">
                {loadError}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsLoading(true);
                  setAttempt((current) => current + 1);
                }}
              >
                Reintentar
              </Button>
            </div>
          ) : tenants.length === 0 ? (
            <p className="rounded-xl bg-beige p-4 text-sm text-teal">
              No hay empresas disponibles. Crea una empresa para poder
              seleccionarla.
            </p>
          ) : (
            <form
              className="flex flex-wrap items-end gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void changeCompany(selectedId);
              }}
            >
              <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">
                Empresa
                <select
                  className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  disabled={isChanging}
                  required
                >
                  <option value="">Selecciona una empresa</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} · NIT {tenant.nit}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={!selectedId || isChanging}>
                {isChanging ? 'Uniéndome…' : 'Unirme a la empresa'}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
