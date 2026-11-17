'use client';

import { driver, type DriveStep } from 'driver.js';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { manualContent } from './manual-content';
import { findTarget, formGuides, pageSteps } from './interactive-guides';
import styles from './FirstVisitTour.module.css';

type GuideStep = {
  title: string;
  description: string;
  selector?: string;
  permission?: string;
};

type ModuleGuide = { title: string; description: string; steps: GuideStep[] };

// Añadir aquí cada novedad publicada y el permiso necesario para verla.
const announcements: {
  id: string;
  title: string;
  description: string;
  permission?: string;
}[] = [
  {
    id: 'manual-interactivo-v1',
    title: 'Guías interactivas',
    description: 'Puedes repetir la guía de cada módulo desde este menú.',
  },
];

const guides: Record<string, ModuleGuide> = {
  '/dashboard': {
    title: 'Resumen general',
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
          'Esta vista muestra eventos en borrador, planificados o en ejecución. Los finalizados y cancelados no permiten nuevas asignaciones aquí.',
      },
      {
        title: 'Actualizar eventos',
        description:
          'Vuelve a consultar la lista para ver cambios recientes. No asigna ni libera recursos.',
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
      'Consulta un resumen de eventos, recursos y presupuestos de tu empresa.',
    steps: [
      {
        title: 'Resumen operativo',
        description:
          'Las métricas se muestran según los permisos de consulta de tu perfil.',
        selector: '[aria-label="Resumen operativo"]',
      },
      {
        title: 'Detalle por evento',
        description:
          'Desplázate para consultar la información de eventos y presupuestos disponible.',
      },
      {
        title: 'Cómo leer los resultados',
        description:
          'Los datos resumen la información registrada en tu empresa. Los permisos de consulta determinan qué secciones puedes ver.',
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
    description: 'Consulta las cuentas de tu empresa y sus perfiles.',
    steps: [
      {
        title: 'Usuarios registrados',
        description:
          'Consulta los usuarios y las opciones disponibles según tus permisos.',
      },
      {
        title: 'Crear usuario',
        description:
          'Desde aquí puedes registrar una cuenta y asignarle un perfil.',
        selector: 'main section button',
        permission: 'usuarios.crear',
      },
      {
        title: 'Perfil del usuario',
        description:
          'El perfil asignado determina las acciones que la persona puede realizar en la empresa. Los cambios de permisos se gestionan desde Perfiles.',
      },
    ],
  },
  '/perfiles': {
    title: 'Perfiles y permisos',
    description:
      'Consulta los perfiles que determinan las acciones disponibles para los usuarios.',
    steps: [
      {
        title: 'Perfiles registrados',
        description:
          'Revisa los perfiles existentes de tu empresa y los permisos asociados.',
      },
      {
        title: 'Administrar permisos',
        description:
          'Si tienes permiso para gestionarlos, puedes crear o modificar perfiles según las responsabilidades del equipo.',
      },
      {
        title: 'Permisos y responsabilidades',
        description:
          'Configura los permisos según las tareas de cada perfil. Las personas con ese perfil comparten las acciones que se le hayan concedido.',
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
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const userId = user?.id;
  const permissions = user?.permissions;
  const isDeveloper = user?.isDeveloper;
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
  const topics = (manualContent[pathname] ?? []).filter(
    (item) =>
      !item.permission || isDeveloper || permissions?.includes(item.permission),
  );
  const guideVersion = JSON.stringify([
    guides[pathname],
    pageSteps[pathname],
    formGuides[pathname],
    topics,
  ]);

  useEffect(() => {
    if (!userId || !guides[pathname]) return;
    const timer = window.setTimeout(() => {
      try {
        const key = `evoria-guide-version:${userId}:${pathname}`;
        const previous = localStorage.getItem(key);
        setGuideChanged(previous !== null && previous !== guideVersion);
        if (previous === null) localStorage.setItem(key, guideVersion);
      } catch {
        setGuideChanged(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId, pathname, guideVersion]);

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
    const guide = guides[pathname];
    if (isLoading || !userId || !guide || !permissions) return;
    const storageKey = `evoria-module-tour:${userId}:${pathname}`;
    const requested =
      request?.path === pathname && request.id !== handledRequest.current;
    if (!requested && seenInSession.has(storageKey)) return;
    try {
      if (!requested && localStorage.getItem(storageKey) === 'done') return;
    } catch {
      // El recorrido sigue disponible si el navegador bloquea el almacenamiento.
    }

    let tour: ReturnType<typeof driver> | undefined;
    const timer = window.setInterval(() => {
      if (document.querySelector('dialog[open], .driver-active')) return;
      const main = document.querySelector<HTMLElement>('main');
      if (!main) return;
      window.clearInterval(timer);
      if (requested && request) handledRequest.current = request.id;

      const steps: DriveStep[] = [
        {
          popover: {
            title: `Conoce ${guide.title}`,
            description: `${guide.description} Puedes avanzar u omitir esta guía.`,
          },
        },
      ];
      for (const item of pageSteps[pathname] ?? []) {
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
        steps.push({
          element,
          popover: {
            title: item.title,
            description: item.description,
            side: 'bottom',
          },
        });
      }

      let openedDialog: HTMLDialogElement | null = null;
      let originalStyle = '';
      let cancelled = false;
      const closeTourDialog = () => {
        const dialog = openedDialog;
        openedDialog = null;
        if (!dialog?.isConnected) return;
        dialog.style.cssText = originalStyle;
        const close = dialog.querySelector<HTMLButtonElement>(
          'button[aria-label="Cerrar formulario"], button[aria-label="Cerrar ventana"]',
        );
        if (close && !close.disabled) close.click();
        else if (dialog.open) dialog.close();
      };
      const formGuide = formGuides[pathname];
      const createButton =
        formGuide && (isDeveloper || permissions.includes(formGuide.permission))
          ? Array.from(main.querySelectorAll<HTMLButtonElement>('button')).find(
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
              'Al avanzar abriremos el formulario para explicarlo. No se guardará ningún dato.',
            side: 'bottom',
            onNextClick: () => {
              if (!tour?.isActive()) return;
              createButton.click();
              const started = Date.now();
              const openForm = () => {
                const dialog =
                  main.querySelector<HTMLDialogElement>('dialog[open]');
                if (cancelled || !tour?.isActive()) {
                  if (dialog) {
                    openedDialog = dialog;
                    originalStyle = dialog.style.cssText;
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
                openedDialog = dialog;
                originalStyle = dialog.style.cssText;
                // El diálogo nativo está en la capa superior del navegador; durante
                // la guía se muestra como no modal para que Driver pueda resaltarlo.
                dialog.close();
                dialog.show();
                Object.assign(dialog.style, {
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  margin: '0',
                });
                window.requestAnimationFrame(() => {
                  if (!cancelled && tour?.isActive()) tour.moveNext();
                  else closeTourDialog();
                });
              };
              window.requestAnimationFrame(openForm);
            },
          },
        });
        formGuide.fields.forEach((item, index) => {
          steps.push({
            element: () =>
              (openedDialog &&
                (findTarget(openedDialog, item) ||
                  openedDialog.querySelector<HTMLElement>('h2'))) ||
              main,
            popover: {
              title: item.title,
              description: item.description,
              side: 'bottom',
              ...(index === 0
                ? {
                    onPrevClick: () => {
                      closeTourDialog();
                      tour?.movePrevious();
                    },
                  }
                : {}),
            },
          });
        });
      }
      steps.push({
        popover: {
          title: 'Todo listo',
          description:
            'Ya conoces las opciones disponibles. Puedes repetir la guía desde Ayuda.',
          ...(formGuide && createButton
            ? {
                onPrevClick: () => {
                  tour?.movePrevious();
                },
              }
            : {}),
        },
      });

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
        onPopoverRender: (popover) => {
          popover.closeButton.textContent = 'Omitir';
        },
        onDestroyed: (_element, _step, { reason }) => {
          cancelled = true;
          closeTourDialog();
          if (reason === 'api' || reason === 'replaced') return;
          seenInSession.add(storageKey);
          try {
            localStorage.setItem(storageKey, 'done');
          } catch {
            // La preferencia se conserva durante la sesión si el almacenamiento está bloqueado.
          }
        },
        steps,
      });
      tour.drive();
    }, 500);

    return () => {
      window.clearInterval(timer);
      tour?.destroy();
    };
  }, [isLoading, userId, pathname, permissions, isDeveloper, request]);

  if (!userId) return null;

  function openHelp() {
    if (!open) setShowGuideUpdate(guideChanged);
    setOpen((current) => !current);
    setNewsRead(true);
    setGuideChanged(false);
    try {
      visibleNews.forEach((item) =>
        localStorage.setItem(`evoria-news:${userId}:${item.id}`, 'read'),
      );
      if (guides[pathname])
        localStorage.setItem(
          `evoria-guide-version:${userId}:${pathname}`,
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
          newsRead && !guideChanged
            ? 'Ayuda y novedades'
            : 'Ayuda y novedades, hay novedades'
        }
        onClick={openHelp}
      >
        <span aria-hidden="true">?</span>
        <span className={styles.buttonText}>Ayuda</span>
        {(!newsRead || guideChanged) && (
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
          <p>Consulta cómo funciona el módulo en el que estás.</p>
          {guides[pathname] ? (
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
              Ver guía de {guides[pathname].title}
            </button>
          ) : (
            <p>Abre un módulo para consultar su guía.</p>
          )}
          {topics.length > 0 && (
            <>
              <h3>Manual de este módulo</h3>
              {topics.map((item) => (
                <details key={item.title} className={styles.topic}>
                  <summary>{item.title}</summary>
                  <p>{item.description}</p>
                </details>
              ))}
            </>
          )}
          <h3>Novedades</h3>
          {showGuideUpdate && (
            <div>
              <h4 className={styles.newsTitle}>Guía actualizada</h4>
              <p>
                El manual de {guides[pathname]?.title} cambió. Consulta sus
                temas o vuelve a iniciar el recorrido para conocer la
                información actualizada.
              </p>
            </div>
          )}
          {visibleNews.map((item) => (
            <div key={item.id}>
              <h4 className={styles.newsTitle}>{item.title}</h4>
              <p>{item.description}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
