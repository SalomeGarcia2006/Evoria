'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
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

function userInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('es') ?? '')
    .join('');
}

function UserMetricIcon({
  type,
}: {
  type: 'total' | 'active' | 'inactive' | 'pending';
}) {
  const common = {
    'aria-hidden': true as const,
    className: 'size-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  if (type === 'active') {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (type === 'inactive') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  if (type === 'pending') {
    return (
      <svg {...common}>
        <path d="M12 3 3.8 7.5v4.2c0 4.7 3.3 8.1 8.2 9.3 4.9-1.2 8.2-4.6 8.2-9.3V7.5L12 3Z" />
        <path d="M12 8v4l2.5 1.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 8v6m3-3h-6" />
    </svg>
  );
}

export default function UsuariosPage() {
  const { can } = useAuth();
  const feedback = useFeedback();
  const notify = feedback.notify;
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [profiles, setProfiles] = useState<UserProfileOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const userMetrics = [
    {
      label: 'Usuarios registrados',
      value: users.length,
      type: 'total' as const,
      tone: 'bg-violet/15 text-violet',
    },
    {
      label: 'Usuarios activos',
      value: users.filter((user) => user.status === 'activo').length,
      type: 'active' as const,
      tone: 'bg-teal/15 text-teal',
    },
    {
      label: 'Usuarios inactivos',
      value: users.filter((user) => user.status === 'inactivo').length,
      type: 'inactive' as const,
      tone: 'bg-sky-blue/70 text-muted',
    },
    {
      label: 'Pendientes de perfil',
      value: users.filter((user) => !user.profile).length,
      type: 'pending' as const,
      tone: 'bg-violet/10 text-violet',
    },
  ];

  const loadData = useCallback(() => {
    return Promise.all([
      getUsers(),
      can('usuarios.editar') ? getUserProfiles() : Promise.resolve([]),
    ])
      .then(([userItems, profileItems]) => {
        setUsers(userItems);
        setProfiles(profileItems);
      })
      .catch((loadError: unknown) => {
        notify(
          loadError instanceof Error
            ? loadError.message
            : 'No fue posible cargar los usuarios.',
          'error',
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [can, notify]);

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
      profileId: user.profile?.id ?? '',
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

    const invalidControl = Array.from(event.currentTarget.elements).find(
      (control): control is HTMLInputElement | HTMLSelectElement =>
        (control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement) &&
        !control.validity.valid,
    );
    if (invalidControl) {
      const fieldName = invalidControl.labels?.[0]?.textContent
        ?.replace('*', '')
        .trim();
      const message = invalidControl.validity.valueMissing
        ? `Completa el campo ${fieldName ? `“${fieldName}”` : 'obligatorio'}.`
        : invalidControl.validity.typeMismatch
          ? 'Ingresa un correo electrónico válido.'
          : invalidControl.validity.tooShort
            ? `La contraseña debe tener al menos ${invalidControl instanceof HTMLInputElement ? invalidControl.minLength : 0} caracteres.`
            : 'Revisa los datos ingresados.';
      feedback.notify(message, 'error');
      return;
    }

    if (!editing && form.password !== confirmPassword) {
      feedback.notify('Las contraseñas no coinciden.', 'error');
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
    try {
      const saved = await deactivateUser(user.id);
      setUsers((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (deactivateError) {
      feedback.notify(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'No fue posible desactivar el usuario.',
        'error',
      );
    }
  }

  return (
    <AppShell title="Usuarios">
      <div className="grid min-w-0 gap-5">
        <Card className="relative overflow-hidden border-sky-blue bg-[var(--evoria-surface)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet/15 text-violet ring-1 ring-violet/20">
                <UserMetricIcon type="total" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-violet">
                  Administración de acceso
                </p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Usuarios
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted sm:text-base">
                  Administra las cuentas, sus perfiles y el acceso a la empresa.
                </p>
              </div>
            </div>
            <PermissionGate permission="usuarios.crear">
              <Button
                className="shrink-0 self-start sm:self-auto"
                onClick={openCreateForm}
                type="button"
              >
                <span aria-hidden="true" className="mr-1 text-lg leading-none">
                  ＋
                </span>
                Nuevo usuario
              </Button>
            </PermissionGate>
          </div>
        </Card>
        <section
          aria-label="Resumen de usuarios"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {userMetrics.map((metric) => (
            <article
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-sky-blue bg-[var(--evoria-surface)] p-4 shadow-sm"
              key={metric.label}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${metric.tone}`}
              >
                <UserMetricIcon type={metric.type} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted">{metric.label}</p>
                <p className="mt-0.5 text-2xl font-bold leading-none">
                  {isLoading ? '—' : metric.value}
                </p>
              </div>
            </article>
          ))}
        </section>

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
          <form
            className="grid gap-4 p-6 md:grid-cols-3"
            noValidate
            onSubmit={saveUser}
          >
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
                editing.profile &&
                !profiles.some(
                  (profile) => profile.id === editing.profile?.id,
                ) ? (
                  <option value={editing.profile.id}>
                    {editing.profile.name}
                  </option>
                ) : null}
                {!form.profileId ? (
                  <option value="">Pendiente de asignación</option>
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

        <Card
          className="min-w-0 overflow-hidden p-0"
          data-tour="users-list-card"
        >
          <div className="flex flex-col gap-2 border-b border-sky-blue bg-[var(--evoria-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-lg font-bold">Listado de usuarios</h3>
                <span className="rounded-full bg-violet/15 px-3 py-1 text-xs font-semibold text-violet">
                  {users.length} {users.length === 1 ? 'cuenta' : 'cuentas'}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Consulta el perfil y el estado de acceso de cada cuenta.
              </p>
            </div>
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
                    <div className="flex min-w-52 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet to-fuchsia-600 text-xs font-bold text-white shadow-sm">
                        {userInitials(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--evoria-ink)]">
                          {user.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Cuenta de empresa
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'email',
                  header: 'Correo',
                  render: (user) => (
                    <span className="whitespace-nowrap text-muted">
                      {user.email}
                    </span>
                  ),
                },
                {
                  key: 'profile',
                  header: 'Perfil',
                  render: (user) =>
                    user.profile?.name ? (
                      <span className="inline-flex max-w-48 items-center rounded-full border border-sky-blue bg-[var(--evoria-bg)] px-3 py-1 text-xs font-semibold text-muted">
                        <span className="truncate">{user.profile.name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-sky-blue bg-[var(--evoria-bg)] px-3 py-1 text-xs font-medium text-muted">
                        Pendiente de asignación
                      </span>
                    ),
                },
                {
                  key: 'status',
                  header: 'Estado',
                  render: (user) => {
                    const isActive = user.status === 'activo';
                    return (
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? 'border-teal/20 bg-teal/10 text-teal' : 'border-sky-blue bg-[var(--evoria-bg)] text-muted'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${isActive ? 'bg-teal' : 'bg-muted'}`}
                        />
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    );
                  },
                },
                {
                  key: 'actions',
                  header: 'Acciones',
                  render: (user) => (
                    <div className="flex flex-wrap gap-2">
                      {can('usuarios.editar') ? (
                        <Button
                          data-tour="user-edit-action"
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
                          data-tour="user-deactivate-action"
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
