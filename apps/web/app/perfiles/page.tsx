'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PermissionGate } from '../../components/auth/PermissionGate';
import {
  ACTIONS,
  createPermissions,
  MODULES,
  type Profile,
  type Permissions as ProfilePermissions,
} from '../../services/profile.service';
import {
  createProfile as createApiProfile,
  getPermissionModules,
  getProfiles,
  type ApiProfile,
  type PermissionModule,
} from '../../services/profiles-api.service';

function uiModuleKey(name: string) {
  const moduleKeys = [
    'eventos',
    'recursos',
    'inventario',
    'presupuestos',
    'cronogramas',
    'alertas',
    'reportes',
    'auditoria',
  ];
  return moduleKeys[MODULES.indexOf(name)] ?? name.toLowerCase();
}

function toUiProfile(profile: ApiProfile): Profile {
  const permissions = createPermissions();
  for (const permission of profile.permissions) {
    const moduleName = MODULES.find(
      (name) => uiModuleKey(name) === permission.moduleKey,
    );
    if (!moduleName) continue;
    const action =
      permission.action === 'ajustar'
        ? 'Editar'
        : permission.action === 'desactivar'
          ? 'Eliminar'
          : (
              {
                crear: 'Crear',
                editar: 'Editar',
                ver: 'Ver',
                eliminar: 'Eliminar',
              } as Record<string, (typeof ACTIONS)[number]>
            )[permission.action];
    if (action) permissions[moduleName][action] = true;
  }
  return {
    id: profile.id,
    name: profile.name,
    status: profile.status === 'activo' ? 'Activo' : 'Inactivo',
    permissions,
  };
}

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
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-sky-blue px-3 py-2.5 transition hover:bg-beige">
      <span className="text-sm font-medium">{label}</span>
      <span className="relative inline-flex items-center">
        <input
          aria-label={label}
          checked={checked}
          className="peer sr-only"
          onChange={onChange}
          type="checkbox"
        />
        <span className="h-6 w-11 rounded-full bg-sky-blue transition peer-checked:bg-teal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy" />
        <span className="pointer-events-none absolute left-1 size-4 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function PerfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissionModules, setPermissionModules] = useState<
    PermissionModule[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePermissions, setNewProfilePermissions] =
    useState<ProfilePermissions>(createPermissions);

  useEffect(() => {
    Promise.all([getProfiles(), getPermissionModules()])
      .then(([apiProfiles, modules]) => {
        setProfiles(apiProfiles.map(toUiProfile));
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
    setNewProfilePermissions(createPermissions());
    setIsCreating(true);
  }

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

    const permissionKeys = permissionModules.flatMap((module) => {
      const uiName = MODULES.find((item) => uiModuleKey(item) === module.key);
      if (!uiName) return [];
      return module.permissions
        .filter((permission) => {
          const action =
            permission.action === 'ajustar'
              ? 'Editar'
              : permission.action === 'desactivar'
                ? 'Eliminar'
                : (
                    {
                      crear: 'Crear',
                      editar: 'Editar',
                      ver: 'Ver',
                      eliminar: 'Eliminar',
                    } as Record<string, (typeof ACTIONS)[number]>
                  )[permission.action];
          return action ? newProfilePermissions[uiName][action] : false;
        })
        .map((permission) => permission.key);
    });
    setIsSaving(true);
    setError('');
    try {
      const profile = await createApiProfile({
        name,
        description: `Perfil ${name}`,
        permissionKeys,
      });
      setProfiles((current) => [...current, toUiProfile(profile)]);
      setNewProfileName('');
      setNewProfilePermissions(createPermissions());
      setIsCreating(false);
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
              <p className="text-sm font-semibold uppercase tracking-wide text-teal">
                Control de acceso
              </p>
              <h2 className="mt-1 text-2xl font-bold">Perfiles del sistema</h2>
              <p className="mt-2 text-teal">
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

        {isCreating ? (
          <PermissionGate permission="perfiles.crear">
            <Card>
              <div className="flex flex-col gap-1 border-b border-sky-blue pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-teal">Nuevo perfil</p>
                  <h3 className="text-xl font-bold">Configura sus permisos</h3>
                </div>
                <Button
                  onClick={() => setIsCreating(false)}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              </div>
              <form className="mt-5" onSubmit={createProfile}>
                <label className="grid max-w-md gap-2 text-sm font-semibold">
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
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {MODULES.map((moduleName) => (
                    <section
                      className="rounded-xl border border-sky-blue bg-beige/50 p-4"
                      key={moduleName}
                    >
                      <h4 className="mb-3 font-bold">{moduleName}</h4>
                      <div className="grid gap-2">
                        {ACTIONS.map((action) => (
                          <PermissionSwitch
                            checked={newProfilePermissions[moduleName][action]}
                            key={`${moduleName}-${action}`}
                            label={action}
                            onChange={() =>
                              setNewProfilePermissions((current) => ({
                                ...current,
                                [moduleName]: {
                                  ...current[moduleName],
                                  [action]: !current[moduleName][action],
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-5">
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? 'Guardando…' : 'Guardar perfil'}
                  </Button>
                </div>
              </form>
            </Card>
          </PermissionGate>
        ) : null}

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
                render: (profile) =>
                  `${Object.values(profile.permissions).flatMap((modulePermissions) => Object.values(modulePermissions).filter(Boolean)).length} permisos`,
              },
              {
                key: 'status',
                header: 'Estado',
                render: (profile) => <StatusBadge status={profile.status} />,
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
