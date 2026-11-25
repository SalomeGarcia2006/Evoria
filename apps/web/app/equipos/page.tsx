'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  updateTeam,
  type Team,
} from '../../services/teams.service';

const PAGE_SIZE = 5;
const field =
  'min-w-0 w-full rounded-xl border border-sky-blue bg-[var(--evoria-bg)] px-3 py-2.5 text-[var(--evoria-ink)] outline-none placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/20';

type TeamStatusFilter = 'todos' | 'activo' | 'inactivo';
type TeamFormErrors = {
  name?: string;
  specialty?: string;
  members?: string;
  leader?: string;
};
type IconName =
  | 'teams'
  | 'check'
  | 'clock'
  | 'users'
  | 'search'
  | 'filter'
  | 'edit'
  | 'more'
  | 'layers'
  | 'crown';

function Icon({
  name,
  className = 'size-5',
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    'aria-hidden': true as const,
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'teams':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...common}>
          <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common}>
          <path d="m15 5 4 4M4 20l4-.8L19 8a2.12 2.12 0 0 0-3-3L5 16l-1 4Z" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      );
    case 'crown':
      return (
        <svg {...common}>
          <path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z" />
          <path d="M5 17h14" />
        </svg>
      );
  }
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('es') ?? '')
    .join('');
}

