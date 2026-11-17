export type InteractiveStep = {
  title: string;
  description: string;
  selector?: string;
  text?: string;
  permission?: string;
};

export type FormGuide = {
  permission: string;
  button: string;
  fields: InteractiveStep[];
};

// Estos selectores señalan controles existentes sin modificar los módulos.
export const pageSteps: Record<string, InteractiveStep[]> = {
  '/dashboard': [
    {
      title: 'Actualizar datos',
      text: 'Actualizar datos',
      description:
        'Consulta de nuevo los indicadores y la actividad de tu empresa.',
    },
    {
      title: 'Indicadores principales',
      selector: '[aria-label="Métricas principales"]',
      description:
        'Estas tarjetas resumen los datos disponibles para tu perfil en la empresa activa.',
    },
    {
      title: 'Eventos por estado',
      text: 'Eventos por estado',
      description: 'Compara cuántos eventos hay en cada etapa.',
    },
    {
      title: 'Presupuesto por evento',
      text: 'Presupuesto por evento',
      description:
        'Consulta los importes y la ejecución disponibles por evento.',
    },
    {
      title: 'Próximos eventos',
      text: 'Próximos eventos',
      description: 'Revisa los eventos cercanos y sus fechas.',
    },
  ],
  '/empresas': [
    {
      title: 'Empresa activa',
      selector: '[aria-label="Empresa activa"]',
      description:
        'Aquí ves la empresa en la que trabajas y las opciones para entrar al dashboard o salir.',
    },
    {
      title: 'Información del propietario',
      selector: '[aria-label="Información del propietario"]',
      description: 'Consulta el nombre, correo y NIT cuando están disponibles.',
    },
    {
      title: 'Contexto operativo',
      selector: '[aria-label="Contexto operativo"]',
      description:
        'Describe el sector, la modalidad y los tipos de eventos de la empresa; no asigna permisos.',
    },
    {
      title: 'Editar contexto',
      text: 'Editar contexto',
      permission: 'empresa_contexto.editar',
      description:
        'Actualiza la información operativa cuando cambie la forma de trabajar de la empresa.',
    },
    {
      title: 'Elegir empresa',
      selector: '[aria-label="Mi empresa"]',
      description:
        'Desde aquí puedes elegir una empresa disponible para trabajar.',
    },
  ],
  '/eventos': [
    {
      title: 'Filtrar por estado',
      selector: '[aria-label="Resumen de eventos"]',
      description:
        'Filtra los eventos por su estado y consulta las cantidades de cada grupo.',
    },
    {
      title: 'Buscar eventos',
      selector: '#event-search',
      description: 'Busca por nombre o fecha para localizar un evento.',
    },
    {
      title: 'Listado de eventos',
      selector: '.events-table',
      description:
        'Consulta fechas, ubicación y estado. Las acciones de cada fila dependen de tus permisos.',
    },
  ],
  '/inventario': [
    {
      title: 'Resumen del inventario',
      selector: '[aria-label="Resumen de inventario"]',
      description: 'Revisa el resumen de recursos y cantidades de la empresa.',
    },
    {
      title: 'Buscar recursos',
      selector: '[aria-label="Recursos del inventario"] input',
      description: 'Busca un recurso por su nombre.',
    },
    {
      title: 'Filtrar por categoría',
      selector: '[aria-label="Recursos del inventario"] select',
      description: 'Selecciona una categoría para reducir los resultados.',
    },
    {
      title: 'Recursos del inventario',
      selector: '[aria-label="Recursos del inventario"]',
      description:
        'Cada tarjeta muestra sus datos y cantidades, incluidas las reservas disponibles para consulta.',
    },
  ],
  '/recursos/asignaciones': [
    {
      title: 'Actualizar eventos',
      text: 'Actualizar eventos',
      description: 'Actualiza la lista; no guarda ni modifica asignaciones.',
    },
    {
      title: 'Elegir un evento',
      selector: '[aria-label="Eventos activos para asignar recursos"]',
      description:
        'Abre un evento activo para consultar sus reservas y servicios. Los eventos cancelados o finalizados no aparecen aquí.',
    },
    {
      title: 'Ver inventario',
      text: 'Ver inventario',
      permission: 'inventario.ver',
      description: 'Abre inventario para consultar los recursos de la empresa.',
    },
  ],
  '/proveedores': [
    {
      title: 'Buscar proveedores',
      selector: '[aria-label="Directorio de proveedores"] input',
      description: 'Busca por nombre o contacto.',
    },
    {
      title: 'Filtrar categorías',
      selector: '[aria-label="Categoría"]',
      description: 'Limita el directorio a una categoría de servicio.',
    },
    {
      title: 'Directorio',
      selector: '[aria-label="Directorio de proveedores"]',
      description:
        'Consulta el estado y los datos de cada proveedor y las acciones disponibles para tu perfil.',
    },
  ],
  '/presupuestos': [
    {
      title: 'Actualizar',
      text: 'Actualizar',
      description: 'Consulta de nuevo los presupuestos y las solicitudes.',
    },
    {
      title: 'Autorizaciones pendientes',
      text: 'Autorizaciones pendientes',
      permission: 'presupuestos.aprobar',
      description: 'Revisa las solicitudes que necesitan una decisión.',
    },
    {
      title: 'Presupuesto por evento',
      selector: '[aria-label="Eventos activos"]',
      description:
        'Abre un evento para consultar saldo, gastos y solicitudes; la tarjeta indica si falta iniciar su presupuesto.',
    },
  ],
  '/cronograma': [
    {
      title: 'Seleccionar evento',
      selector: '.events-list-panel select',
      description: 'Elige el evento para ver sus actividades.',
    },
    {
      title: 'Actividades programadas',
      selector: '.events-list-panel',
      description:
        'Consulta fecha, responsable, estado y acciones disponibles de cada actividad.',
    },
  ],
  '/alertas': [
    {
      title: 'Categoría',
      selector: '[aria-label="Filtrar por categoría"]',
      description: 'Escoge la categoría de avisos que quieres consultar.',
    },
    {
      title: 'Filtros de alertas',
      selector: '[aria-label="Filtros de alertas"]',
      description:
        'Combina los filtros para ver alertas leídas, sin leer o de un tipo específico.',
    },
  ],
  '/reportes': [
    {
      title: 'Resumen operativo',
      selector: '[aria-label="Resumen operativo"]',
      description:
        'Las tarjetas muestran los datos disponibles de eventos y recursos.',
    },
    {
      title: 'Presupuesto por evento',
      selector: '[aria-label="Reporte de presupuesto por evento"]',
      description:
        'Compara los importes y la ejecución de los presupuestos disponibles.',
    },
    {
      title: 'Eventos registrados',
      selector: '[aria-label="Reporte de eventos"]',
      description: 'Consulta el detalle de eventos registrado por la empresa.',
    },
  ],
  '/auditoria': [
    {
      title: 'Filtros del historial',
      text: 'Filtra los registros',
      description:
        'Selecciona los criterios para localizar acciones de la empresa.',
    },
    {
      title: 'Consultar',
      text: 'Consultar',
      description: 'Aplica los filtros y carga los registros que coinciden.',
    },
    {
      title: 'Historial de acciones',
      text: 'Historial de acciones',
      description:
        'Consulta los registros y sus detalles; el límite controla la cantidad solicitada.',
    },
  ],
  '/usuarios': [
    {
      title: 'Usuarios registrados',
      text: 'Usuarios registrados',
      description: 'Consulta las cuentas, su estado y perfil en la empresa.',
    },
  ],
  '/perfiles': [
    {
      title: 'Resumen de perfiles',
      text: 'Perfiles registrados',
      description: 'Consulta las cantidades de perfiles y permisos asignados.',
    },
    {
      title: 'Perfiles de la empresa',
      text: 'Perfiles registrados',
      description:
        'Revisa los perfiles y las acciones disponibles según tu acceso.',
    },
  ],
  '/mi-perfil': [
    {
      title: 'Mi perfil',
      selector: 'main',
      description:
        'Consulta los datos de tu cuenta y las opciones de acceso disponibles.',
    },
  ],
};

