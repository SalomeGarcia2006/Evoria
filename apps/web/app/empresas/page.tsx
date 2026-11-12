'use client';

import { useRef, useState, type FormEvent } from 'react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { validateNit } from '../../lib/nit';
import {
  createTenant,
  updateTenantContext,
  type CreatedTenant,
  type TenantContextUpdate,
} from '../../services/tenants.service';
import { changeTenant } from '../../services/auth.service';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHero } from '../../components/ui/PageHero';
import { ModuleBanner } from '../../components/ui/ModuleBanner';
import panelHeadingStyles from '../../components/ui/PanelHeading.module.css';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { TenantSelector } from '../../components/tenants/TenantSelector';
import { TenantContextPanel } from '../../components/tenants/TenantContextPanel';
import { TenantFormStep } from '../../components/tenants/TenantFormStep';
import {
  TenantCreationContext,
  emptyCreationContext,
  creationContextPayload,
  validateCreationContext,
} from '../../components/tenants/TenantCreationContext';

const fieldClassName =
  'w-full rounded-xl border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

function PasswordVisibilityButton({
  visible,
  onClick,
  field,
}: {
  visible: boolean;
  onClick: () => void;
  field: string;
}) {
  const label = `${visible ? 'Ocultar' : 'Mostrar'} ${field}`;
  return (
    <button
      aria-label={label}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-teal transition hover:text-violet"
      onClick={onClick}
      title={label}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="20"
      >
        {visible ? (
          <>
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.5" />
          </>
        ) : (
          <>
            <path d="m3 3 18 18" />
            <path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3 3.8" />
            <path d="M6.2 6.2C3.6 8 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.5-.6" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </>
        )}
      </svg>
    </button>
  );
}

