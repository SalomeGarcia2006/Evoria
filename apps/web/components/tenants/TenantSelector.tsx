'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  deactivateTenant,
  getTenants,
  type TenantOption,
} from '../../services/tenants.service';
import { ConfirmProviderAction } from '../providers/ConfirmProviderAction';
import { Button } from '../ui/Button';
import panelHeadingStyles from '../ui/PanelHeading.module.css';
import tenantCardStyles from './TenantCards.module.css';

export function TenantSelector({ revision }: { revision?: string }) {
  const { user, selectTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);
  const [changingTenantId, setChangingTenantId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [deactivating, setDeactivating] = useState<TenantOption | null>(null);
  const isPlatform = user?.scope === 'platform';

  useEffect(() => {
    if (!isPlatform || !user?.isDeveloper) return;
    let active = true;
    getTenants()
      .then((items) => {
        if (!active) return;
        setTenants(items.filter((item) => item.status === 'activo'));
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
    setChangingTenantId(tenantId);
    setActionError('');
    setNotice('');
    try {
      await selectTenant(tenantId);
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
      setChangingTenantId(null);
    }
  }

  if (!user?.isDeveloper) return null;

  return (
    <section className="module-panel" aria-label="Mi empresa">
      <div className={`module-panel__heading ${panelHeadingStyles.heading}`}>
        <h2 className="text-xl font-bold">Mi empresa</h2>
        <p className="mt-1 text-sm text-muted">
          Consulta o selecciona la empresa en la que vas a trabajar.
        </p>
      </div>
      <div className="module-panel__content">
        {notice ? (
          <p className="mt-3 text-sm text-muted" role="status">
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
          <div className={tenantCardStyles.card}>
            <div className={tenantCardStyles.identity}>
              <span className={tenantCardStyles.monogram} aria-hidden="true">
                {user.tenant.name.trim().charAt(0).toLocaleUpperCase('es-CO')}
              </span>
              <div className="min-w-0">
                <p className={tenantCardStyles.name}>{user.tenant.name}</p>
                <span className={tenantCardStyles.status}>Empresa activa</span>
              </div>
            </div>
            <div className={tenantCardStyles.details}>
              <p className="mt-1 text-sm text-muted">
                Tienes acceso como Administrador. Puedes salir cuando quieras
                para elegir otra empresa.
              </p>
            </div>
            <div className={`${tenantCardStyles.actions} items-center`}>
              <Link
                href="/dashboard"
                className={tenantCardStyles.dashboardLink}
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
            {isLoading ? (
              <p role="status" className="text-sm text-muted">
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
              <p className="rounded-xl bg-beige p-4 text-sm text-muted">
                No hay empresas disponibles. Crea una empresa para poder
                seleccionarla.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tenants.map((tenant) => (
                  <article
                    key={tenant.id}
                    aria-label={`Empresa ${tenant.name}`}
                    className={tenantCardStyles.card}
                  >
                    <div className={tenantCardStyles.identity}>
                      <span
                        className={tenantCardStyles.monogram}
                        aria-hidden="true"
                      >
                        {tenant.name
                          .trim()
                          .charAt(0)
                          .toLocaleUpperCase('es-CO')}
                      </span>
                      <div className="min-w-0">
                        <h3 className={tenantCardStyles.name}>{tenant.name}</h3>
                        <span className={tenantCardStyles.status}>Activa</span>
                      </div>
                    </div>
                    <dl className={tenantCardStyles.details}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                        NIT
                      </dt>
                      <dd className="mt-1 break-all text-sm font-semibold">
                        {tenant.nit}
                      </dd>
                    </dl>
                    <div className={tenantCardStyles.actions}>
                      {user.permissions.includes('empresas.desactivar') && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isChanging}
                          aria-label={`Desactivar ${tenant.name}`}
                          onClick={() => setDeactivating(tenant)}
                        >
                          Desactivar
                        </Button>
                      )}
                      <Button
                        type="button"
                        disabled={isChanging}
                        aria-label={`Unirme a ${tenant.name}`}
                        onClick={() => void changeCompany(tenant.id)}
                      >
                        {changingTenantId === tenant.id
                          ? 'Uniéndome…'
                          : 'Unirme a la empresa'}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {deactivating && (
          <ConfirmProviderAction
            title="Desactivar empresa"
            description={`¿Desactivar ${deactivating.name}? Sus usuarios no podrán acceder a la empresa y no podrá seleccionarse. No hay una opción de reactivación disponible en la aplicación.`}
            confirmationText="DESACTIVAR"
            action={() => deactivateTenant(deactivating.id)}
            onClose={() => setDeactivating(null)}
            onSaved={() => {
              setNotice('La empresa se desactivó correctamente.');
              setDeactivating(null);
              setIsLoading(true);
              setAttempt((value) => value + 1);
            }}
          />
        )}
      </div>
    </section>
  );
}
