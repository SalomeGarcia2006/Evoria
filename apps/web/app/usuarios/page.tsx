'use client';

import { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { initialProfiles, loadProfiles } from '../../services/profile.service';

type User = {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: 'Activo' | 'Inactivo';
};

const initialUsers: User[] = [
  {
    id: 'ana-garcia',
    name: 'Ana García',
    email: 'ana.garcia@evoria.com',
    profile: 'Coordinadora de eventos',
    status: 'Activo',
  },
  {
    id: 'carlos-martinez',
    name: 'Carlos Martínez',
    email: 'carlos.martinez@evoria.com',
    profile: 'Gestor de recursos',
    status: 'Activo',
  },
  {
    id: 'laura-rojas',
    name: 'Laura Rojas',
    email: 'laura.rojas@evoria.com',
    profile: 'Asistente administrativa',
    status: 'Inactivo',
  },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [profiles] = useState(() => loadProfiles());
  const [form, setForm] = useState({ name: '', email: '', profile: initialProfiles[0].name });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  function openCreateForm() {
    setEditingId(null);
    setForm({ name: '', email: '', profile: profiles[0]?.name ?? '' });
    setIsFormOpen(true);
  }

  function openEditForm(user: User) {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, profile: user.profile });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setForm({ name: '', email: '', profile: profiles[0]?.name ?? '' });
  }

  function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    if (editingId) {
      setUsers((current) =>
        current.map((user) =>
          user.id === editingId
            ? { ...user, ...form, name: form.name.trim(), email: form.email.trim() }
            : user,
        ),
      );
    } else {
      setUsers((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          ...form,
          name: form.name.trim(),
          email: form.email.trim(),
          status: 'Activo',
        },
      ]);
    }
    closeForm();
  }

  function deleteUser(user: User) {
    if (window.confirm(`¿Eliminar a ${user.name}?`)) {
      setUsers((current) => current.filter((item) => item.id !== user.id));
    }
  }

  return (
    <AppShell title="Usuarios">
      <div className="grid gap-6">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal">
                Administración
              </p>
              <h2 className="mt-1 text-2xl font-bold">Usuarios del sistema</h2>
              <p className="mt-2 text-teal">
                Crea, consulta, edita y elimina usuarios. El perfil define sus
                permisos de acceso.
              </p>
            </div>
            <Button onClick={openCreateForm}>Nuevo usuario</Button>
          </div>
        </Card>

        {isFormOpen ? (
          <Card>
            <h3 className="text-xl font-bold">
              {editingId ? 'Editar usuario' : 'Crear usuario'}
            </h3>
            <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={saveUser}>
              <label className="grid gap-2 text-sm font-semibold">
                Nombre completo
                <input
                  className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                  value={form.name}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Correo electrónico
                <input
                  className="rounded-lg border border-sky-blue px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                  type="email"
                  value={form.email}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Perfil
                <select
                  className="rounded-lg border border-sky-blue bg-white px-3 py-2 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
                  onChange={(event) => setForm({ ...form, profile: event.target.value })}
                  value={form.profile}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.name}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-3 md:col-span-3">
                <Button type="submit">
                  {editingId ? 'Guardar cambios' : 'Crear usuario'}
                </Button>
                <Button onClick={closeForm} type="button" variant="secondary">
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        <Card className="p-0">
          <div className="border-b border-sky-blue px-6 py-4">
            <h3 className="font-bold">Usuarios registrados</h3>
          </div>
          <DataTable
            columns={[
              { key: 'name', header: 'Usuario', render: (user) => <span className="font-semibold">{user.name}</span> },
              { key: 'email', header: 'Correo', render: (user) => user.email },
              { key: 'profile', header: 'Perfil', render: (user) => user.profile },
              { key: 'status', header: 'Estado', render: (user) => <StatusBadge status={user.status} /> },
              {
                key: 'actions',
                header: 'Acciones',
                render: (user) => (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => openEditForm(user)} type="button" variant="secondary">
                      Editar
                    </Button>
                    <Button onClick={() => deleteUser(user)} type="button" variant="ghost">
                      Eliminar
                    </Button>
                  </div>
                ),
              },
            ]}
            rowKey={(user) => user.id}
            rows={users}
          />
        </Card>
      </div>
    </AppShell>
  );
}