export const formGuides: Record<string, FormGuide> = {
  '/eventos': {
    permission: 'eventos.crear',
    button: 'Nuevo evento',
    fields: [
      {
        title: 'Nombre del evento',
        text: 'Nombre',
        description: 'Identifica el evento para poder encontrarlo en la lista.',
      },
      {
        title: 'Descripción',
        text: 'Descripción',
        description: 'Explica el propósito y los detalles del evento.',
      },
      {
        title: 'Fechas y horas',
        selector: '[aria-label="Seleccionar rango de fechas"]',
        description:
          'Define el periodo del evento; las horas de inicio y finalización se completan en los campos siguientes.',
      },
      {
        title: 'Tipo de evento',
        text: 'Tipo',
        description: 'Selecciona un tipo configurado para tu empresa.',
      },
      {
        title: 'Presupuesto base',
        text: 'Presupuesto base',
        description: 'Indica el valor inicial en pesos colombianos.',
      },
      {
        title: 'Persona responsable',
        text: 'Persona responsable',
        description: 'Selecciona a la persona que estará a cargo del evento.',
      },
      {
        title: 'Guardar evento',
        text: 'Guardar evento',
        description:
          'Después de completar los datos puedes guardarlo. El tutorial no creará ningún evento.',
      },
    ],
  },
  '/proveedores': {
    permission: 'proveedores.crear',
    button: 'Crear proveedor',
    fields: [
      {
        title: 'Nombre',
        text: 'Nombre',
        description: 'Escribe el nombre que identifica al proveedor.',
      },
      {
        title: 'Persona de contacto',
        text: 'Persona de contacto',
        description:
          'Este dato es opcional y permite identificar a quien atiende la relación.',
      },
      {
        title: 'Teléfono y correo',
        text: 'Teléfono',
        description:
          'Registra los datos de contacto obligatorios del proveedor.',
      },
      {
        title: 'Ubicación',
        text: 'Ubicación',
        description: 'Indica la ubicación del proveedor.',
      },
      {
        title: 'Categorías',
        text: 'Categorías',
        description:
          'Selecciona una o más categorías de los servicios que ofrece.',
      },
      {
        title: 'Notas',
        text: 'Notas',
        description:
          'Agrega la información requerida para describir al proveedor.',
      },
      {
        title: 'Guardar proveedor',
        text: 'Guardar proveedor',
        description:
          'Guarda cuando completes los datos. El recorrido no creará ningún proveedor.',
      },
    ],
  },
  '/cronograma': {
    permission: 'cronogramas.crear',
    button: 'Nueva actividad',
    fields: [
      {
        title: 'Evento',
        text: 'Evento',
        description: 'Selecciona el evento al que corresponde la actividad.',
      },
      {
        title: 'Nombre de la actividad',
        text: 'Nombre de la actividad',
        description: 'Identifica la tarea que se va a realizar.',
      },
      {
        title: 'Fechas de la actividad',
        selector: '[aria-label="Seleccionar rango de fechas"]',
        description:
          'Programa las fechas dentro del periodo permitido del evento.',
      },
      {
        title: 'Responsable',
        text: 'Responsable',
        description: 'Puedes asociar una persona responsable de la actividad.',
      },
      {
        title: 'Guardar actividad',
        text: 'Guardar actividad',
        description:
          'Guarda después de completar los datos. El tutorial no creará actividades.',
      },
    ],
  },
  '/usuarios': {
    permission: 'usuarios.crear',
    button: 'Nuevo usuario',
    fields: [
      {
        title: 'Datos de la cuenta',
        selector: 'form',
        description:
          'Completa los datos que identifican al usuario de la empresa.',
      },
      {
        title: 'Contraseña y perfil',
        selector: 'input[type="password"]',
        description:
          'Configura las credenciales y selecciona el perfil que define sus permisos.',
      },
      {
        title: 'Guardar',
        selector: 'button[type="submit"]',
        description:
          'Confirma la creación cuando los datos estén completos. El tutorial no creará una cuenta.',
      },
    ],
  },
  '/perfiles': {
    permission: 'perfiles.crear',
    button: 'Nuevo perfil',
    fields: [
      {
        title: 'Nombre del perfil',
        selector: '[aria-label="Nombre del perfil"]',
        description:
          'Escribe un nombre que identifique las responsabilidades del perfil.',
      },
      {
        title: 'Permisos por módulo',
        text: 'Módulos del sistema',
        description:
          'Revisa los módulos y activa las acciones que necesita el perfil.',
      },
      {
        title: 'Buscar módulo',
        selector: '[placeholder="Buscar módulo..."]',
        description: 'Localiza rápidamente los permisos de un módulo.',
      },
      {
        title: 'Guardar perfil',
        selector: 'button[type="submit"]',
        description:
          'Guarda solo después de revisar los permisos. El tutorial no creará ningún perfil.',
      },
    ],
  },
};

export function findTarget(
  root: ParentNode,
  step: InteractiveStep,
): HTMLElement | null {
  if (step.selector === 'main')
    return document.querySelector<HTMLElement>('main');
  if (step.selector) return root.querySelector<HTMLElement>(step.selector);
  if (!step.text) return null;
  const text = step.text.toLocaleLowerCase('es');
  const candidates = root.querySelectorAll<HTMLElement>(
    'label, legend, button, a, h1, h2, h3, h4',
  );
  return (
    Array.from(candidates).find((element) =>
      element.textContent?.trim().toLocaleLowerCase('es').includes(text),
    ) ?? null
  );
}
