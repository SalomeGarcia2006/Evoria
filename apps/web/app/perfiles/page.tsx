'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { useAuth } from '../../hooks/useAuth';
import {
  createProfile as createApiProfile,
  getPermissionModules,
  getProfiles,
  updateProfile as updateApiProfile,
  type ApiProfile,
  type PermissionModule,
} from '../../services/profiles-api.service';

const iconByModuleKey: Record<string, string> = {
  alertas: 'alerta.svg',
  asignaciones: 'recursos.svg',
  auditoria: 'auditoria.svg',
  cronogramas: 'cronograma.svg',
  dashboard: 'dashboard.svg',
  empresas: 'empresas.svg',
  eventos: 'eventos.svg',
  inventario: 'inventario.svg',
  perfiles: 'perfil.svg',
  presupuestos: 'presupuesto.svg',
  proveedores: 'provedores.svg',
  recursos: 'recursos.svg',
  reportes: 'reporte.svg',
  servicios_proveedor: 'provedores.svg',
  usuarios: 'usuarios.svg',
};

function PermissionSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        aria-label={label}
        checked={checked}
        className="peer sr-only"
        onChange={onChange}
        type="checkbox"
      />
      <span className="h-6 w-11 rounded-full bg-sky-blue transition peer-checked:bg-teal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy" />
      <span className="pointer-events-none absolute left-1 size-4 rounded-full bg-white transition peer-checked:translate-x-5" />
    </label>
  );
}

