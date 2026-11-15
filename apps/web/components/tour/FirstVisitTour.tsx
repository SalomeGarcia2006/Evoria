'use client';

import { driver, type DriveStep } from 'driver.js';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

type GuideStep = {
  title: string;
  description: string;
  selector?: string;
  permission?: string;
};

type ModuleGuide = { title: string; description: string; steps: GuideStep[] };

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

  useEffect(() => {
    const guide = guides[pathname];
    if (isLoading || !userId || !guide || !permissions) return;
    const storageKey = `evoria-module-tour:${userId}:${pathname}`;
    if (seenInSession.has(storageKey)) return;
    try {
      if (localStorage.getItem(storageKey) === 'done') return;
    } catch {
      // El recorrido sigue disponible si el navegador bloquea el almacenamiento.
    }

    let tour: ReturnType<typeof driver> | undefined;
    const timer = window.setInterval(() => {
      if (document.querySelector('dialog[open], .driver-active')) return;
      const main = document.querySelector<HTMLElement>('main');
      if (!main) return;
      window.clearInterval(timer);

      const steps: DriveStep[] = [
        {
          popover: {
            title: `Conoce ${guide.title}`,
            description: `${guide.description} Puedes avanzar u omitir esta guía.`,
          },
        },
      ];
      for (const item of guide.steps) {
        if (
          item.permission &&
          !isDeveloper &&
          !permissions.includes(item.permission)
        )
          continue;
        const element = item.selector
          ? main.querySelector<HTMLElement>(item.selector)
          : null;
        const visible =
          element &&
          element.getClientRects().length &&
          !element.closest('dialog:not([open])');
        steps.push({
          ...(visible ? { element } : {}),
          popover: {
            title: item.title,
            description: item.description,
            side: 'bottom',
          },
        });
      }
      steps.push({
        popover: {
          title: 'Todo listo',
          description:
            'Puedes comenzar a usar este módulo. Las acciones disponibles dependen de tu perfil.',
        },
      });

      tour = driver({
        animate: true,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
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
  }, [isLoading, userId, pathname, permissions, isDeveloper]);

  return null;
}
