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
  triggerSelector?: string;
  skipMissingFields?: boolean;
  preserveDialogDuringTour?: boolean;
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
    {
      title: 'Ver detalles del evento',
      text: 'Ver detalles',
      description:
        'Abre una consulta del evento sin modificarlo. Allí puedes revisar su descripción, fechas, estado, presupuesto, responsable y ubicación en el mapa.',
    },
    {
      title: 'Próximo en tu agenda',
      selector: '.events-upcoming',
      description:
        'Esta tarjeta destaca el evento activo más cercano. Puedes abrirlo desde aquí para consultar sus detalles.',
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
  '/equipos': [
    {
      title: 'Equipos registrados',
      text: 'Equipos registrados',
      description:
        'Consulta los equipos de la empresa, su especialidad, integrantes y estado actual.',
    },
    {
      title: 'Crear equipo',
      text: 'Crear equipo',
      permission: 'equipos.crear',
      description:
        'Completa el nombre y la especialidad para identificar el equipo de trabajo.',
    },
    {
      title: 'Integrantes y líder',
      text: 'Integrantes',
      permission: 'equipos.crear',
      description:
        'Selecciona usuarios activos y luego escoge un líder entre las personas que agregaste al equipo.',
    },
    {
      title: 'Desactivar equipo',
      text: 'Desactivar',
      permission: 'equipos.desactivar',
      description:
        'Esta acción solicita una confirmación y deja el equipo inactivo. La guía no lo desactiva.',
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
  '/inventario': {
    permission: 'inventario.ver',
    button: 'Ver detalle',
    skipMissingFields: true,
    preserveDialogDuringTour: true,
    fields: [
      {
        title: 'Detalle del recurso',
        selector: 'h2',
        description:
          'Esta vista consulta el recurso seleccionado sin modificarlo. En el título identificas el recurso que estás revisando.',
      },
      {
        title: 'Disponibilidad y costo',
        selector: 'dl',
        description:
          'Estas tarjetas muestran la cantidad total, las unidades disponibles, las reservadas para eventos y el costo unitario registrado.',
      },
      {
        title: 'Editar recurso',
        text: 'Editar recurso',
        permission: 'inventario.ajustar',
        description:
          'Abre el formulario para actualizar el recurso. Solo aparece para perfiles que pueden gestionar inventario.',
      },
      {
        title: 'Desactivar recurso',
        text: 'Desactivar recurso',
        permission: 'inventario.ajustar',
        description:
          'Solicita confirmación antes de sacar el recurso de la disponibilidad para nuevas asignaciones. La guía no ejecuta esta acción.',
      },
      {
        title: 'Cerrar detalle',
        text: 'Cerrar',
        description:
          'Cierra esta consulta y regresa al listado. El recorrido lo hará automáticamente al finalizar u omitir, sin hacer cambios.',
      },
    ],
  },
  '/recursos/asignaciones': {
    permission: 'eventos.ver',
    button: 'Ver detalles y asignar',
    triggerSelector: '[aria-label^="Ver asignaciones de "]',
    skipMissingFields: true,
    fields: [
      {
        title: 'Detalle del evento',
        selector: '.grid.min-w-0.gap-6',
        description:
          'Aquí consultas el evento seleccionado, su estado, fechas y las asignaciones disponibles para tu perfil.',
      },
      {
        title: 'Actualizar evento',
        text: 'Actualizar evento',
        description:
          'Actualiza la información después de añadir o liberar un recurso o asignar un servicio. Si no hubo cambios, verás una advertencia.',
      },
      {
        title: 'Reservas de inventario',
        selector: '[aria-label="Reservas de inventario"] h3',
        permission: 'asignaciones.ver',
        description:
          'Consulta los recursos reservados para el evento y sus cantidades. Las unidades reservadas dejan de estar disponibles para otras asignaciones.',
      },
      {
        title: 'Seleccionar recurso',
        selector: '[aria-label="Reservas de inventario"] select',
        permission: 'asignaciones.crear',
        description:
          'Elige un recurso disponible. Este campo aparece cuando tienes acceso al inventario y el presupuesto permite asignaciones.',
      },
      {
        title: 'Cantidad',
        selector: '[aria-label="Reservas de inventario"] input[type="number"]',
        permission: 'asignaciones.crear',
        description:
          'Indica cuántas unidades necesitas; no puedes superar la cantidad disponible.',
      },
      {
        title: 'Asignar recurso',
        selector: '[aria-label="Reservas de inventario"] button[type="submit"]',
        permission: 'asignaciones.crear',
        description:
          'Reserva el recurso y la cantidad elegidos. El botón se habilita cuando se cumplen los requisitos. La guía no hará ninguna reserva.',
      },
      {
        title: 'Liberar recurso',
        text: 'Liberar recurso',
        permission: 'asignaciones.eliminar',
        description:
          'Devuelve las unidades reservadas de ese recurso al inventario. La acción solicita confirmación y la guía no la ejecutará.',
      },
      {
        title: 'Servicios de proveedores',
        selector: '[aria-label="Servicios de proveedores"] h3',
        permission: 'servicios_proveedor.ver',
        description:
          'Consulta los servicios contratados para el evento y sus valores. Los acuerdos confirmados cuentan como gasto del presupuesto.',
      },
      {
        title: 'Asignar servicio',
        text: 'Asignar servicio',
        permission: 'servicios_proveedor.crear',
        description:
          'Abre el formulario para registrar un servicio de proveedor. Requiere acceso a proveedores y cumplir los requisitos de presupuesto.',
      },
      {
        title: 'Cerrar evento',
        text: 'Cerrar evento',
        description:
          'Vuelve a la lista de eventos. El recorrido cierra el detalle al finalizar u omitir sin hacer cambios.',
      },
    ],
  },
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
        title: 'Ubicación exacta',
        selector:
          '[aria-label="Mapa para seleccionar la ubicación exacta del evento"]',
        description:
          'Busca el lugar por nombre o dirección y selecciónalo en los resultados; también puedes hacer clic directamente en el punto del mapa. La dirección seleccionada se guarda como la ubicación obligatoria del evento.',
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
        title: 'Nombre del proveedor',
        selector: '[data-tour-field="name"]',
        description:
          'Escribe el nombre comercial o razón social con el que identificarás al proveedor en el directorio y al asignar servicios.',
      },
      {
        title: 'Persona de contacto',
        selector: '[data-tour-field="contactName"]',
        description:
          'Es el único dato opcional. Registra a la persona que atiende la relación comercial si cuentas con esa información.',
      },
      {
        title: 'Teléfono',
        selector: '[data-tour-field="phone"]',
        description:
          'Registra un número de contacto obligatorio para comunicarse con el proveedor.',
      },
      {
        title: 'Correo',
        selector: '[data-tour-field="email"]',
        description:
          'Registra un correo electrónico obligatorio. Evoria lo valida antes de crear el proveedor.',
      },
      {
        title: 'Ubicación',
        selector: '[data-tour-field="location"]',
        description:
          'Indica la dirección o ciudad desde la que opera. Este dato es obligatorio al crear el proveedor.',
      },
      {
        title: 'Categorías',
        selector: '[aria-label="Categorías del proveedor"]',
        description:
          'Selecciona una o más categorías para clasificar los servicios que ofrece. Debes elegir al menos una.',
      },
      {
        title: 'Notas del proveedor',
        selector: '[data-tour-field="notes"]',
        description:
          'Agrega información útil para el equipo, como condiciones, horarios o acuerdos. Es obligatoria al crear el proveedor.',
      },
      {
        title: 'Guardar proveedor',
        selector: 'button[type="submit"]',
        description:
          'Al completar los campos obligatorios, guarda el proveedor para poder registrar y asignar sus servicios. El recorrido no creará ningún proveedor.',
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