export default function PerfilesPage() {
  const { can } = useAuth();
  const feedback = useFeedback();
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [permissionModules, setPermissionModules] = useState<
    PermissionModule[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const profileDialog = useRef<HTMLDialogElement>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [newProfilePermissionKeys, setNewProfilePermissionKeys] = useState<
    string[]
  >([]);
  const [editingProfile, setEditingProfile] = useState<ApiProfile | null>(null);

  useEffect(() => {
    Promise.all([getProfiles(), getPermissionModules()])
      .then(([apiProfiles, modules]) => {
        setProfiles(apiProfiles);
        setPermissionModules(modules);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar perfiles y permisos.',
        ),
      );
  }, []);

  function openCreateForm() {
    setEditingProfile(null);
    setNewProfileName('');
    setModuleSearch('');
    setNewProfilePermissionKeys(
      permissionModules.flatMap((module) =>
        module.permissions
          .filter((permission) => permission.action === 'ver')
          .map((permission) => permission.key),
      ),
    );
    profileDialog.current?.showModal();
  }

  function openEditForm(profile: ApiProfile) {
    setEditingProfile(profile);
    setNewProfileName(profile.name);
    setModuleSearch('');
    setNewProfilePermissionKeys(
      profile.permissions.map((permission) => permission.key),
    );
    profileDialog.current?.showModal();
  }

  function closeProfileDialog() {
    profileDialog.current?.close();
    setEditingProfile(null);
  }

  const visibleModules = permissionModules.filter((module) =>
    module.name.toLowerCase().includes(moduleSearch.toLowerCase()),
  );
  const allPermissionKeys = permissionModules.flatMap((module) =>
    module.permissions.map((permission) => permission.key),
  );
  const allPermissionsSelected =
    allPermissionKeys.length > 0 &&
    allPermissionKeys.every((key) => newProfilePermissionKeys.includes(key));

  function toggleAllPermissions() {
    setNewProfilePermissionKeys(
      allPermissionsSelected ? [] : allPermissionKeys,
    );
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProfileName.trim();
    const missingFields = [
      !name ? 'nombre del perfil' : '',
      newProfilePermissionKeys.length === 0 ? 'al menos un permiso' : '',
    ].filter(Boolean);

    if (missingFields.length) {
      feedback.guide(
        `Falta completar: ${missingFields.join(' y ')}.`,
        'Campos obligatorios',
        'warning',
      );
      return;
    }

    if (
      profiles.some(
        (profile) =>
          profile.id !== editingProfile?.id &&
          profile.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;

    setIsSaving(true);
    setError('');
    try {
      const profile = editingProfile
        ? await updateApiProfile(editingProfile.id, {
            name,
            permissionKeys: newProfilePermissionKeys,
          })
        : await createApiProfile({
            name,
            description: `Perfil ${name}`,
            permissionKeys: newProfilePermissionKeys,
          });
      setProfiles((current) =>
        editingProfile
          ? current.map((item) => (item.id === profile.id ? profile : item))
          : [...current, profile],
      );
      setNewProfileName('');
      setNewProfilePermissionKeys([]);
      closeProfileDialog();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `No fue posible ${editingProfile ? 'editar' : 'crear'} el perfil.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell hideTitle title="Perfiles">
      <div className="grid gap-6">
        <header className="events-hero">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-violet">
              Control de acceso
            </p>
            <h1 className="mt-1 text-4xl font-bold">Perfiles</h1>
            <p className="mt-2 max-w-xl text-base text-muted">
              Define los permisos que necesita cada equipo para trabajar.
            </p>
          </div>
          <PermissionGate permission="perfiles.crear">
            <Button onClick={openCreateForm} type="button">
              + Nuevo perfil
            </Button>
          </PermissionGate>
        </header>

        <section className="events-banner">
          <span className="events-banner__icon" aria-hidden="true">
            <Image
              alt=""
              className="brightness-0"
              height={24}
              src="/icons/perfil.svg"
              width={24}
            />
          </span>
          <div>
            <h2 className="text-xl font-bold">Permisos claros para cada rol</h2>
            <p className="mt-1 text-sm text-muted">
              Crea, consulta y ajusta los accesos de los perfiles de tu empresa.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-4 p-5" density="compact">
            <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-violet to-[#9B87FF] shadow-[0_10px_20px_rgba(106,76,255,0.2)]">
              <Image
                alt=""
                aria-hidden="true"
                className="brightness-0 invert"
                height={23}
                src="/icons/perfil.svg"
                width={23}
              />
            </span>
            <div>
              <p className="text-sm text-muted">Perfiles registrados</p>
              <p className="font-display text-3xl font-bold">
                {profiles.length}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-5" density="compact">
            <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-teal to-[#5BE0D2] shadow-[0_10px_20px_rgba(18,181,166,0.2)]">
              <Image
                alt=""
                aria-hidden="true"
                className="brightness-0 invert"
                height={23}
                src="/icons/usuarios.svg"
                width={23}
              />
            </span>
            <div>
              <p className="text-sm text-muted">Perfiles activos</p>
              <p className="font-display text-3xl font-bold">
                {
                  profiles.filter((profile) => profile.status === 'activo')
                    .length
                }
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-5" density="compact">
            <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-coral to-amber shadow-[0_10px_20px_rgba(255,93,115,0.2)]">
              <Image
                alt=""
                aria-hidden="true"
                className="brightness-0 invert"
                height={23}
                src="/icons/alerta.svg"
                width={23}
              />
            </span>
            <div>
              <p className="text-sm text-muted">Permisos asignados</p>
              <p className="font-display text-3xl font-bold">
                {profiles.reduce(
                  (total, profile) => total + profile.permissions.length,
                  0,
                )}
              </p>
            </div>
          </Card>
        </section>
        {error ? (
          <p
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {can('perfiles.crear') || can('perfiles.editar') ? (
          <dialog
            aria-labelledby="profile-dialog-title"
            className="m-auto h-[calc(100dvh-2rem)] w-11/12 max-w-7xl flex-col overflow-hidden rounded-[1.75rem] border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60 open:flex"
            ref={profileDialog}
          >
            <div className="shrink-0 flex flex-col gap-4 border-b border-sky-blue bg-linear-to-r from-violet/10 via-white to-teal/10 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.16em] text-violet">
                  {editingProfile ? 'Editar perfil' : 'Nuevo perfil'}
                </p>
                <h2
                  className="mt-1 text-2xl font-bold"
                  id="profile-dialog-title"
                >
                  {editingProfile
                    ? 'Actualiza sus permisos'
                    : 'Configura sus permisos'}
                </h2>
              </div>
              <Button
                aria-label="Cerrar formulario"
                className="px-3 text-xl leading-none"
                onClick={closeProfileDialog}
                type="button"
                variant="ghost"
              >
                ×
              </Button>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col p-8"
              noValidate
              onSubmit={saveProfile}
            >
              <label className="grid max-w-md shrink-0 gap-2 text-sm font-semibold">
                Nombre del perfil
                <input
                  aria-label="Nombre del perfil"
                  className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Ej. Gestor de eventos"
                  required
                  value={newProfileName}
                />
              </label>
              <section className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-sky-blue bg-beige/45">
                <div className="flex flex-col gap-4 border-b border-sky-blue px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold">Módulos del sistema</h3>
                    <p className="text-xs text-muted">
                      Activa o desactiva los permisos según el rol o perfil.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Todos los permisos
                        </p>
                        <p className="text-xs text-muted">
                          Activar o desactivar todos
                        </p>
                      </div>
                      <PermissionSwitch
                        checked={allPermissionsSelected}
                        label="Seleccionar o quitar todos los permisos"
                        onChange={toggleAllPermissions}
                      />
                    </div>
                    <label className="relative block">
                      <span className="sr-only">Buscar módulo</span>
                      <input
                        className="w-full rounded-lg border border-sky-blue bg-white py-2 pl-3 pr-9 text-sm font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue sm:w-44"
                        onChange={(event) =>
                          setModuleSearch(event.target.value)
                        }
                        placeholder="Buscar módulo..."
                        type="search"
                        value={moduleSearch}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                      >
                        ⌕
                      </span>
                    </label>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="min-w-[720px]">
                    <div className="grid grid-cols-[minmax(16rem,1fr)_minmax(32rem,2fr)] bg-beige">
                      <div className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                        Módulo
                      </div>
                      <div className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-muted">
                        Permisos
                      </div>
                    </div>
                    {visibleModules.map((module, index) => (
                      <div
                        className={`grid grid-cols-[minmax(16rem,1fr)_minmax(32rem,2fr)] items-center border-t border-sky-blue/60 ${index % 2 === 0 ? 'bg-white' : 'bg-beige/40'}`}
                        key={module.key}
                      >
                        <div className="flex items-center gap-4 px-6 py-4">
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy">
                            <Image
                              alt=""
                              aria-hidden="true"
                              height={22}
                              src={`/icons/${iconByModuleKey[module.key] ?? 'perfil.svg'}`}
                              width={22}
                            />
                          </span>
                          <h4 className="font-semibold">{module.name}</h4>
                        </div>
                        <div className="grid grid-cols-4 gap-3 px-6 py-4">
                          {module.permissions.map((permission) => (
                            <div
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-sky-blue/60 bg-white/70 px-3 py-2"
                              key={permission.key}
                            >
                              <span className="truncate text-sm font-semibold">
                                {permission.name}
                              </span>
                              <PermissionSwitch
                                checked={newProfilePermissionKeys.includes(
                                  permission.key,
                                )}
                                label={`${permission.name} en ${module.name}`}
                                onChange={() =>
                                  setNewProfilePermissionKeys((current) =>
                                    current.includes(permission.key)
                                      ? current.filter(
                                          (key) => key !== permission.key,
                                        )
                                      : [...current, permission.key],
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {visibleModules.length === 0 ? (
                      <p className="p-5 text-center text-sm text-muted">
                        No se encontraron módulos.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
              <div className="mt-5 flex shrink-0 gap-3 border-t border-sky-blue pt-5">
                <Button disabled={isSaving} type="submit">
                  {isSaving
                    ? 'Guardando…'
                    : editingProfile
                      ? 'Guardar cambios'
                      : 'Guardar perfil'}
                </Button>
                <Button
                  onClick={closeProfileDialog}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </dialog>
        ) : null}

        <section className="events-list-panel p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Perfiles registrados</h2>
              <p className="mt-1 text-sm text-muted">
                Consulta los accesos configurados para cada perfil.
              </p>
            </div>
            <span className="w-fit rounded-full bg-violet/10 px-3 py-1 text-sm font-semibold text-violet">
              {profiles.length} {profiles.length === 1 ? 'perfil' : 'perfiles'}
            </span>
          </div>

          {profiles.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {profiles.map((profile) => (
                <Card
                  className="group flex min-h-52 flex-col border-violet/15 p-5 transition hover:-translate-y-0.5 hover:border-violet/35"
                  density="compact"
                  key={profile.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-2xl bg-violet/10">
                      <Image
                        alt=""
                        aria-hidden="true"
                        className="brightness-0"
                        height={22}
                        src="/icons/perfil.svg"
                        width={22}
                      />
                    </span>
                    <StatusBadge
                      status={
                        profile.status === 'activo' ? 'Activo' : 'Inactivo'
                      }
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted">
                      {profile.isSystem
                        ? 'Perfil del sistema'
                        : 'Perfil personalizado'}
                    </p>
                    <h3 className="mt-1 text-2xl font-bold">{profile.name}</h3>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-sky-blue pt-4">
                    <div>
                      <p className="text-xs text-muted">
                        Permisos configurados
                      </p>
                      <p className="mt-1 font-display text-xl font-bold">
                        {profile.permissions.length}{' '}
                        <span className="font-sans text-sm font-medium text-muted">
                          permisos
                        </span>
                      </p>
                    </div>
                    {can('perfiles.editar') && !profile.isSystem ? (
                      <Button
                        className="px-3 py-2 text-xs"
                        onClick={() => openEditForm(profile)}
                        type="button"
                        variant="secondary"
                      >
                        Editar perfil
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-muted">
                        {profile.isSystem ? 'Protegido' : 'Solo consulta'}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-[1.25rem] border border-dashed border-sky-blue bg-white p-6 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet/10">
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="brightness-0"
                    height={24}
                    src="/icons/perfil.svg"
                    width={24}
                  />
                </span>
                <h3 className="mt-3 text-lg font-bold">Aún no hay perfiles</h3>
                <p className="mt-1 text-sm text-muted">
                  Crea un perfil para organizar los permisos de tu equipo.
                </p>
              </div>
            </div>
          )}
        </section>
        <FeedbackMessages feedback={feedback} />
      </div>
    </AppShell>
  );
}
