'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PermissionGate } from '../../components/auth/PermissionGate';
import {
  createProfile as createApiProfile,
  getPermissionModules,
  getProfiles,
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

  const visibleModules = permissionModules.filter((module) =>
    module.name.toLowerCase().includes(moduleSearch.toLowerCase()),
  );

  async function createProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProfileName.trim();
    if (
      !name ||
      profiles.some(
        (profile) => profile.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;

    setIsSaving(true);
    setError('');
    try {
      const profile = await createApiProfile({
        name,
        description: `Perfil ${name}`,
        permissionKeys: newProfilePermissionKeys,
      });
      setProfiles((current) => [...current, profile]);
      setNewProfileName('');
      setNewProfilePermissionKeys([]);
      profileDialog.current?.close();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No fue posible crear el perfil.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell title="Perfiles">
      <div className="grid gap-6">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Control de acceso
              </p>
              <h2 className="mt-1 text-2xl font-bold">Perfiles del sistema</h2>
              <p className="mt-2 text-muted">
                Crea perfiles y asigna permisos para cada módulo.
              </p>
            </div>
            <PermissionGate permission="perfiles.crear">
              <Button onClick={openCreateForm} type="button">
                Crear perfil
              </Button>
            </PermissionGate>
          </div>
        </Card>
        {error ? (
          <p
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <PermissionGate permission="perfiles.crear">
          <dialog
            aria-labelledby="profile-dialog-title"
            className="m-auto h-[calc(100dvh-2rem)] w-11/12 max-w-7xl flex-col overflow-hidden rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60 open:flex"
            ref={profileDialog}
          >
            <div className="shrink-0 flex flex-col gap-1 border-b border-sky-blue p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted">Nuevo perfil</p>
                <h2 className="text-2xl font-bold" id="profile-dialog-title">
                  Configura sus permisos
                </h2>
              </div>
              <Button
                aria-label="Cerrar formulario"
                className="px-3 text-xl leading-none"
                onClick={() => profileDialog.current?.close()}
                type="button"
                variant="ghost"
              >
                ×
              </Button>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col p-8"
              onSubmit={createProfile}
            >
              <label className="grid max-w-md shrink-0 gap-2 text-sm font-semibold">
                Nombre del perfil
                <input
                  aria-label="Nombre del nuevo perfil"
                  className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Ej. Gestor de eventos"
                  required
                  value={newProfileName}
                />
              </label>
              <section className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-sky-blue">
                <div className="flex flex-col gap-4 border-b border-sky-blue px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold">Módulos del sistema</h3>
                    <p className="text-xs text-muted">
                      Activa o desactiva los permisos según el rol o perfil.
                    </p>
                  </div>
                  <label className="relative block">
                    <span className="sr-only">Buscar módulo</span>
                    <input
                      className="w-full rounded-lg border border-sky-blue bg-white py-2 pl-3 pr-9 text-sm font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue sm:w-44"
                      onChange={(event) => setModuleSearch(event.target.value)}
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
                  {isSaving ? 'Guardando…' : 'Guardar perfil'}
                </Button>
                <Button
                  onClick={() => profileDialog.current?.close()}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </dialog>
        </PermissionGate>

        <Card className="p-0">
          <div className="border-b border-sky-blue px-6 py-4">
            <h3 className="font-bold">Perfiles registrados</h3>
          </div>
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Perfil',
                render: (profile) => (
                  <span className="font-semibold">{profile.name}</span>
                ),
              },
              {
                key: 'permissions',
                header: 'Permisos configurados',
                render: (profile) => `${profile.permissions.length} permisos`,
              },
              {
                key: 'status',
                header: 'Estado',
                render: (profile) => (
                  <StatusBadge
                    status={profile.status === 'activo' ? 'Activo' : 'Inactivo'}
                  />
                ),
              },
            ]}
            rowKey={(profile) => profile.id}
            rows={profiles}
          />
        </Card>
      </div>
    </AppShell>
  );
}
