export type ManualTopic = {
  title: string;
  description: string;
  permission?: string;
};

// Cada entrada describe una función existente; el permiso oculta acciones no disponibles.
export const manualContent: Record<string, ManualTopic[]> = {
  '/dashboard': [
    {
      title: 'Actualizar datos',
      description:
        'Vuelve a consultar la información del resumen para reflejar cambios recientes.',
    },
    {
      title: 'Métricas principales',
      description:
        'Las tarjetas resumen la operación de la empresa activa. Su contenido depende de los permisos y de la información registrada.',
    },
    {
      title: 'Eventos por estado',
      description:
        'Agrupa los eventos según su estado para ayudar a entender en qué etapa se encuentra la operación.',
    },
    {
      title: 'Presupuesto por evento',
      description:
        'Muestra la información presupuestal disponible para cada evento y su ejecución cuando corresponde.',
    },
    {
      title: 'Próximos eventos',
      description:
        'Consulta los eventos próximos y sus datos disponibles para tu perfil.',
    },
  ],
  '/empresas': [
    {
      title: 'Empresa activa y salir',
      description:
        'La tarjeta identifica la empresa en la que trabajas. Salir permite regresar a la selección de empresas; tus accesos dependen de tu vinculación y perfil.',
    },
    {
      title: 'Información del propietario',
      description:
        'Presenta nombre, correo y NIT cuando están disponibles para la cuenta y la empresa.',
    },
    {
      title: 'Contexto operativo',
      description:
        'El sector, la modalidad, la descripción, los tipos de eventos y las notas explican cómo trabaja la empresa. No asignan permisos.',
    },
    {
      title: 'Editar contexto',
      description:
        'Permite modificar los datos disponibles. Revisa los cambios y confirma la actualización; si no cambias nada, se muestra una advertencia.',
      permission: 'empresa_contexto.editar',
    },
    {
      title: 'Crear o seleccionar empresa',
      description:
        'Desde plataforma, el desarrollador puede registrar una empresa o acceder a una existente según las opciones disponibles.',
    },
  ],
  '/eventos': [
    {
      title: 'Buscar y consultar',
      description:
        'Busca por nombre o fecha y abre un evento para consultar su estado, ubicación, fechas, responsable y presupuesto base.',
    },
    {
      title: 'Ver detalles del evento',
      description:
        'Abre una vista de consulta sin modificar el evento. Muestra descripción, fechas, estado, presupuesto, persona responsable y la ubicación seleccionada en el mapa.',
    },
    {
      title: 'Próximo en tu agenda',
      description:
        'Destaca el evento activo más cercano. Solo se muestra cuando existe un evento futuro que no está cancelado ni finalizado.',
    },
    {
      title: 'Nuevo evento',
      description:
        'Abre el formulario para registrar el evento. Completa nombre, fechas, horas, tipo, lugar y responsable según las validaciones que indique el formulario.',
      permission: 'eventos.crear',
    },
    {
      title: 'Tipo de evento',
      description:
        'El selector utiliza los tipos disponibles para la empresa. Si no encuentras uno, revisa los tipos configurados en el contexto operativo.',
    },
    {
      title: 'Editar y cambiar estado',
      description:
        'Las acciones del evento dependen de sus permisos y estado. Revisa los datos antes de confirmar cambios; algunas acciones solicitan confirmación escrita.',
    },
    {
      title: 'Relación con otros módulos',
      description:
        'El evento agrupa el trabajo de recursos, servicios, presupuesto y cronograma. Su estado puede limitar las acciones disponibles.',
    },
  ],
  '/inventario': [
    {
      title: 'Resumen y disponibilidad',
      description:
        'Consulta cantidades totales y reservadas para entender cuánto inventario está comprometido.',
    },
    {
      title: 'Buscar y filtrar',
      description:
        'Busca un recurso por nombre o selecciona una categoría. Si no hay resultados, revisa los filtros.',
    },
    {
      title: 'Tarjeta del recurso',
      description:
        'Presenta su categoría, datos y cantidades. Abre las opciones disponibles para consultar o gestionar el recurso según tus permisos.',
    },
    {
      title: 'Ver detalle',
      description:
        'Abre una consulta del recurso sin modificarlo. Muestra descripción, cantidades totales, disponibles y reservadas, además del costo unitario y las acciones permitidas para tu perfil.',
    },
    {
      title: 'Relación con asignaciones',
      description:
        'Las reservas para un evento se gestionan desde Recursos y afectan la disponibilidad mostrada en inventario.',
    },
  ],
  '/recursos/asignaciones': [
    {
      title: 'Actualizar eventos',
      description:
        'Consulta nuevamente los eventos activos. Este botón no crea, modifica ni libera asignaciones.',
    },
    {
      title: 'Eventos disponibles',
      description:
        'Aparecen eventos creados, planificados o en ejecución. Los finalizados y cancelados no permiten nuevas asignaciones desde esta vista.',
    },
    {
      title: 'Abrir una tarjeta',
      description:
        'Muestra la información del evento y sus reservas y servicios. Es necesario contar con los permisos de consulta correspondientes.',
    },
    {
      title: 'Reservar y liberar recursos',
      description:
        'Dentro del evento selecciona el recurso y la cantidad para reservar. La liberación requiere confirmación; la disponibilidad y los permisos condicionan la operación.',
    },
    {
      title: 'Asignar servicios',
      description:
        'Consulta los servicios disponibles de proveedores y asigna los necesarios al evento cuando tu perfil y el presupuesto lo permitan.',
    },
    {
      title: 'Actualizar información',
      description:
        'Confirma los cambios realizados. Si no se añadió o liberó un recurso ni se asignó un servicio, se indica por qué no hay una actualización que guardar.',
    },
  ],
  '/proveedores': [
    {
      title: 'Buscar y filtrar',
      description:
        'Combina la búsqueda por nombre o contacto con los filtros de categoría y estado.',
    },
    {
      title: 'Crear proveedor',
      description:
        'Registra nombre, categorías, teléfono, correo, ubicación y notas. La persona de contacto es opcional; el formulario indica los datos que faltan.',
      permission: 'proveedores.crear',
    },
    {
      title: 'Editar proveedor',
      description:
        'Actualiza los datos desde la tarjeta y confirma la operación con Actualizar información.',
      permission: 'proveedores.editar',
    },
    {
      title: 'Desactivar proveedor',
      description:
        'La desactivación requiere confirmación escrita. El proveedor deja de estar disponible para nuevos servicios; consulta el aviso antes de confirmar.',
      permission: 'proveedores.desactivar',
    },
    {
      title: 'Servicios',
      description:
        'Consulta y administra los servicios asociados al proveedor según tus permisos; estos pueden utilizarse al organizar eventos.',
    },
  ],
  '/presupuestos': [
    {
      title: 'Actualizar',
      description:
        'Vuelve a consultar los datos y solicitudes disponibles del módulo.',
    },
    {
      title: 'Tarjetas de eventos',
      description:
        'Abre un evento activo para consultar su presupuesto. La tarjeta indica si todavía falta iniciar el presupuesto.',
    },
    {
      title: 'Montos y ejecución',
      description:
        'Consulta el presupuesto, los gastos y el saldo disponible. El porcentaje resume cuánto se ha utilizado cuando hay datos para calcularlo.',
    },
    {
      title: 'Solicitar cambios',
      description:
        'Utiliza las operaciones disponibles para registrar una solicitud. Sus requisitos y la acción de aprobación dependen de tus permisos.',
    },
    {
      title: 'Autorizaciones pendientes',
      description:
        'Abre las solicitudes que requieren decisión. Solo aparece para perfiles con permiso de aprobación.',
      permission: 'presupuestos.aprobar',
    },
    {
      title: 'Historial y decisiones',
      description:
        'Consulta las solicitudes, decisiones y movimientos disponibles para comprender cómo cambió el presupuesto.',
    },
  ],
  '/cronograma': [
    {
      title: 'Seleccionar evento',
      description:
        'Elige el evento cuyo cronograma deseas consultar; la lista de actividades corresponde a esa selección.',
    },
    {
      title: 'Crear actividad',
      description:
        'Registra la información, fecha, hora y responsable que solicite el formulario. La aplicación valida los datos antes de guardar.',
      permission: 'cronogramas.crear',
    },
    {
      title: 'Lista de actividades',
      description:
        'La tabla muestra actividad, fecha y hora, responsable, estado y acciones disponibles para tu perfil.',
    },
    {
      title: 'Modificar una actividad',
      description:
        'Usa las acciones de la fila si están disponibles. El estado del evento y los permisos pueden restringir su edición.',
    },
  ],
  '/equipos': [
    {
      title: 'Equipos registrados',
      description:
        'Busca por nombre, especialidad, líder o integrante y filtra por estado. La tabla muestra cinco equipos por página; las tarjetas resumen los equipos y las personas únicas de equipos activos.',
    },
    {
      title: 'Crear equipo',
      description:
        'Registra un nombre de 2 a 120 caracteres y selecciona una especialidad del catálogo. Para guardarlo debes elegir de 1 a 200 usuarios activos y definir a uno de ellos como líder.',
      permission: 'equipos.crear',
    },
    {
      title: 'Integrantes y liderazgo',
      description:
        'Solo puedes elegir usuarios activos y una persona no puede pertenecer a dos equipos activos. El líder debe estar incluido entre los integrantes. Necesitas permiso para consultar usuarios.',
      permission: 'usuarios.ver',
    },
    {
      title: 'Editar equipo',
      description:
        'Puedes actualizar los datos de un equipo activo. Al cambiar sus integrantes se vuelven a validar el estado activo, la pertenencia a otro equipo y el líder.',
      permission: 'equipos.editar',
    },
    {
      title: 'Desactivar equipo',
      description:
        'Debes escribir DESACTIVAR para confirmar. No se puede desactivar un equipo ligado a actividades no canceladas cuyo fin aún esté en el futuro, ni reactivarlo desde la plataforma.',
      permission: 'equipos.desactivar',
    },
    {
      title: 'Equipos en cronogramas',
      description:
        'Solo los equipos activos pueden asignarse a actividades. El sistema comprueba la disponibilidad del equipo y evita conflictos de horario.',
    },
  ],
  '/alertas': [
    {
      title: 'Categoría de alerta',
      description:
        'Selecciona una categoría para concentrarte en un tipo de aviso de la operación.',
    },
    {
      title: 'Filtros de lectura y tipo',
      description:
        'Puedes consultar alertas leídas, sin leer o todas, y limitar los resultados por tipo.',
    },
    {
      title: 'Detalle de una alerta',
      description:
        'Abre el aviso para revisar su fecha, estado y contenido, junto con las acciones disponibles.',
    },
    {
      title: 'Indicador de alertas',
      description:
        'El número en la navegación identifica alertas pendientes de lectura cuando las hay.',
    },
  ],
  '/reportes': [
    {
      title: 'Resumen operativo',
      description:
        'Las tarjetas muestran los datos disponibles de eventos y recursos de la empresa. Las secciones dependen de los permisos de consulta.',
    },
    {
      title: 'Reporte de presupuesto por evento',
      description:
        'Consulta los importes disponibles y el porcentaje de ejecución para comparar el uso del presupuesto.',
    },
    {
      title: 'Reporte de eventos',
      description:
        'Presenta la información de eventos registrada y disponible para tu perfil.',
    },
    {
      title: 'Sin datos',
      description:
        'Un resultado vacío puede deberse a que no hay registros correspondientes o a que tu perfil no tiene acceso a esa información.',
    },
  ],
  '/auditoria': [
    {
      title: 'Filtros',
      description:
        'Acota la búsqueda por los criterios del formulario, como módulo, acción y fechas disponibles.',
    },
    {
      title: 'Consultar',
      description:
        'Aplica los filtros seleccionados y carga los registros que coinciden.',
    },
    {
      title: 'Historial de acciones',
      description:
        'Revisa los registros de la empresa activa y sus detalles. El límite controla cuántos resultados se solicitan.',
    },
  ],
  '/usuarios': [
    {
      title: 'Usuarios registrados',
      description:
        'Consulta los usuarios de la empresa, su estado y perfil; las acciones visibles dependen de tus permisos.',
    },
    {
      title: 'Estado de la cuenta',
      description:
        'El estado activo o inactivo determina la situación de la cuenta. Revisa las opciones de edición antes de guardar.',
    },
    {
      title: 'Perfil y permisos',
      description:
        'El perfil determina las acciones disponibles para el usuario. Se administra en el módulo Perfiles.',
    },
  ],
  '/perfiles': [
    {
      title: 'Indicadores',
      description:
        'Estas tarjetas muestran cuántos perfiles existen en la empresa, cuántos siguen activos y cuántos permisos están distribuidos entre ellos. Son solo un resumen: no cambian accesos ni usuarios.',
    },
    {
      title: 'Crear o editar perfil',
      description:
        'Usa “Nuevo perfil” para escribir un nombre y escoger las acciones que podrá realizar ese rol. Al editar, puedes ajustar sus permisos; las personas vinculadas a ese perfil verán las opciones permitidas cuando inicien sesión de nuevo.',
    },
    {
      title: 'Buscar módulo',
      description:
        'Escribe el nombre de un módulo, por ejemplo “Eventos” o “Inventario”, para reducir el catálogo y revisar únicamente sus permisos. El buscador no modifica la selección que ya hiciste.',
    },
    {
      title: 'Activar permisos',
      description:
        'Marca las acciones que necesita el perfil, como consultar, crear, editar o desactivar información. Debes seleccionar al menos un permiso para guardar; cada persona con ese perfil heredará esos accesos.',
    },
    {
      title: 'Perfiles registrados',
      description:
        'Cada tarjeta muestra el nombre, estado y cantidad de permisos del perfil. Abre sus opciones para revisar o editar los perfiles personalizados; los perfiles del sistema se identifican como protegidos y no se modifican desde aquí.',
    },
  ],
  '/mi-perfil': [
    {
      title: 'Datos de la cuenta',
      description: 'Consulta la información asociada a tu sesión.',
    },
    {
      title: 'Google',
      description:
        'Revisa las opciones disponibles para vincular o gestionar el acceso con Google según el estado de tu cuenta.',
    },
  ],
};
