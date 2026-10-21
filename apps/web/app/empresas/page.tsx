'use client';

import { useRef, useState, type FormEvent } from 'react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../hooks/useAuth';
import {
  createTenant,
  type CreatedTenant,
} from '../../services/tenants.service';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TenantSelector } from '../../components/tenants/TenantSelector';

const fieldClassName =
  'rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export default function EmpresasPage() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdTenant, setCreatedTenant] = useState<CreatedTenant | null>(
    null,
  );
  const companyDialog = useRef<HTMLDialogElement>(null);
  const companyForm = useRef<HTMLFormElement>(null);

  function openCreateDialog() {
    setError('');
    companyForm.current?.reset();
    companyDialog.current?.showModal();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCreatedTenant(null);
    setIsSaving(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const tenant = await createTenant({
        name: String(formData.get('name') ?? '').trim(),
        nit: String(formData.get('nit') ?? '').trim(),
        ownerName: String(formData.get('ownerName') ?? '').trim(),
        ownerEmail: String(formData.get('ownerEmail') ?? '').trim(),
        ownerPassword: String(formData.get('ownerPassword') ?? ''),
      });
      setCreatedTenant(tenant);
      form.reset();
      companyDialog.current?.close();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No fue posible crear la empresa. Inténtalo de nuevo.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell title="Empresas">
      <div className="grid gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
              Administración de plataforma
            </p>
            <h2 className="mt-2 text-3xl font-bold">Empresas</h2>
            <p className="mt-1 text-teal">
              {user?.scope === 'tenant'
                ? 'Consulta tu empresa activa o sal para volver a la plataforma.'
                : 'Selecciona una empresa para trabajar en ella o registra una nueva.'}
            </p>
          </div>
          {user?.scope === 'platform' && user.isDeveloper ? (
            <PermissionGate permission="empresas.crear">
              <Button onClick={openCreateDialog} type="button">
                + Nueva empresa
              </Button>
            </PermissionGate>
          ) : null}
        </header>

        <TenantSelector revision={createdTenant?.id} />

        {createdTenant ? (
          <Card>
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
              role="status"
            >
              <p className="font-semibold">Empresa creada correctamente</p>
              <p className="mt-1">
                {createdTenant.name} · NIT {createdTenant.nit}
              </p>
              <p className="mt-1">
                Cuenta propietaria: {createdTenant.administrator.name} (
                {createdTenant.administrator.email}).
              </p>
              <p className="mt-2">
                El propietario puede iniciar sesión con estas credenciales. Tu
                sesión de Desarrollador permanece en el contexto de plataforma.
              </p>
            </div>
          </Card>
        ) : null}

        {user?.scope === 'platform' && user.isDeveloper ? (
          <PermissionGate permission="empresas.crear">
            <dialog
              aria-labelledby="company-dialog-title"
              className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
              ref={companyDialog}
            >
              <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
                    Administración de plataforma
                  </p>
                  <h2
                    className="mt-1 text-2xl font-bold"
                    id="company-dialog-title"
                  >
                    Crear empresa
                  </h2>
                  <p className="mt-1 text-sm text-teal">
                    También se creará el perfil Administrador y la cuenta
                    propietaria.
                  </p>
                </div>
                <Button
                  aria-label="Cerrar formulario"
                  className="px-3 text-xl leading-none"
                  onClick={() => companyDialog.current?.close()}
                  type="button"
                  variant="ghost"
                >
                  ×
                </Button>
              </div>

              <form
                className="grid gap-4 p-6 sm:grid-cols-2"
                onSubmit={handleSubmit}
                ref={companyForm}
              >
                {error ? (
                  <p
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <label className="grid gap-2 text-sm font-semibold">
                  Nombre de la empresa
                  <input
                    autoComplete="organization"
                    className={fieldClassName}
                    maxLength={120}
                    minLength={2}
                    name="name"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  NIT
                  <input
                    className={fieldClassName}
                    maxLength={30}
                    minLength={3}
                    name="nit"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Nombre del propietario
                  <input
                    autoComplete="name"
                    className={fieldClassName}
                    maxLength={120}
                    minLength={2}
                    name="ownerName"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Correo del propietario
                  <input
                    autoComplete="email"
                    className={fieldClassName}
                    maxLength={150}
                    name="ownerEmail"
                    required
                    type="email"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                  Contraseña inicial del propietario
                  <input
                    autoComplete="new-password"
                    className={`${fieldClassName} sm:max-w-md`}
                    minLength={8}
                    name="ownerPassword"
                    required
                    type="password"
                  />
                  <span className="font-normal text-teal">
                    Mínimo 8 caracteres. Compártela de forma segura con el
                    propietario.
                  </span>
                </label>
                <div className="flex flex-wrap gap-3 border-t border-sky-blue pt-5 sm:col-span-2">
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? 'Creando empresa…' : 'Crear empresa'}
                  </Button>
                  <Button
                    onClick={() => companyDialog.current?.close()}
                    type="button"
                    variant="secondary"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </dialog>
          </PermissionGate>
        ) : null}
      </div>
    </AppShell>
  );
}
