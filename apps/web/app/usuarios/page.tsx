'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { useAuth } from '../../hooks/useAuth';
import {
  deactivateUser,
  createUser,
  getUserProfiles,
  getUsers,
  updateUser,
  type CompanyUser,
  type UserProfileOption,
} from '../../services/users.service';

function PasswordVisibilityButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-teal transition hover:text-violet"
      onClick={onClick}
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

export default function UsuariosPage() {
  const { can } = useAuth();
  const feedback = useFeedback();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [profiles, setProfiles] = useState<UserProfileOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const userDialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    profileId: '',
    status: 'activo' as 'activo' | 'inactivo',
  });
  const passwordsDoNotMatch =
    !editing && confirmPassword.length > 0 && form.password !== confirmPassword;

  const loadData = useCallback(() => {
    return Promise.all([
      getUsers(),
      can('usuarios.crear') ? getUserProfiles() : Promise.resolve([]),
    ])
      .then(([userItems, profileItems]) => {
        setUsers(userItems);
        setProfiles(profileItems);
        setError('');
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar los usuarios.',
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [can]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateForm() {
    setEditing(null);
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      name: '',
      email: '',
      password: '',
      profileId: profiles[0]?.id ?? '',
      status: 'activo',
    });
    userDialog.current?.showModal();
  }

  function openEditForm(user: CompanyUser) {
    setEditing(user);
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      profileId: user.profile.id,
      status: user.status,
    });
    userDialog.current?.showModal();
  }

  function closeForm() {
    userDialog.current?.close();
    setEditing(null);
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.dismiss();

    if (!editing && form.password !== confirmPassword) {
      return;
    }

    setIsSaving(true);
    try {
      const saved = editing
        ? await updateUser(editing.id, {
            profileId: form.profileId,
            status: form.status,
          })
        : await createUser({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            profileId: form.profileId,
          });
      setUsers((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      closeForm();
      feedback.notify(
        editing
          ? 'Usuario actualizado correctamente.'
          : 'Usuario creado correctamente.',
      );
    } catch (saveError) {
      feedback.notify(
        saveError instanceof Error
          ? saveError.message
          : 'No fue posible guardar el usuario.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivate(user: CompanyUser) {
    const confirmed = await feedback.confirm(
      '¿Vas a desactivar este usuario?',
      `El usuario “${user.name}” perderá el acceso a la plataforma hasta que se active nuevamente.`,
      'Sí, desactivar usuario',
      'warning',
      'CANCELAR',
    );
    if (!confirmed) return;
    setError('');
    try {
      const saved = await deactivateUser(user.id);
      setUsers((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'No fue posible desactivar el usuario.',
      );
    }
  }

  return (
    <AppShell title="Usuarios">
      <div className="grid gap-6">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Administración
              </p>
              <h2 className="mt-1 text-2xl font-bold">Usuarios del sistema</h2>
              <p className="mt-2 text-muted">
                Crea, consulta, edita y desactiva usuarios. El perfil define sus
                permisos de acceso.
              </p>
            </div>
            <PermissionGate permission="usuarios.crear">
              <Button onClick={openCreateForm} type="button">
                Nuevo usuario
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

        <dialog
          aria-labelledby="user-dialog-title"
          className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-4xl overflow-y-auto rounded-2xl border border-sky-blue bg-white p-0 text-navy shadow-2xl backdrop:bg-navy/60"
          onClose={() => setEditing(null)}
          ref={userDialog}
        >
          <div className="flex items-start justify-between gap-4 border-b border-sky-blue p-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">
                Usuarios
              </p>
              <h2 className="mt-1 text-2xl font-bold" id="user-dialog-title">
                {editing ? 'Editar usuario' : 'Crear usuario'}
              </h2>
            </div>
            <Button
              aria-label="Cerrar formulario"
              className="px-3 text-xl leading-none"
              onClick={closeForm}
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </div>
          <form className="grid gap-4 p-6 md:grid-cols-3" onSubmit={saveUser}>
            <label className="grid gap-2 text-sm font-semibold">
              Nombre completo
              <input
                className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                readOnly={Boolean(editing)}
                required
                value={form.name}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Correo electrónico
              <input
                className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                readOnly={Boolean(editing)}
                required
                type="email"
                value={form.email}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Perfil
              <select
                className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                onChange={(event) =>
                  setForm({ ...form, profileId: event.target.value })
                }
                required
                value={form.profileId}
              >
                {editing &&
                !profiles.some(
                  (profile) => profile.id === editing.profile.id,
                ) ? (
                  <option value={editing.profile.id}>
                    {editing.profile.name}
                  </option>
                ) : null}
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            {editing ? (
              <label className="grid gap-2 text-sm font-semibold">
                Estado
                <select
                  className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as 'activo' | 'inactivo',
                    })
                  }
                  value={form.status}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  Contraseña inicial
                  <span className="relative block">
                    <input
                      aria-invalid={passwordsDoNotMatch}
                      className={`w-full rounded-lg border px-3 py-2 pr-11 font-normal outline-none focus:ring-2 ${passwordsDoNotMatch ? 'border-red-700 focus:border-red-700 focus:ring-red-100' : 'border-sky-blue focus:border-teal focus:ring-sky-blue'}`}
                      minLength={8}
                      onChange={(event) =>
                        setForm({ ...form, password: event.target.value })
                      }
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                    />
                    <PasswordVisibilityButton
                      onClick={() => setShowPassword((current) => !current)}
                      visible={showPassword}
                    />
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Repite la contraseña
                  <span className="relative block">
                    <input
                      aria-describedby={
                        passwordsDoNotMatch
                          ? 'password-confirmation-error'
                          : undefined
                      }
                      aria-invalid={passwordsDoNotMatch}
                      className={`w-full rounded-lg border px-3 py-2 pr-11 font-normal outline-none focus:ring-2 ${passwordsDoNotMatch ? 'border-red-700 focus:border-red-700 focus:ring-red-100' : 'border-sky-blue focus:border-teal focus:ring-sky-blue'}`}
                      minLength={8}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                    />
                    <PasswordVisibilityButton
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      visible={showConfirmPassword}
                    />
                  </span>
                  {passwordsDoNotMatch ? (
                    <span
                      className="text-xs font-medium text-red-800"
                      id="password-confirmation-error"
                      role="alert"
                    >
                      Las contraseñas no coinciden.
                    </span>
                  ) : null}
                </label>
              </>
            )}
            <div className="flex gap-3 border-t border-sky-blue pt-5 md:col-span-3">
              <PermissionGate
                permission={editing ? 'usuarios.editar' : 'usuarios.crear'}
              >
                <Button disabled={isSaving} type="submit">
                  {isSaving
                    ? 'Guardando…'
                    : editing
                      ? 'Guardar cambios'
                      : 'Crear usuario'}
                </Button>
              </PermissionGate>
              <Button onClick={closeForm} type="button" variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
        </dialog>

        <Card className="p-0">
          <div className="border-b border-sky-blue px-6 py-4">
            <h3 className="font-bold">Usuarios registrados</h3>
          </div>
          {isLoading ? (
            <p className="p-6 text-sm text-muted">Cargando usuarios…</p>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Usuario',
                  render: (user) => (
                    <span className="font-semibold">{user.name}</span>
                  ),
                },
                {
                  key: 'email',
                  header: 'Correo',
                  render: (user) => user.email,
                },
                {
                  key: 'profile',
                  header: 'Perfil',
                  render: (user) => user.profile.name,
                },
                {
                  key: 'status',
                  header: 'Estado',
                  render: (user) => (
                    <StatusBadge
                      status={user.status === 'activo' ? 'Activo' : 'Inactivo'}
                    />
                  ),
                },
                {
                  key: 'actions',
                  header: 'Acciones',
                  render: (user) => (
                    <div className="flex flex-wrap gap-2">
                      {can('usuarios.editar') ? (
                        <Button
                          onClick={() => openEditForm(user)}
                          type="button"
                          variant="secondary"
                        >
                          Editar
                        </Button>
                      ) : null}
                      {can('usuarios.desactivar') &&
                      user.status === 'activo' ? (
                        <Button
                          onClick={() => void deactivate(user)}
                          type="button"
                          variant="ghost"
                        >
                          Desactivar
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              rowKey={(user) => user.id}
              rows={users}
            />
          )}
        </Card>
        <FeedbackMessages feedback={feedback} />
      </div>
    </AppShell>
  );
}
