'use client';

import { useState, type FormEvent } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../hooks/useAuth';
import {
  createTenant,
  type CreatedTenant,
} from '../../services/tenants.service';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const fieldClassName =
  'rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export default function EmpresasPage() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdTenant, setCreatedTenant] = useState<CreatedTenant | null>(
    null,
  );

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
        <header>
          <p className="text-sm font-semibold uppercase tracking-[.16em] text-teal">
            Administración de plataforma
          </p>
          <h2 className="mt-2 text-3xl font-bold">Empresas</h2>
          <p className="mt-1 text-teal">
            Registra una empresa y crea su cuenta propietaria con perfil
            Administrador.
          </p>
        </header>

        <Card>
          <h3 className="text-lg font-bold">Contexto de empresa</h3>
          {user?.scope === 'tenant' && user.tenant ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-beige p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-teal">
                  Empresa activa
                </p>
                <p className="mt-1 font-semibold">{user.tenant.name}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-teal">
                {user.tenant.slug}
              </span>
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-beige p-4 text-sm leading-6 text-teal">
              Tu sesión de Desarrollador es de plataforma y no tiene una empresa
              activa. La API actual permite crear empresas, pero todavía no
              ofrece operaciones para listar empresas o cambiar el contexto de
              sesión.
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-teal">
            El selector de empresa y el cambio de empresa activa requieren
            endpoints de consulta y selección de membresía que aún no están
            disponibles para el frontend.
          </p>
        </Card>

        <Card>
          <div className="mb-5">
            <h3 className="text-lg font-bold">Crear empresa</h3>
            <p className="mt-1 text-sm text-teal">
              El backend también crea el perfil Administrador y vincula al
              propietario.
            </p>
          </div>

          {createdTenant ? (
            <div
              className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
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
          ) : null}

          {error ? (
            <p
              className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
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
            <div className="sm:col-span-2">
              <Button disabled={isSaving} type="submit">
                {isSaving ? 'Creando empresa…' : 'Crear empresa'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
