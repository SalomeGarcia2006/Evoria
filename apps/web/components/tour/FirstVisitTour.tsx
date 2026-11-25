'use client';

import { driver, type DriveStep } from 'driver.js';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { permissionForPathname } from '../../lib/access-control';
import { manualContent } from './manual-content';
import {
  findTarget,
  formGuides,
  pageSteps,
  type InteractiveStep,
} from './interactive-guides';
import styles from './FirstVisitTour.module.css';

type GuideStep = {
  title: string;
  description: string;
  selector?: string;
  permission?: string;
};

type ModuleGuide = { title: string; description: string; steps: GuideStep[] };

type TourContinuation = {
  direction: 'forward' | 'back';
  targetPathPrefix: string;
  progressOffset: number;
  totalSteps?: number;
  createdAt: number;
};

function guidePathForPathname(pathname: string): string {
  if (pathname.startsWith('/recursos/asignaciones/'))
    return '/recursos/asignaciones/[eventId]';
  return pathname;
}

function manualPathForGuidePath(guidePathname: string): string {
  return guidePathname === '/recursos/asignaciones/[eventId]'
    ? '/recursos/asignaciones'
    : guidePathname;
}

const announcements: {
  id: string;
  title: string;
  description: string;
  permission?: string;
}[] = [];

function manualTopicIcon(pathname: string, title: string): string {
  if (pathname === '/eventos') {
    const eventTopicIcons: Record<string, string> = {
      'Buscar y consultar': '/icons/ver.svg',
      'Ver detalles del evento': '/icons/ver.svg',
      'Próximo en tu agenda': '/icons/FECHA.svg',
      'Nuevo evento': '/icons/crear.svg',
      'Tipo de evento': '/icons/eventos.svg',
      'Editar y cambiar estado': '/icons/editar.svg',
      'Relación con otros módulos': '/icons/recursos.svg',
    };
    return eventTopicIcons[title] ?? '/icons/eventos.svg';
  }

  if (pathname === '/equipos') {
    const teamTopicIcons: Record<string, string> = {
      'Equipos registrados': '/icons/usuarios.svg',
      'Crear equipo': '/icons/crear.svg',
      'Integrantes y liderazgo': '/icons/usuarios.svg',
      'Editar equipo': '/icons/editar.svg',
      'Desactivar equipo': '/icons/alerta.svg',
      'Equipos en cronogramas': '/icons/cronograma.svg',
    };
    return teamTopicIcons[title] ?? '/icons/usuarios.svg';
  }

  if (title.includes('editar')) return '/icons/editar.svg';
  if (title.includes('fecha') || title.includes('agenda'))
    return '/icons/FECHA.svg';
  if (title.includes('crear')) return '/icons/crear.svg';
  if (title.includes('ubicación')) return '/icons/ubicacion.svg';
  if (title.includes('perfil')) return '/icons/perfil.svg';
  return '/icons/alerta.svg';
}

