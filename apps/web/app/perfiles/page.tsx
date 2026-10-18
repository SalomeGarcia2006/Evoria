'use client';

import { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PermissionGate } from '../../components/auth/PermissionGate';
import {
  ACTIONS,
  createPermissions,
  loadProfiles,
  MODULES,
  saveProfiles,
  type Profile,
  type Permissions as ProfilePermissions,
} from '../../services/profile.service';

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
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles());
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePermissions, setNewProfilePermissions] =
    useState<ProfilePermissions>(createPermissions);

  function updateProfiles(nextProfiles: Profile[]) {
    setProfiles(nextProfiles);
    saveProfiles(nextProfiles);
  }

  function openCreateForm() {
    setNewProfileName('');
    setNewProfilePermissions(createPermissions());
    setIsCreating(true);
  }

  function createProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProfileName.trim();
    if (
      !name ||
      profiles.some(
        (profile) => profile.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;

    const profile: Profile = {
      id: `profile-${Date.now()}`,
      name,
      status: 'Activo',
      permissions: newProfilePermissions,
    };
    updateProfiles([...profiles, profile]);
    setNewProfileName('');
    setNewProfilePermissions(createPermissions());
    setIsCreating(false);
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
                  <Button type="submit">Guardar perfil</Button>
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
