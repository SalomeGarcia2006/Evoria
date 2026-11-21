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

type TenantCreationStep = 1 | 2 | 3;

const tenantCreationSteps: { number: TenantCreationStep; title: string }[] = [
  { number: 1, title: 'Datos de la empresa' },
  { number: 2, title: 'Contexto operativo' },
  { number: 3, title: 'Información adicional' },
];

function validateCompanyDetails(form: HTMLFormElement): string[] {
  const formData = new FormData(form);
  const name = String(formData.get('name') ?? '').trim();
  const nit = String(formData.get('nit') ?? '').trim();
  const ownerName = String(formData.get('ownerName') ?? '').trim();
  const ownerEmail = String(formData.get('ownerEmail') ?? '').trim();
  const ownerPassword = String(formData.get('ownerPassword') ?? '');
  const confirmation = String(formData.get('confirmOwnerPassword') ?? '');
  const emailInput = form.elements.namedItem(
    'ownerEmail',
  ) as HTMLInputElement | null;
  const errors: string[] = [];

  if (!name) errors.push('Ingresa el nombre de la empresa.');
  if (name.length > 120)
    errors.push('El nombre de la empresa no puede superar los 120 caracteres.');
  const nitValidation = validateNit(nit);
  if (!nitValidation.valid) errors.push(nitValidation.message);
  if (ownerName.length < 2)
    errors.push('Ingresa el nombre del propietario con al menos 2 caracteres.');
  if (!ownerEmail || emailInput?.validity.typeMismatch)
    errors.push('Ingresa un correo válido para el propietario.');
  if (
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/.test(
      ownerPassword,
    )
  )
    errors.push(
      'La contraseña debe tener entre 8 y 128 caracteres, una minúscula, una mayúscula, un número y un carácter especial.',
    );
  if (!confirmation.trim())
    errors.push('Confirma la contraseña del propietario.');
  else if (ownerPassword !== confirmation)
    errors.push('Las contraseñas no coinciden.');

  return errors;
}