const guides: Record<string, ModuleGuide> = {
  '/dashboard': {
    title: 'Panel principal',
    description:
      'Consulta los indicadores y la actividad disponibles para tu empresa.',
    steps: [
      {
        title: 'Indicadores',
        description:
          'Estas métricas resumen la información disponible según tus permisos.',
        selector: '[aria-label="Métricas principales"]',
      },
      {
        title: 'Detalle de la operación',
        description:
          'Desplázate por la página para consultar próximos eventos y presupuestos disponibles.',
      },
      {
        title: 'Información según tu perfil',
        description:
          'Los indicadores y secciones dependen de los permisos de consulta y de los datos registrados en la empresa activa. Un valor vacío puede indicar que todavía no hay información disponible.',
      },
    ],
  },
  '/empresas': {
    title: 'Empresas',
    description:
      'Aquí puedes consultar la empresa activa o las opciones disponibles en plataforma.',
    steps: [
      {
        title: 'Empresa y contexto',
        description:
          'Consulta la información disponible de tu empresa. Si tu perfil lo permite, podrás editar su contexto operativo.',
        selector: '[aria-label="Contexto operativo"]',
      },
      {
        title: 'Seleccionar empresa',
        description:
          'Si eres desarrollador, desde la plataforma puedes seleccionar o crear una empresa.',
      },
      {
        title: 'Contexto operativo',
        description:
          'El sector, los tipos de eventos y la descripción documentan cómo trabaja la empresa. Esta información no concede permisos automáticamente.',
      },
    ],
  },
  '/eventos': {
    title: 'Eventos',
    description: 'Consulta y organiza los eventos de tu empresa.',
    steps: [
      {
        title: 'Consultar eventos',
        description:
          'Revisa los eventos registrados y utiliza las opciones del listado para encontrar uno.',
        selector: '.events-list-panel',
      },
      {
        title: 'Crear un evento',
        description:
          'Usa este botón para registrar un evento con su información y responsable.',
        selector: '.events-hero button',
        permission: 'eventos.crear',
      },
      {
        title: 'Fechas y estados',
        description:
          'El estado indica la etapa del evento. Consulta sus fechas y detalles antes de organizar recursos, presupuesto y actividades.',
        selector: '.events-list-panel',
      },
      {
        title: 'Próximo en tu agenda',
        description:
          'Cuando hay un evento futuro activo, esta tarjeta destaca el más cercano y permite abrir sus detalles rápidamente.',
      },
    ],
  },
  '/inventario': {
    title: 'Inventario',
    description:
      'Consulta los recursos y las cantidades disponibles para tu empresa.',
    steps: [
      {
        title: 'Resumen del inventario',
        description: 'Revisa las cantidades y los estados disponibles.',
        selector: '[aria-label="Resumen de inventario"]',
      },
      {
        title: 'Recursos registrados',
        description:
          'Busca y consulta los recursos que podrás utilizar en los eventos.',
        selector: '[aria-label="Recursos del inventario"]',
      },
      {
        title: 'Disponibilidad',
        description:
          'Consulta las cantidades y el estado de los recursos antes de reservarlos para un evento. Las acciones disponibles dependen de los permisos de tu perfil.',
      },
      {
        title: 'Ver detalle',
        description:
          'Abre un recurso para consultar sus cantidades, costo y acciones disponibles. Esta consulta no modifica el inventario.',
      },
    ],
  },
  '/recursos/asignaciones': {
    title: 'Asignación de recursos',
    description:
      'Organiza las reservas de inventario y los servicios asociados a cada evento.',
    steps: [
      {
        title: 'Selecciona un evento',
        description: 'Abre un evento activo para consultar sus asignaciones.',
        selector: '[aria-label="Eventos activos para asignar recursos"]',
      },
      {
        title: 'Reservas y servicios',
        description:
          'Dentro del evento puedes consultar los recursos y servicios. Asignar o liberar depende de tus permisos y de los requisitos de presupuesto.',
      },
      {
        title: '¿Por qué no aparece un evento?',
        description:
          'Esta vista muestra eventos creados, planificados o en ejecución. Los finalizados y cancelados no permiten nuevas asignaciones aquí.',
      },
      {
        title: 'Actualizar eventos',
        description:
          'Vuelve a consultar la lista para ver cambios recientes. No asigna ni libera recursos.',
      },
    ],
  },
  '/recursos/asignaciones/[eventId]': {
    title: 'Detalle de asignaciones',
    description:
      'Consulta las reservas y los servicios del evento y revisa cómo abrir las opciones para gestionarlos.',
    steps: [
      {
        title: 'Evento seleccionado',
        description:
          'Revisa el estado y las fechas del evento antes de gestionar sus asignaciones.',
        selector: '[data-tour="assignment-event-summary"]',
      },
      {
        title: 'Reservas y servicios',
        description:
          'Consulta las reservas de inventario y los servicios asociados disponibles para tu perfil.',
        selector: '[aria-label="Asignaciones actuales"]',
      },
    ],
  },
  '/proveedores': {
    title: 'Proveedores',
    description: 'Consulta el directorio de proveedores de tu empresa.',
    steps: [
      {
        title: 'Directorio',
        description:
          'Consulta los proveedores y usa los filtros para encontrar los que necesitas.',
        selector: '[aria-label="Directorio de proveedores"]',
      },
      {
        title: 'Servicios',
        description:
          'Los servicios se asignan a eventos desde las opciones disponibles para tu perfil.',
      },
      {
        title: 'Filtros del directorio',
        description:
          'Busca por nombre o contacto y combina los filtros de categoría y estado. Si no encuentras un proveedor, revisa primero los filtros.',
        selector: '[aria-label="Directorio de proveedores"]',
      },
      {
        title: 'Crear proveedor',
        description:
          'Registra los datos del proveedor para poder consultar sus servicios. Esta acción requiere permiso de creación.',
        permission: 'proveedores.crear',
      },
    ],
  },
  '/presupuestos': {
    title: 'Presupuestos',
    description:
      'Consulta los presupuestos y autorizaciones disponibles para tu perfil.',
    steps: [
      {
        title: 'Presupuesto por evento',
        description:
          'Selecciona un evento para consultar su presupuesto y los movimientos disponibles.',
        selector: '[aria-label="Eventos activos"]',
      },
      {
        title: 'Autorizaciones',
        description:
          'Las solicitudes y decisiones aparecen para los perfiles con los permisos correspondientes.',
      },
      {
        title: 'Estados del presupuesto',
        description:
          'La tarjeta indica si el presupuesto inicial está pendiente o si ya puedes consultar saldos, gastos y solicitudes.',
        selector: '[aria-label="Eventos activos"]',
      },
      {
        title: 'Solicitudes pendientes',
        description:
          'El botón de autorizaciones permite revisar solicitudes pendientes. Solo aparece si tu perfil puede aprobar presupuestos.',
        permission: 'presupuestos.aprobar',
      },
    ],
  },
  '/cronograma': {
    title: 'Cronograma',
    description: 'Organiza y consulta las actividades de cada evento.',
    steps: [
      {
        title: 'Actividades',
        description:
          'Selecciona un evento para consultar sus actividades, fechas y responsables.',
        selector: '.events-list-panel',
      },
      {
        title: 'Nueva actividad',
        description:
          'Si tienes permiso y el evento lo permite, utiliza este botón para registrar una actividad.',
        selector: '.events-hero button',
        permission: 'cronogramas.crear',
      },
      {
        title: 'Organización por evento',
        description:
          'Las actividades corresponden al evento seleccionado. Sus fechas y responsables permiten seguir el trabajo planeado para ese evento.',
      },
    ],
  },
  '/equipos': {
    title: 'Equipos',
    description:
      'Organiza los equipos que participarán en las actividades de tu empresa.',
    steps: [
      {
        title: 'Equipos registrados',
        description:
          'Consulta los equipos creados, su especialidad, número de integrantes y estado.',
        selector: '.events-list-panel',
      },
      {
        title: 'Crear equipo',
        description:
          'Registra un equipo indicando su nombre, especialidad, integrantes y líder.',
        selector: 'main form',
        permission: 'equipos.crear',
      },
      {
        title: 'Integrantes y líder',
        description:
          'Selecciona usuarios activos y define como líder a una persona que forme parte del equipo.',
        selector: 'main form fieldset',
        permission: 'equipos.crear',
      },
      {
        title: 'Desactivar un equipo',
        description:
          'La desactivación requiere una confirmación y no se puede revertir desde esta vista.',
        permission: 'equipos.desactivar',
      },
    ],
  },
  '/alertas': {
    title: 'Alertas',
    description: 'Revisa avisos y novedades de la operación de tu empresa.',
    steps: [
      {
        title: 'Filtrar alertas',
        description:
          'Usa los filtros para encontrar las alertas que necesitas consultar.',
        selector: '[aria-label="Filtros de alertas"]',
      },
      {
        title: 'Consultar detalles',
        description:
          'Abre una alerta del listado para revisar su información y las acciones disponibles.',
      },
      {
        title: 'Si no encuentras una alerta',
        description:
          'Revisa los filtros seleccionados. La información disponible depende de la empresa activa y de los permisos de tu perfil.',
      },
    ],
  },
  '/reportes': {
    title: 'Reportes',
    description:
      'Consulta indicadores, revisa reportes de eventos, presupuestos, inventario, asignaciones, proveedores y cronogramas, y genera documentos PDF según los permisos de tu perfil.',
    steps: [
      {
        title: 'Resumen operativo',
        description:
          'Las métricas se muestran según los permisos de consulta de tu perfil.',
        selector: '[data-tour="reports-summary"]',
      },
      {
        title: 'Tipos de reporte',
        description:
          'Elige entre eventos, presupuestos, inventario, asignaciones, proveedores y cronogramas.',
        selector: '[data-tour="report-types"]',
      },
      {
        title: 'Filtros y resultados',
        description:
          'Acota los datos, consulta las filas disponibles y cambia de página cuando hay más resultados.',
        selector: '[data-tour="report-filters"]',
      },
      {
        title: 'Documentos PDF',
        description:
          'Descarga fichas de empresa, equipos y eventos; los archivos no modifican los datos.',
        selector: '[data-tour="report-documents"]',
      },
    ],
  },
  '/auditoria': {
    title: 'Auditoría',
    description:
      'Consulta el historial de acciones registradas para tu empresa.',
    steps: [
      {
        title: 'Filtrar registros',
        description:
          'Usa los filtros de la página para acotar la búsqueda por los criterios disponibles.',
      },
      {
        title: 'Consultar resultados',
        description: 'Revisa los registros y sus detalles en el listado.',
      },
      {
        title: 'Alcance de los registros',
        description:
          'La auditoría permite consultar acciones registradas de la empresa activa; usa los filtros para encontrar la información que necesitas.',
      },
    ],
  },
  '/usuarios': {
    title: 'Usuarios',
    description:
      'Consulta las membresías de la empresa activa, actualiza perfiles y estados, y revisa qué condiciones aplican para desactivar un usuario.',
    steps: [
      {
        title: 'Usuarios registrados',
        description:
          'El listado muestra los usuarios vinculados a la empresa activa, con su perfil asignado y su estado de acceso.',
        selector: '[data-tour="users-list-card"]',
      },
      {
        title: 'Editar usuario',
        description:
          'Editar permite cambiar el perfil y el estado de la membresía. El perfil debe estar activo y pertenecer a la empresa actual; no se modifican datos personales ni credenciales.',
        selector: '[data-tour="user-edit-action"]',
        permission: 'usuarios.editar',
      },
      {
        title: 'Desactivar usuario',
        description:
          'La baja afecta la membresía de esta empresa, no elimina la cuenta. No puedes desactivarte a ti mismo. Si la persona está en un equipo activo o tiene eventos con actividades futuras asignadas, primero hay que retirarla del equipo o reasignar esos eventos.',
        selector: '[data-tour="user-deactivate-action"]',
        permission: 'usuarios.desactivar',
      },
    ],
  },
  '/perfiles': {
    title: 'Perfiles y permisos',
    description:
      'Configura qué puede consultar o gestionar cada rol de tu empresa y revisa los perfiles ya asignados.',
    steps: [
      {
        title: 'Perfiles registrados',
        description:
          'Revisa el nombre, estado y permisos de cada perfil. Los perfiles del sistema aparecen identificados y no se editan desde esta vista.',
        selector: '[data-tour="profiles-list"]',
      },
      {
        title: 'Administrar permisos',
        description:
          'Si tu perfil lo permite, crea un rol o ajusta uno existente seleccionando las acciones concretas que necesitará el equipo.',
      },
    ],
  },
  '/mi-perfil': {
    title: 'Mi perfil',
    description: 'Consulta la información de tu cuenta.',
    steps: [
      {
        title: 'Datos de la cuenta',
        description: 'Revisa los datos mostrados de tu sesión y perfil.',
      },
      {
        title: 'Cuenta de Google',
        description:
          'Consulta las opciones de vinculación disponibles para tu cuenta.',
      },
      {
        title: 'Datos de la sesión',
        description:
          'La información mostrada corresponde a la cuenta con la que ingresaste. Las opciones disponibles dependen del estado de esa cuenta.',
      },
    ],
  },
};