export default function EmpresasPage() {
  const { user, refreshSession } = useAuth();
  const feedback = useFeedback();
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [createdTenant, setCreatedTenant] = useState<CreatedTenant | null>(
    null,
  );
  const [contextDraft, setContextDraft] = useState(emptyCreationContext);
  const [pendingContext, setPendingContext] = useState<{
    tenant: CreatedTenant;
    context: TenantContextUpdate;
  } | null>(null);
  const [contextPendingNotice, setContextPendingNotice] = useState(false);
  const companyDialog = useRef<HTMLDialogElement>(null);
  const companyForm = useRef<HTMLFormElement>(null);

  function openCreateDialog() {
    setError('');
    setShowPassword(false);
    setShowConfirmation(false);
    companyForm.current?.reset();
    setContextDraft(emptyCreationContext());
    companyDialog.current?.showModal();
  }

  async function saveCreatedContext(pending: {
    tenant: CreatedTenant;
    context: TenantContextUpdate;
  }) {
    let joined = false;
    let saved = false;
    let failure: unknown;
    try {
      if (!(
        user?.scope === 'tenant' && user.tenant?.id === pending.tenant.id
      )) {
        await changeTenant(pending.tenant.id);
        joined = true;
      }
      await updateTenantContext(pending.context);
      saved = true;
    } catch (err) {
      failure = err;
      if (!joined) await refreshSession();
    }
    if (joined) {
      try {
        await changeTenant(null);
      } catch {
        await refreshSession();
        if (!saved)
          throw new Error(
            'La empresa ya fue creada, pero no se guardó el contexto. Reintenta desde la empresa activa.',
          );
      }
    }
    if (!saved) throw failure;
  }

  async function finishPending(pending: {
    tenant: CreatedTenant;
    context: TenantContextUpdate;
  }) {
    await saveCreatedContext(pending);
    setCreatedTenant(pending.tenant);
    setPendingContext(null);
    setContextPendingNotice(false);
    setContextDraft(emptyCreationContext());
    companyForm.current?.reset();
    companyDialog.current?.close();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError('');
    if (pendingContext) {
      setIsSaving(true);
      try {
        await finishPending(pendingContext);
      } catch (err) {
        setError(
          `La empresa ya fue creada, pero no se guardó el contexto: ${err instanceof Error ? err.message : 'Intenta nuevamente.'}`,
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      nit: String(formData.get('nit') ?? '').trim(),
      ownerName: String(formData.get('ownerName') ?? '').trim(),
      ownerEmail: String(formData.get('ownerEmail') ?? '').trim(),
      ownerPassword: String(formData.get('ownerPassword') ?? ''),
    };
    const confirmation = String(formData.get('confirmOwnerPassword') ?? '');
    const errors: string[] = [];
    if (!payload.name) errors.push('Ingresa el nombre de la empresa.');
    if (payload.name.length > 120)
      errors.push(
        'El nombre de la empresa no puede superar los 120 caracteres.',
      );
    const nit = validateNit(payload.nit);
    if (!nit.valid) errors.push(nit.message);
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
    if (!confirmation.trim())
      errors.push('Confirma la contraseña del propietario.');
    else if (payload.ownerPassword !== confirmation)
      errors.push('Las contraseñas no coinciden.');
    errors.push(...validateCreationContext(contextDraft));
    if (errors.length) {
      feedback.guide(
        errors.join('\n'),
        'Revisa los datos de la empresa',
        'error',
      );
      return;
    }
    if (!nit.valid) return;
    payload.nit = nit.normalized;
    setCreatedTenant(null);
    setIsSaving(true);
    try {
      const tenant = await createTenant(payload);
      const context = creationContextPayload(contextDraft);
      const pending = { tenant, context };
      setPendingContext(pending);
      try {
        await finishPending(pending);
      } catch (err) {
        setError(
          `La empresa ya fue creada, pero no se guardó el contexto: ${err instanceof Error ? err.message : 'Intenta nuevamente.'}`,
        );
      }
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

        {pendingContext &&
          user?.scope === 'tenant' &&
          user.tenant?.id === pendingContext.tenant.id && (
            <Card>
              <p role="alert" className="text-sm text-red-800">
                La empresa fue creada, pero su contexto aún no se ha guardado.
                Puedes reintentarlo desde aquí.
              </p>
              <Button
                className="mt-3"
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await finishPending(pendingContext);
                    setError('');
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'No se pudo guardar el contexto.',
                    );
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                Reintentar guardar contexto
              </Button>
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-800">
                  {error}
                </p>
              )}
            </Card>
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
                El propietario puede iniciar sesión con estas credenciales.
              </p>
              {contextPendingNotice && (
                <p className="mt-2">
                  El contexto operativo quedó pendiente de completar.
                </p>
              )}
            </div>
          </Card>
        ) : null}

        {user?.scope === 'platform' && user.isDeveloper ? (
          <PermissionGate permission="empresas.crear">
            <dialog
              aria-labelledby="company-dialog-title"
              className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-3xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
              ref={companyDialog}
              onCancel={(event) => {
                if (isSaving || pendingContext) event.preventDefault();
              }}
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
                  disabled={isSaving || !!pendingContext}
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
                <fieldset
                  disabled={isSaving || !!pendingContext}
                  className="contents"
                >
                  <TenantFormStep number={1} title="Datos de la empresa" />
                  <label className="grid gap-2 text-sm font-semibold">
                    Nombre de la empresa
                    <input
                      autoComplete="organization"
                      className={fieldClassName}
                      minLength={1}
                      name="name"
                      onChange={(event) => {
                        const input = event.currentTarget;
                        if (input.value.length <= 120) return;
                        input.value = input.value.slice(0, 120);
                        feedback.guide(
                          'El nombre de la empresa admite hasta 120 caracteres, de acuerdo con el límite del sistema.',
                          'Límite de caracteres',
                          'error',
                        );
                      }}
                      placeholder="Ej. Eventos Andinos"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    NIT
                    <input
                      className={fieldClassName}
                      maxLength={21}
                      placeholder="Ej. 860324218-1"
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
                      placeholder="Ej. Ana García"
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
                      placeholder="Ej. ana@ejemplo.com"
                      required
                      type="email"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Contraseña inicial del propietario
                    <span className="relative block">
                      <input
                        autoComplete="new-password"
                        className={`${fieldClassName} pr-12`}
                        minLength={8}
                        maxLength={12}
                        name="ownerPassword"
                        placeholder="Entre 8 y 12 caracteres"
                        required
                        type={showPassword ? 'text' : 'password'}
                      />
                      <PasswordVisibilityButton
                        field="contraseña del propietario"
                        onClick={() => setShowPassword(!showPassword)}
                        visible={showPassword}
                      />
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Confirmar contraseña del propietario
                    <span className="relative block">
                      <input
                        autoComplete="new-password"
                        className={`${fieldClassName} pr-12`}
                        minLength={8}
                        maxLength={12}
                        name="confirmOwnerPassword"
                        placeholder="Repite la contraseña"
                        required
                        type={showConfirmation ? 'text' : 'password'}
                      />
                      <PasswordVisibilityButton
                        field="confirmación de contraseña"
                        onClick={() => setShowConfirmation(!showConfirmation)}
                        visible={showConfirmation}
                      />
                    </span>
                  </label>
                  <TenantCreationContext
                    value={contextDraft}
                    onChange={setContextDraft}
                  />
                </fieldset>
                <div className="flex flex-wrap gap-3 pt-5 sm:col-span-2">
                  <Button disabled={isSaving} type="submit">
                    {isSaving
                      ? 'Guardando…'
                      : pendingContext
                        ? 'Reintentar guardar contexto'
                        : 'Crear empresa'}
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() => {
                      if (pendingContext) {
                        setCreatedTenant(pendingContext.tenant);
                        setContextPendingNotice(true);
                        setPendingContext(null);
                        setContextDraft(emptyCreationContext());
                        setError('');
                      }
                      companyDialog.current?.close();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {pendingContext ? 'Completar contexto después' : 'Cancelar'}
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