export default function EquiposPage() {
  const { can } = useAuth();
  const feedback = useFeedback();
  const teamDialog = useRef<HTMLDialogElement>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TeamFormErrors>({});
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('todos');
  const [page, setPage] = useState(1);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === 'activo'),
    [users],
  );
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const activeTeams = teams.filter((team) => team.status === 'activo');
  const activeTeamByMember = new Map<string, Team>();
  activeTeams.forEach((team) => {
    if (team.id === editingTeam?.id) return;
    team.memberIds.forEach((id) => activeTeamByMember.set(id, team));
  });
  const totalMembers = new Set(activeTeams.flatMap((team) => team.memberIds))
    .size;
  const filteredMembers = activeUsers.filter((person) =>
    `${person.name} ${person.email}`
      .toLocaleLowerCase('es')
      .includes(memberSearch.trim().toLocaleLowerCase('es')),
  );
  const specialtyOptions = editingTeam?.specialty
    ? [...new Set([...specialties, editingTeam.specialty])]
    : specialties;
  const filteredTeams = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return teams.filter((team) => {
      if (statusFilter !== 'todos' && team.status !== statusFilter)
        return false;
      const leader = usersById.get(team.leaderId)?.name ?? '';
      const memberNames = team.memberIds
        .map((id) => usersById.get(id)?.name ?? '')
        .join(' ');
      return `${team.name} ${team.specialty} ${leader} ${memberNames}`
        .toLocaleLowerCase('es')
        .includes(query);
    });
  }, [teams, search, statusFilter, usersById]);
  const pageCount = Math.max(1, Math.ceil(filteredTeams.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleTeams = filteredTeams.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can]);

  function resetForm() {
    setEditingTeam(null);
    setName('');
    setSpecialty('');
    setMemberIds([]);
    setLeaderId('');
    setMemberSearch('');
    setFieldErrors({});
  }

  function openCreateModal() {
    resetForm();
    teamDialog.current?.showModal();
  }

  function openEditModal(team: Team) {
    setEditingTeam(team);
    setName(team.name);
    setSpecialty(team.specialty);
    setMemberIds(team.memberIds);
    setLeaderId(team.leaderId);
    setMemberSearch('');
    setFieldErrors({});
    teamDialog.current?.showModal();
  }

  function closeModal() {
    if (saving) return;
    teamDialog.current?.close();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.dismiss();
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedSpecialty = specialty.trim().replace(/\s+/g, ' ');
    const errors: TeamFormErrors = {};
    if (normalizedName.length < 2 || normalizedName.length > 120)
      errors.name = 'Ingresa entre 2 y 120 caracteres.';
    if (
      normalizedSpecialty.length < 2 ||
      normalizedSpecialty.length > 100 ||
      !specialtyOptions.includes(normalizedSpecialty)
    )
      errors.specialty = 'Selecciona una especialidad del catálogo.';
    if (!memberIds.length)
      errors.members = 'Selecciona al menos un integrante.';
    if (memberIds.length > 200)
      errors.members = 'Un equipo admite hasta 200 integrantes.';
    const conflictingMemberId = memberIds.find((id) =>
      activeTeamByMember.has(id),
    );
    if (conflictingMemberId) {
      const conflictingMember = usersById.get(conflictingMemberId);
      const assignedTeam = activeTeamByMember.get(conflictingMemberId);
      const conflictMessage =
        conflictingMember && assignedTeam
          ? `${conflictingMember.name} ya pertenece al equipo “${assignedTeam.name}”.`
          : 'Uno de los integrantes seleccionados ya pertenece a otro equipo activo.';
      errors.members = conflictMessage;
    }
    if (!leaderId || !memberIds.includes(leaderId))
      errors.leader =
        'El líder debe pertenecer a los integrantes seleccionados.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const conflictMessage = errors.members?.includes('pertenece al equipo')
        ? errors.members
        : `Revisa los campos obligatorios: ${[
            errors.name ? 'Nombre del equipo' : '',
            errors.specialty ? 'Especialidad' : '',
            errors.members ? 'Integrantes' : '',
            errors.leader ? 'Líder del equipo' : '',
          ]
            .filter(Boolean)
            .join(', ')}.`;
      feedback.notify(conflictMessage, 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: normalizedName,
        specialty: normalizedSpecialty,
        memberIds,
        leaderId,
      };
      if (editingTeam) await updateTeam(editingTeam.id, payload);
      else await createTeam(payload);
      await load();
      teamDialog.current?.close();
      resetForm();
      feedback.notify(
        editingTeam
          ? 'Equipo actualizado correctamente.'
          : 'Equipo creado correctamente.',
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : `No fue posible ${editingTeam ? 'actualizar' : 'crear'} el equipo.`;
      const isMemberConflict = message
        .toLocaleLowerCase('es')
        .includes('pertenece a otro equipo');

      if (isMemberConflict) {
        // The assignment may have changed after the form loaded. Refresh only
        // for this conflict so the user sees the member and their current team.
        let latestTeams = teams;
        try {
          latestTeams = await getTeams();
          setTeams(latestTeams);
        } catch {
          // Keep the already loaded data and fall back to an actionable message.
        }

        const conflictingTeam = latestTeams.find(
          (team) =>
            team.status === 'activo' &&
            team.id !== editingTeam?.id &&
            team.memberIds.some((id) => memberIds.includes(id)),
        );
        const conflictingMemberId = conflictingTeam?.memberIds.find((id) =>
          memberIds.includes(id),
        );
        const conflictingMember = conflictingMemberId
          ? usersById.get(conflictingMemberId)
          : null;

        const conflictMessage =
          conflictingMember && conflictingTeam
            ? `${conflictingMember.name} ya pertenece al equipo “${conflictingTeam.name}”.`
            : 'Uno de los integrantes seleccionados ya pertenece a otro equipo activo. Revisa los integrantes marcados en la lista.';
        setFieldErrors((current) => ({
          ...current,
          members: conflictMessage,
        }));
        feedback.notify(conflictMessage, 'error');
      } else {
        feedback.notify(message, 'error');
      }
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

  function toggleMember(id: string, checked: boolean) {
    if (!checked && leaderId === id) setLeaderId('');
    setMemberIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((item) => item !== id),
    );
    setFieldErrors((current) => ({
      ...current,
      members: undefined,
      leader: undefined,
    }));
  }

  const metrics = [
    {
      label: 'Total de equipos',
      value: teams.length,
      icon: 'teams' as const,
      color: 'text-violet bg-violet/15',
    },
    {
      label: 'Equipos activos',
      value: activeTeams.length,
      icon: 'check' as const,
      color: 'text-teal bg-teal/15',
    },
    {
      label: 'Equipos inactivos',
      value: teams.length - activeTeams.length,
      icon: 'clock' as const,
      color: 'text-amber-300 bg-amber/15',
    },
    {
      label: 'Integrantes totales',
      value: totalMembers,
      icon: 'users' as const,
      color: 'text-sky-300 bg-blue-500/15',
    },
  ];

  return (
    <AppShell hideTitle title="Equipos">
      <div className="grid min-w-0 gap-6">
        <header className="events-hero flex-wrap">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet/15 text-violet">
              <Icon name="teams" className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-violet">
                Operación colaborativa
              </p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
                Equipos de trabajo
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted sm:text-base">
                Organiza integrantes, especialidades y liderazgo para las
                actividades de tus eventos.
              </p>
            </div>
          </div>
          <PermissionGate permission="equipos.crear">
            <Button
              className="shrink-0"
              data-tour="team-create"
              onClick={openCreateModal}
              type="button"
            >
              <span aria-hidden="true" className="mr-1 text-lg leading-none">
                ＋
              </span>{' '}
              Nuevo equipo
            </Button>
          </PermissionGate>
        </header>

        {error ? <ErrorMessage message={error} /> : null}
        <FeedbackMessages feedback={feedback} />

        <section
          aria-label="Resumen de equipos"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <article
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-sky-blue bg-[var(--evoria-surface)] p-4 shadow-sm"
              key={metric.label}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${metric.color}`}
              >
                <Icon name={metric.icon} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted">{metric.label}</p>
                <p className="mt-0.5 text-2xl font-bold leading-none">
                  {loading ? '—' : metric.value}
                </p>
              </div>
            </article>
          ))}
        </section>

        {loading ? (
          <LoadingState label="Cargando equipos…" />
        ) : (
          <section
            aria-label="Equipos registrados"
            className="events-list-panel min-w-0"
            data-tour="team-directory"
          >
            <div
              className="events-list-panel__toolbar flex-wrap"
              data-tour="team-controls"
            >
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="text-xl font-bold sm:text-2xl">
                  Equipos registrados
                </h2>
                <span className="rounded-full bg-violet/15 px-3 py-1 text-xs font-semibold text-violet">
                  {filteredTeams.length}{' '}
                  {filteredTeams.length === 1 ? 'equipo' : 'equipos'}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
                <label className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
                  <span className="sr-only">Buscar equipos</span>
                  <Icon
                    name="search"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  />
                  <input
                    aria-label="Buscar equipos"
                    className={`${field} py-2 pl-9 pr-3 text-sm`}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Buscar equipos…"
                    type="search"
                    value={search}
                  />
                </label>
                <details className="group relative">
                  <summary
                    className="evoria-button-secondary flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-sky-blue px-3 text-sm font-semibold text-navy hover:border-teal"
                    data-tour="team-status-filter"
                  >
                    <Icon name="filter" className="size-4" /> Filtrar
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-sky-blue bg-[var(--evoria-surface)] p-3 shadow-xl">
                    <label className="grid gap-1.5 text-xs font-semibold text-muted">
                      Estado
                      <select
                        className={`${field} py-2 text-sm`}
                        onChange={(event) => {
                          setStatusFilter(
                            event.target.value as TeamStatusFilter,
                          );
                          setPage(1);
                        }}
                        value={statusFilter}
                      >
                        <option value="todos">Todos los estados</option>
                        <option value="activo">Activos</option>
                        <option value="inactivo">Inactivos</option>
                      </select>
                    </label>
                  </div>
                </details>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="events-table min-w-[56rem]">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Especialidad</th>
                    <th>Integrantes</th>
                    <th>Líder</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTeams.map((team) => {
                    const leader = usersById.get(team.leaderId);
                    return (
                      <tr key={team.id}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet">
                              <Icon name="teams" className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="whitespace-normal font-semibold text-navy">
                                {team.name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted">
                                Equipo de trabajo
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>{team.specialty}</td>
                        <td>
                          <span className="inline-flex items-center gap-2 font-medium">
                            <Icon name="users" className="size-4 text-violet" />{' '}
                            {team.memberIds.length}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet to-fuchsia-600 text-[11px] font-bold text-white">
                              {leader ? initials(leader.name) : '?'}
                            </span>
                            <span className="whitespace-normal font-medium">
                              {leader?.name ?? 'Líder asignado'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${team.status === 'activo' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber/15 text-amber-300'}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${team.status === 'activo' ? 'bg-emerald-400' : 'bg-amber-300'}`}
                            />
                            {team.status === 'activo' ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {can('equipos.editar') &&
                            team.status === 'activo' ? (
                              <Button
                                aria-label={`Editar ${team.name}`}
                                className="grid size-9 place-items-center p-0"
                                data-tour="team-edit-action"
                                onClick={() => openEditModal(team)}
                                title="Editar equipo"
                                type="button"
                                variant="ghost"
                              >
                                <Icon name="edit" className="size-4" />
                              </Button>
                            ) : null}
                            {can('equipos.desactivar') &&
                            team.status === 'activo' ? (
                              <Button
                                aria-label={`Desactivar ${team.name}`}
                                className="grid size-9 place-items-center p-0"
                                data-tour="team-deactivate-action"
                                onClick={() => void deactivate(team)}
                                title="Desactivar equipo"
                                type="button"
                                variant="ghost"
                              >
                                <Icon name="more" className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleTeams.length === 0 ? (
                    <tr>
                      <td className="py-10 text-center text-muted" colSpan={6}>
                        No hay equipos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-blue px-4 py-3 text-sm text-muted sm:px-5">
              <p>
                {filteredTeams.length === 0
                  ? 'No hay equipos para mostrar.'
                  : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredTeams.length)} de ${filteredTeams.length} equipos`}
              </p>
              <nav
                aria-label="Paginación de equipos"
                className="flex items-center gap-2"
              >
                <Button
                  className="px-3 py-1.5 text-xs"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
                <span
                  aria-current="page"
                  className="grid size-8 place-items-center rounded-lg bg-violet font-semibold text-white"
                >
                  {currentPage}
                </span>
                <Button
                  className="px-3 py-1.5 text-xs"
                  disabled={currentPage >= pageCount}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                  type="button"
                  variant="secondary"
                >
                  Siguiente
                </Button>
              </nav>
            </footer>
          </section>
        )}

        <dialog
          aria-labelledby="team-dialog-title"
          className="m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.5rem] border border-violet/45 bg-[var(--evoria-surface)] p-0 text-[var(--evoria-ink)] shadow-[0_24px_80px_rgba(0,0,0,.45),0_0_30px_rgba(106,76,255,.14)] backdrop:bg-navy/60"
          onClose={(event) => {
            // Driver.js closes the modal briefly to expose it without the
            // browser's modal layer. Keep the form state during that transition.
            if (event.currentTarget.dataset.tourNonModal === 'true') return;
            resetForm();
          }}
          ref={teamDialog}
        >
          <div className="flex items-start justify-between gap-4 border-b border-violet/15 p-5 sm:p-6">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet/20 text-violet ring-1 ring-violet/25">
                <Icon name="teams" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold" id="team-dialog-title">
                  {editingTeam ? 'Editar equipo' : 'Crear equipo'}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {editingTeam
                    ? 'Actualiza la información del equipo.'
                    : 'Completa la información para registrar un nuevo equipo.'}
                </p>
              </div>
            </div>
            <Button
              aria-label="Cerrar formulario"
              className="grid size-9 shrink-0 place-items-center p-0 text-2xl leading-none"
              disabled={saving}
              onClick={closeModal}
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </div>
          <form
            className="grid gap-x-5 gap-y-4 p-5 sm:grid-cols-2 sm:p-6"
            data-tour="team-form"
            noValidate
            onSubmit={submit}
          >
            <label className="grid gap-2 text-sm font-semibold">
              <span>
                Nombre del equipo <span className="text-coral">*</span>
              </span>
              <span className="relative">
                <Icon
                  name="teams"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet"
                />
                <input
                  aria-describedby={
                    fieldErrors.name ? 'team-name-error' : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`${field} pl-10 ${fieldErrors.name ? 'border-coral focus:border-coral focus:ring-coral/20' : ''}`}
                  id="team-name"
                  maxLength={120}
                  minLength={2}
                  onChange={(event) => {
                    setName(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      name: undefined,
                    }));
                  }}
                  placeholder="Ej. Logística y Montaje"
                  required
                  value={name}
                />
              </span>
              {fieldErrors.name ? (
                <span
                  className="text-xs font-medium text-coral"
                  id="team-name-error"
                >
                  {fieldErrors.name}
                </span>
              ) : null}
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span>
                Especialidad <span className="text-coral">*</span>
              </span>
              <span className="relative">
                <Icon
                  name="layers"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet"
                />
                <select
                  aria-describedby={
                    fieldErrors.specialty ? 'team-specialty-error' : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.specialty)}
                  className={`${field} appearance-none pl-10 pr-10 ${fieldErrors.specialty ? 'border-coral focus:border-coral focus:ring-coral/20' : ''}`}
                  id="team-specialty"
                  onChange={(event) => {
                    setSpecialty(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      specialty: undefined,
                    }));
                  }}
                  required
                  value={specialty}
                >
                  <option value="">Selecciona una especialidad</option>
                  {specialtyOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                >
                  ⌄
                </span>
              </span>
              {fieldErrors.specialty ? (
                <span
                  className="text-xs font-medium text-coral"
                  id="team-specialty-error"
                >
                  {fieldErrors.specialty}
                </span>
              ) : null}
            </label>
            <fieldset
              className="grid min-w-0 gap-2.5 sm:col-span-2"
              data-tour="team-members-field"
            >
              <legend className="mb-1 text-sm font-semibold">
                Integrantes <span className="text-coral">*</span>
              </legend>
              <span className="relative block">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet"
                />
                <input
                  aria-describedby={
                    fieldErrors.members ? 'team-members-error' : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.members)}
                  className={`${field} pl-10 ${fieldErrors.members ? 'border-coral focus:border-coral focus:ring-coral/20' : ''}`}
                  id="team-members-search"
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  type="search"
                  value={memberSearch}
                />
              </span>
              {memberIds.length ? (
                <div
                  aria-label="Integrantes seleccionados"
                  className="flex flex-wrap gap-1.5 pt-0.5"
                >
                  {memberIds.map((id) => {
                    const person = usersById.get(id);
                    return person ? (
                      <span
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet/35 bg-violet/15 py-1 pl-1 pr-2 text-xs text-[var(--evoria-ink)]"
                        key={id}
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet to-fuchsia-600 text-[9px] font-bold text-white">
                          {initials(person.name)}
                        </span>
                        <span className="max-w-40 truncate">{person.name}</span>
                        <button
                          aria-label={`Quitar a ${person.name}`}
                          className="grid size-4 shrink-0 place-items-center rounded-full text-muted hover:bg-violet/20 hover:text-[var(--evoria-ink)]"
                          onClick={() => toggleMember(id, false)}
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              ) : null}
              <div
                aria-label="Usuarios disponibles"
                className="grid max-h-52 grid-cols-1 gap-x-4 overflow-y-auto rounded-xl border border-sky-blue/70 bg-[var(--evoria-bg)] p-2 sm:grid-cols-2"
              >
                {filteredMembers.map((person) => {
                  const selected = memberIds.includes(person.id);
                  const assignedTeam = activeTeamByMember.get(person.id);
                  const disabled =
                    !selected &&
                    (memberIds.length >= 200 || Boolean(assignedTeam));
                  return (
                    <label
                      className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm ${disabled ? 'cursor-not-allowed bg-violet/5' : 'cursor-pointer hover:bg-violet/5'}`}
                      key={person.id}
                    >
                      <input
                        checked={selected}
                        className="size-4 shrink-0 accent-violet"
                        disabled={disabled}
                        onChange={(event) =>
                          toggleMember(person.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate font-medium">
                            {person.name}
                          </span>
                          <span className="truncate text-xs text-muted">
                            {person.email}
                          </span>
                        </span>
                        {assignedTeam ? (
                          <span
                            className="shrink-0 rounded-full border border-violet/20 bg-violet/10 px-2 py-0.5 text-[10px] font-medium text-violet"
                            title={`Ya pertenece al equipo ${assignedTeam.name}`}
                          >
                            Ya asignado
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
                {filteredMembers.length === 0 ? (
                  <p className="p-3 text-sm text-muted sm:col-span-2">
                    No hay integrantes activos que coincidan.
                  </p>
                ) : null}
              </div>
              {fieldErrors.members ? (
                <p
                  className="text-xs font-medium text-coral"
                  id="team-members-error"
                  role="alert"
                >
                  {fieldErrors.members}
                </p>
              ) : null}
              {!can('usuarios.ver') ? (
                <p className="text-xs text-muted">
                  Necesitas permiso para ver usuarios y seleccionar integrantes.
                </p>
              ) : null}
            </fieldset>
            <label
              className="grid gap-2 text-sm font-semibold sm:col-span-2"
              data-tour="team-leader-field"
            >
              <span>
                Líder del equipo <span className="text-coral">*</span>
              </span>
              <span className="relative">
                <Icon
                  name="crown"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet"
                />
                <select
                  aria-describedby={
                    fieldErrors.leader ? 'team-leader-error' : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.leader)}
                  className={`${field} appearance-none pl-10 pr-10 ${fieldErrors.leader ? 'border-coral focus:border-coral focus:ring-coral/20' : ''}`}
                  disabled={!memberIds.length}
                  id="team-leader"
                  onChange={(event) => {
                    setLeaderId(event.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      leader: undefined,
                    }));
                  }}
                  required
                  value={leaderId}
                >
                  <option value="">Selecciona el líder del equipo</option>
                  {activeUsers
                    .filter((person) => memberIds.includes(person.id))
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                >
                  ⌄
                </span>
              </span>
              {fieldErrors.leader ? (
                <span
                  className="text-xs font-medium text-coral"
                  id="team-leader-error"
                >
                  {fieldErrors.leader}
                </span>
              ) : null}
            </label>
            <div className="flex flex-wrap justify-end gap-2.5 border-t border-sky-blue/80 pt-4 sm:col-span-2">
              <Button
                disabled={saving}
                onClick={closeModal}
                type="button"
                variant="secondary"
                className="min-w-28 border-sky-blue bg-transparent text-[var(--evoria-ink)] hover:bg-sky-blue/10"
              >
                Cancelar
              </Button>
              <Button
                className="min-w-36"
                data-tour="team-save"
                disabled={saving || !can('usuarios.ver')}
                type="submit"
              >
                {saving ? (
                  'Guardando…'
                ) : editingTeam ? (
                  'Guardar cambios'
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className="mr-1 text-lg leading-none"
                    >
                      ＋
                    </span>
                    Crear equipo
                  </>
                )}
              </Button>
            </div>
          </form>
        </dialog>
      </div>
    </AppShell>
  );
}