const seenInSession = new Set<string>();

export function FirstVisitTour() {
  const { can, user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const guidePathname = guidePathForPathname(pathname);
  const manualPathname = manualPathForGuidePath(guidePathname);
  const userId = user?.id;
  const permissions = user?.permissions;
  const isDeveloper = user?.isDeveloper;
  const requiredPermission = permissionForPathname(pathname);
  const isAssignmentsRoute =
    pathname === '/recursos/asignaciones' ||
    pathname.startsWith('/recursos/asignaciones/');
  const hasAlternativeAccess =
    (isAssignmentsRoute && can('servicios_proveedor.ver')) ||
    (pathname === '/presupuestos' && can('presupuestos.aprobar')) ||
    (pathname === '/empresas' && can('empresa_contexto.ver'));
  const canViewCurrentModule =
    !requiredPermission || can(requiredPermission) || hasAlternativeAccess;
  const canUseHelp = Boolean(user?.tenant?.id) && canViewCurrentModule;
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<{ path: string; id: number } | null>(
    null,
  );
  const handledRequest = useRef(0);
  const [newsRead, setNewsRead] = useState(true);
  const [guideChanged, setGuideChanged] = useState(false);
  const [showGuideUpdate, setShowGuideUpdate] = useState(false);
  const visibleNews = announcements.filter(
    (item) =>
      !item.permission || isDeveloper || permissions?.includes(item.permission),
  );
  const topics = (manualContent[manualPathname] ?? []).filter(
    (item) =>
      !item.permission || isDeveloper || permissions?.includes(item.permission),
  );
  const hasNews = showGuideUpdate || visibleNews.length > 0;
  const guideVersion = JSON.stringify([
    guides[guidePathname],
    pageSteps[guidePathname],
    formGuides[guidePathname],
    topics,
  ]);

  useEffect(() => {
    if (!canUseHelp || !userId || !guides[guidePathname]) return;
    const timer = window.setTimeout(() => {
      try {
        const key = `evoria-guide-version:${userId}:${guidePathname}`;
        const previous = localStorage.getItem(key);
        setGuideChanged(previous !== null && previous !== guideVersion);
        if (previous === null) localStorage.setItem(key, guideVersion);
      } catch {
        setGuideChanged(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canUseHelp, userId, guidePathname, guideVersion]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => {
      try {
        const readableNews = announcements.filter(
          (item) =>
            !item.permission ||
            isDeveloper ||
            permissions?.includes(item.permission),
        );
        setNewsRead(
          readableNews.every(
            (item) =>
              localStorage.getItem(`evoria-news:${userId}:${item.id}`) ===
              'read',
          ),
        );
      } catch {
        setNewsRead(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId, permissions, isDeveloper]);

  useEffect(() => {
    const guide = guides[guidePathname];
    if (isLoading || !canUseHelp || !userId || !guide || !permissions) return;
    const storageKey = `evoria-module-tour:${userId}:${guidePathname}`;
    const assignmentsListStorageKey = `evoria-module-tour:${userId}:/recursos/asignaciones`;
    const assignmentsDetailStorageKey = `evoria-module-tour:${userId}:/recursos/asignaciones/[eventId]`;
    const continuationStorageKey = `evoria-tour-continuation:${userId}:assignments`;
    let continuation: TourContinuation | null = null;
    if (
      pathname === '/recursos/asignaciones' ||
      guidePathname === '/recursos/asignaciones/[eventId]'
    ) {
      try {
        const storedContinuation = sessionStorage.getItem(
          continuationStorageKey,
        );
        if (storedContinuation) {
          const parsed = JSON.parse(
            storedContinuation,
          ) as Partial<TourContinuation>;
          const isFresh =
            typeof parsed.createdAt === 'number' &&
            Date.now() >= parsed.createdAt &&
            Date.now() - parsed.createdAt < 30 * 60 * 1000;
          const resumesDetails =
            guidePathname === '/recursos/asignaciones/[eventId]' &&
            parsed.direction === 'forward' &&
            parsed.targetPathPrefix === '/recursos/asignaciones/' &&
            pathname.startsWith(parsed.targetPathPrefix);
          const resumesList =
            pathname === '/recursos/asignaciones' &&
            parsed.direction === 'back' &&
            parsed.targetPathPrefix === '/recursos/asignaciones';
          if (
            (resumesDetails || resumesList) &&
            typeof parsed.progressOffset === 'number' &&
            Number.isFinite(parsed.progressOffset) &&
            (parsed.totalSteps === undefined ||
              (typeof parsed.totalSteps === 'number' &&
                Number.isFinite(parsed.totalSteps))) &&
            isFresh
          ) {
            continuation = parsed as TourContinuation;
          } else {
            sessionStorage.removeItem(continuationStorageKey);
          }
        }
      } catch {
        continuation = null;
      }
    }
    const requested =
      request?.path === pathname && request.id !== handledRequest.current;
    if (!requested && !continuation && seenInSession.has(storageKey)) return;
    try {
      if (
        !requested &&
        !continuation &&
        localStorage.getItem(storageKey) === 'done'
      )
        return;
    } catch {
      // El recorrido sigue disponible si el navegador bloquea el almacenamiento.
    }

    let tour: ReturnType<typeof driver> | undefined;
    const waitStarted = Date.now();
    const timer = window.setInterval(() => {
      if (document.querySelector('dialog[open], .driver-active')) return;
      const main = document.querySelector<HTMLElement>('main');
      if (!main) return;
      const isLoadingAssignmentList =
        pathname === '/recursos/asignaciones' &&
        main.textContent?.includes('Cargando eventos activos');
      const isLoadingAssignmentDetails =
        guidePathname === '/recursos/asignaciones/[eventId]' &&
        main.textContent?.includes('Cargando asignaciones del evento');
      const isLoadingBudgetList =
        pathname === '/presupuestos' &&
        main.textContent?.includes('Cargando eventos activos');
      const isLoadingEventList =
        pathname === '/eventos' &&
        main.textContent?.includes('Cargando eventos');
      const isLoadingInventory =
        pathname === '/inventario' &&
        main.textContent?.includes('Cargando recursos');
      const isLoadingTenantContext =
        pathname === '/empresas' &&
        main.textContent?.includes('Cargando contexto operativo');
      const isLoadingReports =
        pathname === '/reportes' &&
        main.textContent?.includes('Cargando reportes');
      const isLoadingReportResults =
        pathname === '/reportes' &&
        main.textContent?.includes('Consultando eventos');
      if (
        (isLoadingAssignmentList ||
          isLoadingAssignmentDetails ||
          isLoadingBudgetList ||
          isLoadingEventList ||
          isLoadingInventory ||
          isLoadingTenantContext ||
          isLoadingReports ||
          isLoadingReportResults) &&
        Date.now() - waitStarted < 10000
      )
        return;
      window.clearInterval(timer);
      if (requested && request) handledRequest.current = request.id;

      const steps: DriveStep[] = [];
      if (!continuation || continuation.direction === 'back') {
        steps.push({
          popover: {
            title: `Conoce ${guide.title}`,
            description: `${guide.description} Puedes avanzar u omitir esta guía.`,
          },
        });
      } else if (continuation.direction === 'forward') {
        // Reserva un índice anterior para habilitar «Anterior» en el primer
        // paso del detalle. Su acción lleva de vuelta al paso de apertura.
        steps.push({
          element: () => main,
          popover: { title: '', description: '', showButtons: [] },
        });
      }
      const openedDialogs: {
        dialog: HTMLDialogElement;
        originalStyle: string;
        originalVisibility: string;
      }[] = [];
      let cancelled = false;
      const activeTourDialog = () => openedDialogs.at(-1)?.dialog ?? null;
      const findUntrackedOpenDialog = () =>
        Array.from(
          main.querySelectorAll<HTMLDialogElement>('dialog[open]'),
        ).find(
          (dialog) => !openedDialogs.some((entry) => entry.dialog === dialog),
        );
      const presentDialogForTour = (
        dialog: HTMLDialogElement,
        preserveDialog = false,
        hideUntilReady = false,
      ) => {
        if (openedDialogs.some((entry) => entry.dialog === dialog)) return;
        openedDialogs.push({
          dialog,
          originalStyle: dialog.style.cssText,
          originalVisibility: dialog.style.visibility,
        });
        if (preserveDialog) dialog.dataset.tourNonModal = 'true';
        // Moverlo a no modal permite que Driver.js resalte su contenido.
        dialog.close();
        dialog.show();
        Object.assign(dialog.style, {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: '0',
        });
        if (hideUntilReady) dialog.style.visibility = 'hidden';
      };
      const revealTourDialog = (dialog: HTMLDialogElement) => {
        const entry = openedDialogs.find((item) => item.dialog === dialog);
        if (!entry) return;
        dialog.style.visibility = entry.originalVisibility;
        dialog.scrollTop = 0;
      };
      const closeCurrentTourDialog = () => {
        const entry = openedDialogs.pop();
        const dialog = entry?.dialog;
        if (!entry || !dialog?.isConnected) return;
        dialog.style.cssText = entry.originalStyle;
        delete dialog.dataset.tourNonModal;
        const close = dialog.querySelector<HTMLButtonElement>(
          'button[aria-label="Cerrar formulario"], button[aria-label="Cerrar ventana"]',
        );
        if (close && !close.disabled) close.click();
        else if (dialog.open) dialog.close();
      };
      const closeTourDialog = () => {
        while (openedDialogs.length) closeCurrentTourDialog();
      };
      const moveTour = (direction: 'next' | 'previous') => {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => {
            if (!cancelled && tour?.isActive()) {
              if (direction === 'next') tour.moveNext();
              else tour.movePrevious();
            }
          }),
        );
      };
      const openRelatedDialog = (
        action: NonNullable<InteractiveStep['openDialogOnNext']>,
        direction: 'next' | 'previous',
      ) => {
        const currentDialog = activeTourDialog();
        const trigger =
          currentDialog?.querySelector<HTMLElement>(action.triggerSelector) ??
          main.querySelector<HTMLElement>(action.triggerSelector);
        if (
          !trigger ||
          (trigger instanceof HTMLButtonElement && trigger.disabled)
        ) {
          moveTour(direction);
          return;
        }
        trigger.click();
        const started = Date.now();
        const waitForDialog = () => {
          const dialog = findUntrackedOpenDialog();
          if (cancelled || !tour?.isActive()) {
            if (dialog) {
              presentDialogForTour(dialog, action.preserveDialogDuringTour);
              closeCurrentTourDialog();
            }
            return;
          }
          if (dialog) {
            presentDialogForTour(dialog, action.preserveDialogDuringTour);
            moveTour(direction);
            return;
          }
          if (Date.now() - started < 3000)
            window.requestAnimationFrame(waitForDialog);
          else moveTour(direction);
        };
        window.requestAnimationFrame(waitForDialog);
      };
      const clickRelatedControl = (
        action: NonNullable<InteractiveStep['clickOnNext']>,
        direction: 'next' | 'previous',
      ) => {
        const trigger =
          activeTourDialog()?.querySelector<HTMLElement>(
            action.triggerSelector,
          ) ?? main.querySelector<HTMLElement>(action.triggerSelector);
        if (
          !trigger ||
          (trigger instanceof HTMLButtonElement && trigger.disabled)
        ) {
          moveTour(direction);
          return;
        }
        trigger.click();
        const started = Date.now();
        const waitForReadyElement = () => {
          if (cancelled || !tour?.isActive()) return;
          if (
            main
              .querySelector<HTMLElement>(action.readySelector)
              ?.getClientRects().length
          ) {
            moveTour(direction);
            return;
          }
          if (Date.now() - started < 3000)
            window.requestAnimationFrame(waitForReadyElement);
          else moveTour(direction);
        };
        window.requestAnimationFrame(waitForReadyElement);
      };

      const currentPageSteps = pageSteps[guidePathname] ?? [];
      const visiblePageSteps =
        pathname === '/recursos/asignaciones'
          ? currentPageSteps.filter((item) => item.title !== 'Ver inventario')
          : currentPageSteps;
      const nextStepNumber = () => {
        if (pathname === '/recursos/asignaciones') return steps.length + 1;
        if (!continuation) return steps.length + 1;
        if (continuation.direction === 'forward')
          return continuation.progressOffset + steps.length;
        return continuation.progressOffset + steps.length + 1;
      };

      for (const item of visiblePageSteps) {
        if (
          item.permission &&
          !isDeveloper &&
          !permissions.includes(item.permission)
        )
          continue;
        const element = findTarget(main, item);
        if (
          !element?.getClientRects().length ||
          element.closest('dialog:not([open])')
        )
          continue;

        const currentStepNumber = nextStepNumber();
        steps.push({
          element: item.clickOnNext
            ? () => findTarget(main, item) ?? main
            : element,
          popover: {
            title: item.title,
            description: item.description,
            side: item.popoverSide ?? 'bottom',
            ...(item.continueTourOnPrevious
              ? {
                  onPrevClick: () => {
                    if (!continuation) {
                      moveTour('previous');
                      return;
                    }
                    try {
                      sessionStorage.setItem(
                        continuationStorageKey,
                        JSON.stringify({
                          direction: 'back',
                          targetPathPrefix:
                            item.continueTourOnPrevious!.targetPath,
                          progressOffset: 0,
                          totalSteps: getTourTotal(),
                          createdAt: Date.now(),
                        } satisfies TourContinuation),
                      );
                    } catch {
                      // La navegación de regreso continúa sin almacenamiento.
                    }
                    router.push(item.continueTourOnPrevious!.targetPath);
                  },
                }
              : {}),
            ...(item.openDialogOnNext
              ? {
                  onNextClick: () =>
                    openRelatedDialog(item.openDialogOnNext!, 'next'),
                }
              : {}),
            ...(item.clickOnNext
              ? {
                  onNextClick: () =>
                    clickRelatedControl(item.clickOnNext!, 'next'),
                }
              : {}),
            ...(item.closeDialogOnNext
              ? {
                  onNextClick: () => {
                    closeCurrentTourDialog();
                    moveTour('next');
                  },
                }
              : {}),
            ...(item.openDialogOnPrevious
              ? {
                  onPrevClick: () =>
                    openRelatedDialog(item.openDialogOnPrevious!, 'previous'),
                }
              : {}),
            ...(item.closeDialogOnPrevious
              ? {
                  onPrevClick: () => {
                    closeCurrentTourDialog();
                    moveTour('previous');
                  },
                }
              : {}),
            ...(item.clickOnPrevious
              ? {
                  onPrevClick: () =>
                    clickRelatedControl(item.clickOnPrevious!, 'previous'),
                }
              : {}),
            ...(item.continueTourOnNext
              ? {
                  onNextClick: () => {
                    const link =
                      element instanceof HTMLAnchorElement ? element : null;
                    if (
                      !link ||
                      !link.pathname.startsWith(
                        item.continueTourOnNext!.targetPathPrefix,
                      )
                    ) {
                      moveTour('next');
                      return;
                    }
                    try {
                      sessionStorage.setItem(
                        continuationStorageKey,
                        JSON.stringify({
                          direction: 'forward',
                          targetPathPrefix:
                            item.continueTourOnNext!.targetPathPrefix,
                          progressOffset: currentStepNumber,
                          ...(continuation?.totalSteps !== undefined
                            ? { totalSteps: continuation.totalSteps }
                            : {}),
                          createdAt: Date.now(),
                        } satisfies TourContinuation),
                      );
                    } catch {
                      // La navegación continúa aunque el almacenamiento esté bloqueado.
                    }
                    link.click();
                  },
                }
              : {}),
          },
        });

        const dialogSteps = (item.dialogSteps ?? []).filter(
          (dialogStep) =>
            !dialogStep.permission ||
            isDeveloper ||
            permissions.includes(dialogStep.permission),
        );
        dialogSteps.forEach((dialogStep, index) => {
          const closeAfterNext =
            dialogStep.closeDialogOnNext ||
            (index === dialogSteps.length - 1 &&
              !dialogStep.openDialogOnNext &&
              !dialogStep.clickOnNext);
          steps.push({
            element: dialogStep.selector ?? (() => activeTourDialog() ?? main),
            ...(index > 0 && dialogStep.selector
              ? { skipMissingElement: true, waitForElement: 2000 }
              : {}),
            ...(dialogStep.scrollIntoView === false
              ? { scrollIntoView: false }
              : {}),
            popover: {
              title: dialogStep.title,
              description: dialogStep.description,
              side: 'bottom',
              ...(dialogStep.closeDialogOnPrevious
                ? {
                    onPrevClick: () => {
                      closeCurrentTourDialog();
                      moveTour('previous');
                    },
                  }
                : {}),
              ...(dialogStep.openDialogOnNext
                ? {
                    onNextClick: () =>
                      openRelatedDialog(dialogStep.openDialogOnNext!, 'next'),
                  }
                : {}),
              ...(dialogStep.clickOnNext
                ? {
                    onNextClick: () =>
                      clickRelatedControl(dialogStep.clickOnNext!, 'next'),
                  }
                : {}),
              ...(closeAfterNext
                ? {
                    onNextClick: () => {
                      closeCurrentTourDialog();
                      moveTour('next');
                    },
                  }
                : {}),
              ...(dialogStep.openDialogOnPrevious
                ? {
                    onPrevClick: () =>
                      openRelatedDialog(
                        dialogStep.openDialogOnPrevious!,
                        'previous',
                      ),
                  }
                : {}),
              ...(dialogStep.closeDialogOnPrevious
                ? {
                    onPrevClick: () => {
                      closeCurrentTourDialog();
                      moveTour('previous');
                    },
                  }
                : {}),
              ...(dialogStep.clickOnPrevious
                ? {
                    onPrevClick: () =>
                      clickRelatedControl(
                        dialogStep.clickOnPrevious!,
                        'previous',
                      ),
                  }
                : {}),
            },
          });
        });
      }

      const formGuide = formGuides[guidePathname];
      const canUseFormGuide =
        formGuide &&
        (isDeveloper ||
          permissions.includes(formGuide.permission) ||
          formGuide.anyPermissions?.some((permission) =>
            permissions.includes(permission),
          ));
      const formGuideStepEntries: {
        item: InteractiveStep;
        step: DriveStep;
      }[] = [];
      const createButton =
        formGuide && canUseFormGuide
          ? formGuide.triggerSelector
            ? (main.querySelector<HTMLButtonElement>(
                formGuide.triggerSelector,
              ) ?? undefined)
            : Array.from(
                main.querySelectorAll<HTMLButtonElement>('button'),
              ).find(
                (button) =>
                  button.textContent?.includes(formGuide.button) &&
                  !button.disabled &&
                  button.getClientRects().length,
              )
          : undefined;

      if (formGuide && createButton) {
        steps.push({
          element: createButton,
          popover: {
            title: formGuide.button,
            description:
              'Al avanzar abriremos esta ventana para explicarla. No se guardará ningún dato.',
            side: 'bottom',
            onNextClick: () => {
              if (!tour?.isActive()) return;
              createButton.click();
              const started = Date.now();
              let openingDialog: HTMLDialogElement | null = null;
              const openForm = () => {
                openingDialog ??= findUntrackedOpenDialog() ?? null;
                const dialog = openingDialog;
                if (cancelled || !tour?.isActive()) {
                  if (dialog) {
                    if (!openedDialogs.some((entry) => entry.dialog === dialog))
                      presentDialogForTour(
                        dialog,
                        formGuide.preserveDialogDuringTour,
                      );
                    closeTourDialog();
                  }
                  return;
                }
                if (!dialog) {
                  if (Date.now() - started < 3000)
                    window.requestAnimationFrame(openForm);
                  else tour.moveTo(steps.length - 1);
                  return;
                }
                if (!openedDialogs.some((entry) => entry.dialog === dialog))
                  presentDialogForTour(
                    dialog,
                    formGuide.preserveDialogDuringTour,
                    !!formGuide.readySelector,
                  );
                if (
                  formGuide.readySelector &&
                  !dialog.querySelector(formGuide.readySelector)
                ) {
                  if (Date.now() - started < 10000)
                    window.requestAnimationFrame(openForm);
                  else {
                    closeTourDialog();
                    tour.moveTo(steps.length - 1);
                  }
                  return;
                }
                const formUsesWizardPages = formGuide.fields.some(
                  (item) =>
                    item.advanceWizardOnNext || item.returnWizardOnPrevious,
                );
                // Los campos de otras páginas del asistente aún no están en el DOM.
                // Se esperan en sus pasos en lugar de eliminarlos al abrir el formulario.
                if (formGuide.skipMissingFields && !formUsesWizardPages) {
                  const activeIndex = tour.getActiveIndex() ?? -1;
                  const missingStepIndexes = formGuideStepEntries
                    .filter(({ item, step }) => {
                      const stepIndex = steps.indexOf(step);
                      return (
                        stepIndex > activeIndex &&
                        !item.dialogTarget &&
                        !findTarget(dialog, item)?.getClientRects().length
                      );
                    })
                    .map(({ step }) => steps.indexOf(step))
                    .filter((index) => index > activeIndex)
                    .sort((left, right) => right - left);
                  missingStepIndexes.forEach((index) => steps.splice(index, 1));
                }
                revealTourDialog(dialog);
                moveTour('next');
              };
              window.requestAnimationFrame(openForm);
            },
          },
        });
        formGuide.fields
          .filter(
            (item) =>
              !item.permission ||
              isDeveloper ||
              permissions.includes(item.permission),
          )
          .forEach((item, index) => {
            const moveWizard = (
              buttonLabel: 'Anterior' | 'Continuar',
              direction: 'next' | 'previous',
            ) => {
              const wizardButton = Array.from(
                activeTourDialog()?.querySelectorAll<HTMLButtonElement>(
                  'button',
                ) ?? [],
              ).find(
                (button) =>
                  button.textContent?.trim() === buttonLabel &&
                  !button.disabled,
              );
              if (wizardButton) wizardButton.click();
              moveTour(direction);
            };
            const fieldStep: DriveStep = {
              element: () =>
                (formGuide.skipMissingFields
                  ? activeTourDialog() &&
                    findTarget(activeTourDialog() as HTMLDialogElement, item)
                  : (activeTourDialog() &&
                      (findTarget(
                        activeTourDialog() as HTMLDialogElement,
                        item,
                      ) ||
                        activeTourDialog()?.querySelector<HTMLElement>(
                          'h2',
                        ))) ||
                    main) as HTMLElement,
              ...(formGuide.skipMissingFields && index > 0
                ? { skipMissingElement: true, waitForElement: 2000 }
                : {}),
              ...(item.scrollIntoView === false
                ? { scrollIntoView: false }
                : {}),
              popover: {
                title: item.title,
                description: item.description,
                side: item.popoverSide ?? 'bottom',
                ...(index === 0
                  ? {
                      onPrevClick: () => {
                        closeTourDialog();
                        tour?.movePrevious();
                      },
                    }
                  : {}),
                ...(item.openDialogOnNext
                  ? {
                      onNextClick: () =>
                        openRelatedDialog(item.openDialogOnNext!, 'next'),
                    }
                  : {}),
                ...(item.closeDialogOnNext
                  ? {
                      onNextClick: () => {
                        closeCurrentTourDialog();
                        moveTour('next');
                      },
                    }
                  : {}),
                ...(item.openDialogOnPrevious
                  ? {
                      onPrevClick: () =>
                        openRelatedDialog(
                          item.openDialogOnPrevious!,
                          'previous',
                        ),
                    }
                  : {}),
                ...(item.closeDialogOnPrevious
                  ? {
                      onPrevClick: () => {
                        closeCurrentTourDialog();
                        moveTour('previous');
                      },
                    }
                  : {}),
                ...(item.advanceWizardOnNext
                  ? { onNextClick: () => moveWizard('Continuar', 'next') }
                  : {}),
                ...(item.returnWizardOnPrevious
                  ? {
                      onPrevClick: () => moveWizard('Anterior', 'previous'),
                    }
                  : {}),
              },
            };
            steps.push(fieldStep);
            formGuideStepEntries.push({ item, step: fieldStep });
          });
      }
      const getTourTotal = () => {
        if (pathname === '/recursos/asignaciones') {
          if (
            continuation?.direction === 'back' &&
            continuation.totalSteps !== undefined
          )
            return continuation.totalSteps;
          const listSteps = Math.max(0, steps.length - 1);
          const detailPath = '/recursos/asignaciones/[eventId]';
          const detailPageCount = (pageSteps[detailPath] ?? []).filter(
            (item) =>
              !item.permission ||
              isDeveloper ||
              permissions.includes(item.permission),
          ).length;
          const detailFormGuide = formGuides[detailPath];
          const canUseDetailFormGuide = Boolean(
            detailFormGuide &&
            (isDeveloper ||
              permissions.includes(detailFormGuide.permission) ||
              detailFormGuide.anyPermissions?.some((permission) =>
                permissions.includes(permission),
              )),
          );
          const canOpenDetailAssignments =
            (can('asignaciones.crear') && can('inventario.ver')) ||
            (can('servicios_proveedor.crear') && can('proveedores.ver'));
          const detailFormCount =
            detailFormGuide && canUseDetailFormGuide && canOpenDetailAssignments
              ? 1 +
                detailFormGuide.fields.filter(
                  (item) =>
                    !item.permission ||
                    isDeveloper ||
                    permissions.includes(item.permission),
                ).length
              : 0;
          return listSteps + detailPageCount + detailFormCount + 1;
        }
        if (!continuation) return steps.length;
        if (continuation.direction === 'forward')
          return continuation.progressOffset + steps.length - 1;
        return (
          continuation.totalSteps ?? continuation.progressOffset + steps.length
        );
      };
      if (pathname === '/recursos/asignaciones') {
        // El paso de apertura debe conservar «Siguiente» y navegar al detalle;
        // este destino vacío nunca se visita mientras el enlace sea válido.
        steps.push({
          element: () => main,
          popover: { title: '', description: '', showButtons: [] },
        });
      } else {
        steps.push({
          popover: {
            title: 'Todo listo',
            description:
              guidePathname === '/recursos/asignaciones/[eventId]'
                ? 'Ya conoces las opciones disponibles. Al finalizar volverás a la lista principal de asignaciones.'
                : 'Ya conoces las opciones disponibles. Puedes repetir la guía desde Ayuda.',
            ...(guidePathname === '/recursos/asignaciones/[eventId]' &&
            formGuide &&
            createButton
              ? {
                  onPrevClick: () =>
                    openRelatedDialog(
                      {
                        triggerSelector: '[data-tour="assignment-open"]',
                        preserveDialogDuringTour: true,
                      },
                      'previous',
                    ),
                }
              : formGuide && createButton
                ? {
                    onPrevClick: () => {
                      tour?.movePrevious();
                    },
                  }
                : {}),
          },
        });
      }

      tour = driver({
        animate: true,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        overlayClickBehavior: 'none',
        showProgress: true,
        progressText: 'Paso {{current}} de {{total}}',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Finalizar',
        closeBtnLabel: 'Omitir tutorial',
        popoverClass: 'evoria-tour',
        onPopoverRender: (popover, { index }) => {
          popover.closeButton.textContent = 'Omitir';
          if (
            (pathname === '/recursos/asignaciones' || continuation) &&
            typeof index === 'number'
          ) {
            const currentStep =
              continuation?.direction === 'forward'
                ? continuation.progressOffset + index
                : index + 1;
            popover.progress.textContent = `Paso ${currentStep} de ${getTourTotal()}`;
          }
        },
        onDestroyed: (_element, _step, { reason }) => {
          cancelled = true;
          closeTourDialog();
          if (reason === 'api' || reason === 'replaced') return;
          const completedAssignmentFlow =
            !!continuation ||
            guidePathname === '/recursos/asignaciones/[eventId]';
          seenInSession.add(storageKey);
          if (completedAssignmentFlow) {
            seenInSession.add(assignmentsListStorageKey);
            seenInSession.add(assignmentsDetailStorageKey);
          }
          try {
            localStorage.setItem(storageKey, 'done');
            if (completedAssignmentFlow) {
              localStorage.setItem(assignmentsListStorageKey, 'done');
              localStorage.setItem(assignmentsDetailStorageKey, 'done');
            }
          } catch {
            // La preferencia se conserva durante la sesión si el almacenamiento está bloqueado.
          }
          if (continuation) {
            try {
              sessionStorage.removeItem(continuationStorageKey);
            } catch {
              // La guía sigue completa aunque no se pueda limpiar la sesión.
            }
          }
          if (
            reason === 'done' &&
            guidePathname === '/recursos/asignaciones/[eventId]'
          )
            router.push('/recursos/asignaciones');
        },
        steps,
      });
      tour.drive(
        continuation?.direction === 'forward'
          ? 1
          : continuation?.direction === 'back'
            ? 3
            : 0,
      );
    }, 500);

    return () => {
      window.clearInterval(timer);
      tour?.destroy();
    };
  }, [
    isLoading,
    canUseHelp,
    userId,
    pathname,
    guidePathname,
    permissions,
    isDeveloper,
    request,
    router,
  ]);

  if (isLoading || !userId) return null;

  function openHelp() {
    if (canUseHelp && !open) setShowGuideUpdate(guideChanged);
    setOpen((current) => !current);
    if (!canUseHelp) return;
    setNewsRead(true);
    setGuideChanged(false);
    try {
      visibleNews.forEach((item) =>
        localStorage.setItem(`evoria-news:${userId}:${item.id}`, 'read'),
      );
      if (guides[guidePathname])
        localStorage.setItem(
          `evoria-guide-version:${userId}:${guidePathname}`,
          guideVersion,
        );
    } catch {
      // El estado se conserva mientras la página siga abierta.
    }
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.helpButton}
        aria-expanded={open}
        aria-label={
          !canUseHelp || (newsRead && !guideChanged)
            ? 'Ayuda y novedades'
            : 'Ayuda y novedades, hay novedades'
        }
        onClick={openHelp}
      >
        <span aria-hidden="true">?</span>
        <span className={styles.buttonText}>Ayuda</span>
        {canUseHelp && (!newsRead || guideChanged) && (
          <span className={styles.badge} aria-hidden="true" />
        )}
      </button>
      {open && (
        <section className={styles.panel} aria-label="Ayuda y novedades">
          <div className={styles.heading}>
            <h2>Ayuda y novedades</h2>
            <button
              type="button"
              aria-label="Cerrar ayuda"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {!user?.tenant ? (
            <p className={styles.accessMessage} role="status">
              Debes estar unido a una empresa para consultar las guías y el
              manual de sus módulos.
            </p>
          ) : !canViewCurrentModule ? (
            <p className={styles.accessMessage} role="status">
              No tienes permiso para ver este módulo, por lo que su manual no
              está disponible.
            </p>
          ) : (
            <>
              {hasNews ? (
                <section className={styles.news} aria-label="Novedades">
                  <h3 className={styles.newsHeading}>
                    <span className={styles.newsHeadingLabel}>
                      <span className={styles.newsIcon} aria-hidden="true">
                        !
                      </span>
                      Novedades
                    </span>
                    <span className={styles.newsBadge}>Nuevo</span>
                  </h3>
                  {showGuideUpdate && (
                    <div className={styles.newsItem}>
                      <h4 className={styles.newsTitle}>Guía actualizada</h4>
                      <p>
                        El manual de {guides[guidePathname]?.title} cambió.
                        Consulta sus temas o vuelve a iniciar el recorrido para
                        conocer la información actualizada.
                      </p>
                    </div>
                  )}
                  {visibleNews.map((item) => (
                    <div key={item.id} className={styles.newsItem}>
                      <h4 className={styles.newsTitle}>{item.title}</h4>
                      <p>{item.description}</p>
                    </div>
                  ))}
                </section>
              ) : null}
              <p>Consulta cómo funciona el módulo en el que estás.</p>
              {guides[guidePathname] ? (
                <button
                  type="button"
                  className={styles.guideButton}
                  onClick={() => {
                    setOpen(false);
                    setRequest((previous) => ({
                      path: pathname,
                      id: (previous?.id ?? 0) + 1,
                    }));
                  }}
                >
                  <span aria-hidden="true" className={styles.guidePlay}>
                    ▶
                  </span>
                  <span>
                    <strong>Ver guía de {guides[guidePathname].title}</strong>
                    <small>Recorrido interactivo de 2 minutos</small>
                  </span>
                </button>
              ) : (
                <p>Abre un módulo para consultar su guía.</p>
              )}
              {topics.length > 0 && (
                <>
                  <h3>Manual de este módulo</h3>
                  {topics.map((item) => (
                    <details key={item.title} className={styles.topic}>
                      <summary>
                        <span aria-hidden="true" className={styles.topicIcon}>
                          <Image
                            alt=""
                            height={18}
                            src={manualTopicIcon(manualPathname, item.title)}
                            width={18}
                          />
                        </span>
                        <span>{item.title}</span>
                      </summary>
                      <p>{item.description}</p>
                    </details>
                  ))}
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