export default function EmpresasPage() {
  const { user, refreshSession } = useAuth();
  const feedback = useFeedback();
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeStep, setActiveStep] = useState<TenantCreationStep>(1);
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
  const [preserveCreateDraft, setPreserveCreateDraft] = useState(false);
  const companyDialog = useRef<HTMLDialogElement>(null);
  const companyForm = useRef<HTMLFormElement>(null);

  function openCreateDialog() {
    setError('');
    setShowPassword(false);
    setShowConfirmation(false);
    if (pendingContext || preserveCreateDraft) {
      if (pendingContext) setActiveStep(3);
    } else {
      setActiveStep(1);
      companyForm.current?.reset();
      setContextDraft(emptyCreationContext());
    }
    companyDialog.current?.showModal();
  }

  function showSubmissionWarning(
    failure: unknown,
    contextAlreadyCreated: boolean,
  ) {
    const detail =
      failure instanceof Error && failure.message
        ? `\n\nDetalle: ${failure.message}`
        : '';
    const message = contextAlreadyCreated
      ? 'La empresa sí se creó, pero no se guardó su contexto operativo. La sesión seguía vinculada a otra empresa en otro navegador y no se pudo completar el cambio de contexto. Los datos se conservaron; no vuelvas a crear la empresa. Sal de la otra empresa y luego pulsa «Reintentar guardar contexto».'
      : 'No se pudo crear la empresa. Si tu sesión sigue vinculada a otra empresa en otro navegador, sal de esa empresa y vuelve a intentarlo. Los datos ingresados se conservaron en este formulario.';

    feedback.guide(
      `${message}${detail}`,
      contextAlreadyCreated
        ? 'Contexto operativo pendiente'
        : 'No se pudo crear la empresa',
      'warning',
    );
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
    setPreserveCreateDraft(false);
    setContextDraft(emptyCreationContext());
    companyForm.current?.reset();
    companyDialog.current?.close();
  }

  function advanceStep() {
    if (activeStep === 3 || isSaving || pendingContext) return;
    setError('');
    setActiveStep((activeStep + 1) as TenantCreationStep);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError('');
    if (activeStep < 3) {
      advanceStep();
      return;
    }
    if (pendingContext) {
      setIsSaving(true);
      try {
        await finishPending(pendingContext);
      } catch (err) {
        setPreserveCreateDraft(true);
        showSubmissionWarning(err, true);
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
    const companyErrors = validateCompanyDetails(form);
    const contextErrors = validateCreationContext(contextDraft);
    const nit = validateNit(payload.nit);
    if (companyErrors.length || contextErrors.length) {
      setActiveStep(companyErrors.length ? 1 : 2);
      feedback.guide(
        [...companyErrors, ...contextErrors].join('\n'),
        companyErrors.length
          ? 'Revisa los datos de la empresa'
          : 'Completa el contexto operativo',
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
      setCreatedTenant(tenant);
      setPendingContext(pending);
      setContextPendingNotice(true);
      try {
        await finishPending(pending);
      } catch (err) {
        setPreserveCreateDraft(true);
        showSubmissionWarning(err, true);
      }
    } catch (submitError) {
      setPreserveCreateDraft(true);
      showSubmissionWarning(submitError, false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell hideTitle title="Empresas">
      <div className="grid min-w-0 gap-6">
        <FeedbackMessages feedback={feedback} />
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
        {!(
          user?.scope === 'tenant' &&
          (user.isDeveloper ||
            user.role.trim().toLocaleLowerCase('es') === 'administrador')
        ) && (
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
        )}

        <TenantSelector
          revision={createdTenant?.id}
          createdTenant={createdTenant}
        />
        {user?.scope === 'tenant' && (
          <TenantContextPanel key={user.tenant?.id} />
        )}

        {pendingContext && (
          <Card>
            <p role="alert" className="text-sm text-red-800">
              La empresa fue creada, pero su contexto operativo está pendiente.
              Los datos ingresados se conservaron y puedes reintentar guardarlos
              desde aquí.
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
                  showSubmissionWarning(err, true);
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
                <ol
                  aria-label="Pasos para crear una empresa"
                  className="grid grid-cols-3 gap-2 sm:col-span-2"
                >
                  {tenantCreationSteps.map(({ number, title }) => {
                    const isCurrent = activeStep === number;
                    const isComplete = activeStep > number;
                    return (
                      <li
                        aria-current={isCurrent ? 'step' : undefined}
                        className="min-w-0"
                        key={number}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                              isCurrent || isComplete
                                ? 'bg-violet text-white'
                                : 'bg-sky-blue/50 text-muted'
                            }`}
                          >
                            {number}
                          </span>
                          <span
                            className={`text-xs leading-tight sm:text-sm ${
                              isCurrent
                                ? 'font-bold text-navy'
                                : 'font-medium text-muted'
                            }`}
                          >
                            {title}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
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
                  <section
                    aria-label="Paso 1: Datos de la empresa"
                    className="grid gap-4 sm:col-span-2 sm:grid-cols-2"
                    style={{ display: activeStep === 1 ? 'grid' : 'none' }}
                  >
                    <label className="grid gap-2 text-sm font-semibold">
                      Nombre de la empresa
                      <input
                        autoComplete="organization"
                        className={fieldClassName}
                        minLength={1}
                        name="name"
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
                          maxLength={128}
                          name="ownerPassword"
                          placeholder="8 a 128 caracteres, con mayúscula, número y símbolo"
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
                          maxLength={128}
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
                  </section>
                  <section
                    aria-label="Paso 2: Contexto operativo"
                    className="sm:col-span-2"
                    style={{ display: activeStep === 2 ? 'block' : 'none' }}
                  >
                    <TenantCreationContext
                      step={2}
                      value={contextDraft}
                      onChange={setContextDraft}
                    />
                  </section>
                  <section
                    aria-label="Paso 3: Información adicional"
                    className="sm:col-span-2"
                    style={{ display: activeStep === 3 ? 'block' : 'none' }}
                  >
                    <TenantCreationContext
                      step={3}
                      value={contextDraft}
                      onChange={setContextDraft}
                    />
                  </section>
                </fieldset>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-blue pt-4 sm:col-span-2">
                  <Button
                    disabled={isSaving}
                    onClick={() => {
                      if (pendingContext) {
                        setCreatedTenant(pendingContext.tenant);
                        setContextPendingNotice(true);
                        setPreserveCreateDraft(true);
                      }
                      companyDialog.current?.close();
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {pendingContext ? 'Completar contexto después' : 'Cancelar'}
                  </Button>
                  <div className="flex flex-wrap justify-end gap-3">
                    {activeStep > 1 ? (
                      <Button
                        disabled={isSaving || !!pendingContext}
                        onClick={() =>
                          setActiveStep((activeStep - 1) as TenantCreationStep)
                        }
                        type="button"
                        variant="secondary"
                      >
                        Anterior
                      </Button>
                    ) : null}
                    {activeStep < 3 ? (
                      <Button
                        disabled={isSaving || !!pendingContext}
                        onClick={advanceStep}
                        type="button"
                      >
                        Siguiente
                      </Button>
                    ) : (
                      <Button disabled={isSaving} type="submit">
                        {isSaving
                          ? 'Creando empresa…'
                          : pendingContext
                            ? 'Reintentar guardar contexto'
                            : 'Crear empresa'}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </dialog>
          </PermissionGate>
        ) : null}
      </div>
    </AppShell>
  );
}
