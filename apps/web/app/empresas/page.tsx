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
import { PageHero } from '../../components/ui/PageHero';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import panelHeadingStyles from '../../components/ui/PanelHeading.module.css';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { TenantSelector } from '../../components/tenants/TenantSelector';
import { TenantContextPanel } from '../../components/tenants/TenantContextPanel';

const fieldClassName =
  'w-full rounded-xl border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export default function EmpresasPage() {
  const { user } = useAuth();
  const feedback = useFeedback();
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
    if (isSaving) return;
    setError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      nit: String(formData.get('nit') ?? '').trim(),
      ownerName: String(formData.get('ownerName') ?? '').trim(),
      ownerEmail: String(formData.get('ownerEmail') ?? '').trim(),
      ownerPassword: String(formData.get('ownerPassword') ?? ''),
    };
    const errors: string[] = [];
    if (!payload.name) errors.push('Ingresa el nombre de la empresa.');
    if (payload.nit.length !== 9)
      errors.push('Ingresa un NIT de 9 caracteres.');
    if (payload.ownerName.length < 2)
      errors.push(
        'Ingresa el nombre del propietario con al menos 2 caracteres.',
      );
    const emailInput = form.elements.namedItem(
      'ownerEmail',
    ) as HTMLInputElement | null;
    if (!payload.ownerEmail || emailInput?.validity.typeMismatch)
      errors.push('Ingresa un correo válido para el propietario.');
    if (
      !payload.ownerPassword.trim() ||
      payload.ownerPassword.length < 8 ||
      payload.ownerPassword.length > 12
    )
      errors.push('Ingresa una contraseña de entre 8 y 12 caracteres.');
    if (errors.length) {
      feedback.guide(
        errors.join('\n'),
        'Revisa los datos de la empresa',
        'error',
      );
      return;
    }
    setCreatedTenant(null);
    setIsSaving(true);
    try {
      const tenant = await createTenant(payload);
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
    <AppShell hideTitle title="Empresas">
      <div className="grid min-w-0 gap-6">
        <PageHero
          title="Empresas"
          description={
            user?.scope === 'tenant'
              ? 'Consulta y administra el contexto operativo de tu empresa.'
              : 'Selecciona una empresa para trabajar en ella o registra una nueva.'
          }
          actions={
            user?.scope === 'platform' && user.isDeveloper ? (
              <PermissionGate permission="empresas.crear">
                <Button onClick={openCreateDialog} type="button">
                  + Nueva empresa
                </Button>
              </PermissionGate>
            ) : null
          }
        />
        <ModuleBanner
          icon="empresas.svg"
          title={
            user?.scope === 'tenant'
              ? 'Tu empresa en Evoria'
              : 'Administra tus empresas'
          }
          description={
            user?.scope === 'tenant'
              ? 'Conoce y organiza la información de tu operación.'
              : 'Crea empresas y selecciona el espacio en el que deseas trabajar.'
          }
        />

        <TenantSelector revision={createdTenant?.id} />
        {user?.scope === 'tenant' && (
          <TenantContextPanel key={user.tenant?.id} />
        )}

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
              <FeedbackMessages feedback={feedback} />
              <div
                className={`flex items-start justify-between gap-4 border-b border-sky-blue p-6 ${panelHeadingStyles.heading}`}
              >
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
                    Administración de plataforma
                  </p>
                  <h2
                    className="mt-1 text-2xl font-bold"
                    id="company-dialog-title"
                  >
                    Crear empresa
                  </h2>
                  <p className="mt-1 text-sm text-muted">
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
                noValidate
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
                    minLength={1}
                    name="name"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  NIT
                  <input
                    className={fieldClassName}
                    maxLength={9}
                    minLength={9}
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
                    maxLength={12}
                    name="ownerPassword"
                    required
                    type="password"
                  />
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
