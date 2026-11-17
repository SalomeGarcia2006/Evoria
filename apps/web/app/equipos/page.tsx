'use client';

import { useEffect, useMemo, useState } from 'react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { FeedbackMessages, useFeedback } from '../../components/ui/Feedback';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../hooks/useAuth';
import { getUsers, type CompanyUser } from '../../services/users.service';
import {
  createTeam,
  deactivateTeam,
  getTeamSpecialties,
  getTeams,
  type Team,
} from '../../services/teams.service';

const field =
  'rounded-lg border border-sky-blue bg-white px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue';

export default function EquiposPage() {
  const { can } = useAuth();
  const feedback = useFeedback();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === 'activo'),
    [users],
  );

  async function load() {
    try {
      const [teamItems, userItems, specialtyItems] = await Promise.all([
        getTeams(),
        can('usuarios.ver') ? getUsers() : Promise.resolve([]),
        getTeamSpecialties(),
      ]);
      setTeams(teamItems);
      setUsers(userItems);
      setSpecialties(specialtyItems);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible cargar los equipos.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // The loader uses the current permission checker to request readable data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedSpecialty = specialty.trim().replace(/\s+/g, ' ');
    if (normalizedName.length < 2 || normalizedName.length > 120)
      return setError('El nombre debe tener entre 2 y 120 caracteres.');
    if (normalizedSpecialty.length < 2 || normalizedSpecialty.length > 100)
      return setError('La especialidad debe tener entre 2 y 100 caracteres.');
    if (!memberIds.length)
      return setError('Selecciona al menos un integrante.');
    if (memberIds.length > 200)
      return setError('Un equipo admite hasta 200 integrantes.');
    if (!leaderId || !memberIds.includes(leaderId))
      return setError(
        'El líder debe pertenecer a los integrantes seleccionados.',
      );
    setSaving(true);
    setError(null);
    try {
      await createTeam({
        name: normalizedName,
        specialty: normalizedSpecialty,
        memberIds,
        leaderId,
      });
      setName('');
      setSpecialty('');
      setMemberIds([]);
      setLeaderId('');
      await load();
      feedback.notify('Equipo creado correctamente.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible crear el equipo.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function deactivate(team: Team) {
    const confirmed = await feedback.confirm(
      '¿Desactivar equipo?',
      `“${team.name}” no podrá reactivarse desde la plataforma.`,
      'Sí, desactivar',
      'warning',
      'DESACTIVAR',
    );
    if (!confirmed) return;
    try {
      await deactivateTeam(team.id);
      await load();
      feedback.notify('Equipo desactivado correctamente.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible desactivar el equipo.',
      );
    }
  }

  return (
    <AppShell hideTitle title="Equipos">
      <div className="grid gap-6">
        <header className="events-hero">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-violet">
              Operación colaborativa
            </p>
            <h1 className="mt-1 text-4xl font-bold">Equipos de trabajo</h1>
            <p className="mt-2 text-muted">
              Organiza integrantes, especialidades y liderazgo para las
              actividades.
            </p>
          </div>
        </header>
        {error ? <ErrorMessage message={error} /> : null}
        <FeedbackMessages feedback={feedback} />
        <PermissionGate permission="equipos.crear">
          <form
            className="grid gap-4 rounded-[1.375rem] border border-sky-blue bg-white p-6 shadow-sm md:grid-cols-2"
            onSubmit={submit}
          >
            <h2 className="text-xl font-bold md:col-span-2">Crear equipo</h2>
            <label className="grid gap-2 text-sm font-semibold">
              Nombre
              <input
                className={field}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Especialidad
              <input
                className={field}
                list="team-specialties"
                maxLength={100}
                onChange={(e) => setSpecialty(e.target.value)}
                required
                value={specialty}
              />
              <datalist id="team-specialties">
                {specialties.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <fieldset className="grid gap-2 text-sm font-semibold md:col-span-2">
              <legend>Integrantes</legend>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-sky-blue p-3 sm:grid-cols-2">
                {activeUsers.map((person) => (
                  <label className="flex items-center gap-2" key={person.id}>
                    <input
                      checked={memberIds.includes(person.id)}
                      onChange={(e) =>
                        setMemberIds((current) =>
                          e.target.checked
                            ? [...current, person.id]
                            : current.filter((id) => id !== person.id),
                        )
                      }
                      type="checkbox"
                    />
                    {person.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">
              Líder
              <select
                className={field}
                disabled={!memberIds.length}
                onChange={(e) => setLeaderId(e.target.value)}
                required
                value={leaderId}
              >
                <option value="">Selecciona un líder</option>
                {activeUsers
                  .filter((person) => memberIds.includes(person.id))
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <Button disabled={saving || !can('usuarios.ver')} type="submit">
                {saving ? 'Guardando…' : 'Crear equipo'}
              </Button>
              {!can('usuarios.ver') ? (
                <p className="mt-2 text-sm text-muted">
                  Necesitas permiso para ver usuarios y seleccionar integrantes.
                </p>
              ) : null}
            </div>
          </form>
        </PermissionGate>
        {loading ? (
          <LoadingState label="Cargando equipos…" />
        ) : (
          <section className="events-list-panel">
            <div className="events-list-panel__toolbar">
              <h2 className="text-2xl font-bold">Equipos registrados</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Especialidad</th>
                    <th>Integrantes</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <td className="font-semibold">{team.name}</td>
                      <td>{team.specialty}</td>
                      <td>{team.memberIds.length}</td>
                      <td>{team.status}</td>
                      <td className="text-right">
                        {can('equipos.desactivar') &&
                        team.status === 'activo' ? (
                          <Button
                            className="px-3 py-1 text-xs"
                            onClick={() => void deactivate(team)}
                            type="button"
                            variant="secondary"
                          >
                            Desactivar
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
