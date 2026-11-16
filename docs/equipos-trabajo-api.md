# Equipos de trabajo: API

La API administra equipos por empresa y asigna como máximo un equipo a cada actividad. Esta funcionalidad no incluye interfaz web.

## Preparación

Después de instalar dependencias, ejecuta `npm run seed:access-control` para registrar los permisos `equipos.ver`, `equipos.crear`, `equipos.editar` y `equipos.desactivar`. Así se actualizan también los perfiles administradores del sistema; los demás perfiles deben recibir los permisos correspondientes desde la administración de perfiles. No se conceden automáticamente a los demás perfiles.

Las asignaciones y la finalización usan transacciones de MongoDB: la base debe estar configurada como réplica, también en desarrollo. Al iniciar la API se crean índices que impiden que un integrante pertenezca a dos equipos activos de una empresa.

## Equipos y especialidades

Todas las rutas usan la empresa activa del usuario autenticado y el prefijo `/api`.

- `GET /teams` y `GET /teams/:id`: consultar equipos con `equipos.ver`.
- `POST /teams`: crear con `equipos.crear`. Cuerpo: `{ "name": "Equipo de sonido", "specialty": "Sonido e iluminación", "memberIds": ["idUsuario"], "leaderId": "idUsuario" }`.
- `PATCH /teams/:id`: actualizar nombre, especialidad, miembros o líder con `equipos.editar`.
- `DELETE /teams/:id`: desactivar con `equipos.desactivar`, siempre que no tenga actividades no canceladas cuyo fin programado todavía no haya pasado.
- `GET /teams/specialties`: consultar sugerencias y especialidades personalizadas de la empresa con `equipos.ver`.
- `POST /teams/specialties`: guardar una especialidad personalizada con `equipos.crear`. Cuerpo: `{ "name": "Escenografía" }`.

Un equipo tiene al menos un integrante y el líder debe estar incluido entre ellos. Los integrantes deben ser usuarios activos con membresía activa en la misma empresa. Antes de desactivar a un usuario hay que retirarlo de su equipo activo y, si es líder, nombrar otro integrante. También hay que reemplazarlo como responsable de los eventos que tengan actividades futuras con equipos asignados. La especialidad también puede enviarse como texto propio al crear o editar un equipo.

## Asignación y finalización

- `POST /schedules/:id/team`: asignar un equipo activo mediante `{ "teamId": "idEquipo" }`. Solo puede hacerlo el responsable del evento de esa actividad.
- `DELETE /schedules/:id/team`: retirar el equipo; solo el responsable del evento puede hacerlo. Una actividad completada conserva la asignación.
- `POST /schedules/:id/complete`: el líder del equipo asignado o el responsable del evento marca la actividad como completada.
- `GET /schedules/:id/available-teams`: el responsable del evento consulta equipos disponibles para la actividad. La disponibilidad puede cambiar y se valida nuevamente al asignar.
- `GET /schedules/:id/team-history`: consultar el historial de asignaciones, retiros y finalización con `cronogramas.ver`. La finalización automática se identifica como realizada por el sistema.

Las actividades asignadas no se pueden editar ni cancelar sin retirar primero el equipo. Las fechas del evento tampoco se pueden cambiar si dejan actividades asignadas fuera de su período. Entre actividades del mismo evento debe haber al menos 15 minutos; entre actividades de eventos diferentes, al menos una hora. Se usan las fechas programadas, incluso cuando una actividad termina antes. Las actividades canceladas no reservan el equipo.

La API revisa cada 15 segundos las actividades asignadas que llegaron a su hora de finalización. Las marca como completadas y registra la alerta para el responsable del evento; si la API estuvo detenida, recupera las pendientes al iniciarse. La alerta también se registra cuando el líder del equipo termina la actividad manualmente. El estado del evento no se cambia automáticamente.

Las alertas usan el control de acceso existente. Antes de asignar un equipo se comprueba que el responsable tenga `alertas.ver` y `eventos.ver`; los mismos permisos se exigen al cambiar de responsable si hay actividades futuras asignadas. Si posteriormente pierde esos permisos, la alerta queda pendiente y se reintenta cuando los recupere. La entrega se realiza mediante la cola de alertas existente y puede demorarse hasta el siguiente ciclo de procesamiento.

## Guía de integración para frontend

### Estado actual y dependencia pendiente

El backend de equipos está en la rama `equipos-evoria`. La interfaz de equipos todavía no está implementada. El código web ya tiene pantallas y servicios de eventos, usuarios, cronograma y alertas que se pueden extender; las tareas de esta sección son para el equipo frontend.

**Bloqueo de alertas:** la finalización crea una alerta de tipo `activity_completed`, pero `apps/api/src/alerts/alerts.service.ts` no incluye ese tipo entre los permitidos por `filter`, y `apps/api/src/alerts/alerts.dto.ts` no lo acepta como filtro `type`. Por tanto, aunque exista en la base de datos, el listado, el conteo y el detalle actuales no permiten mostrarla correctamente; `GET /alerts?type=activity_completed` devuelve un error de validación. Antes de dar por terminada esta parte, backend debe agregar el tipo a la autorización y validación de alertas, y verificar listado, conteo, detalle, lectura y revocación de permisos. No basta con cambiar el frontend.

### Preparar sesión, empresa y permisos

1. Trabajar con una sesión autenticada y una empresa activa. Las operaciones de equipos usan la empresa del token; no reciben `tenantId` en el cuerpo ni en la URL. Al cambiar de empresa, limpiar o invalidar las consultas de equipos, usuarios, eventos, actividades y alertas antes de volver a cargarlas.
2. Reutilizar `apiRequest` de `apps/web/services/api.ts`. Enviar `credentials: 'include'` en cada petición y `Content-Type: application/json` en las que llevan JSON. `NEXT_PUBLIC_API_URL` ya incluye `/api`; las rutas pasadas a `apiRequest` empiezan, por ejemplo, por `/teams`, sin repetir el prefijo.
3. Leer el usuario y sus permisos desde el contexto de autenticación existente. El frontend puede ocultar o deshabilitar acciones según los permisos, pero la respuesta del backend es la autorización definitiva.
4. Antes de probar, coordinar con backend la ejecución de `npm run seed:access-control` en el entorno correspondiente. Este comando registra los permisos nuevos y actualiza los perfiles administradores del sistema; los demás perfiles necesitan que se les asignen los permisos apropiados.

| Acción o información                                    | Requisito del backend                                                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Consultar equipos y especialidades                      | `equipos.ver`                                                                                                                          |
| Crear equipo o especialidad                             | `equipos.crear`                                                                                                                        |
| Editar equipo                                           | `equipos.editar`                                                                                                                       |
| Desactivar equipo                                       | `equipos.desactivar`                                                                                                                   |
| Consultar integrantes disponibles mediante `GET /users` | `usuarios.ver`                                                                                                                         |
| Consultar actividades e historial                       | `cronogramas.ver`                                                                                                                      |
| Editar o cancelar una actividad sin equipo              | `cronogramas.editar` o `cronogramas.eliminar`, respectivamente                                                                         |
| Consultar disponibilidad, asignar o retirar equipo      | Ser el responsable del evento de esa actividad; para consultar disponibilidad y asignar también necesita `eventos.ver` y `alertas.ver` |
| Finalizar una actividad asignada                        | Ser el líder del equipo asignado o el responsable del evento                                                                           |
| Ver alertas y marcarlas como leídas                     | `alertas.ver` para consultar y `alertas.editar` para marcar como leídas                                                                |

Las rutas de asignación, retiro, disponibilidad y finalización comprueban la identidad y la empresa en el servicio; no tienen un permiso `equipos.asignar` en el contrato actual. No conceder ese permiso inventado ni permitir la acción solo porque el usuario sea responsable de otro evento. Para comparar identidades, usar `AuthUser.id` y el `responsibleUserId` del **evento**. El `responsibleUserId` de una actividad es un dato distinto y no determina quién asigna equipos. Para identificar al líder del equipo se necesita su `leaderId`.

**Dependencia de permisos para construir la UI:** `GET /teams` y `GET /teams/:id` requieren `equipos.ver`; `GET /users` requiere `usuarios.ver`. Una persona puede tener permiso para crear equipos sin tener alguno de esos permisos de lectura. Coordinar la asignación de permisos o mostrar un estado explicativo si faltan: el backend no ofrece un directorio alternativo de integrantes ni un detalle público de equipos para ese caso.

El backend tampoco ofrece actualmente una ruta de «mis actividades asignadas» para el líder de equipo. Para descubrir actividades con las rutas existentes, el frontend necesita consultar eventos con `eventos.ver`, sus cronogramas con `cronogramas.ver` y los equipos con `equipos.ver`, y relacionar `schedule.teamId` con un equipo cuyo `leaderId` sea `user.id`. El servicio `getAllEvents()` del frontend recorre las páginas de eventos, pero luego hay que consultar el cronograma de cada evento. Estos permisos adicionales son necesarios para esa experiencia de consulta, aunque la operación de finalizar en sí compruebe el liderazgo y no tenga un permiso específico. Si no se quieren conceder esos permisos o el volumen de eventos hace costoso este recorrido, se requiere acordar con backend una ruta específica antes de implementar esa vista; no existe en el contrato actual.

### Contratos de datos

Las respuestas correctas de estas rutas tienen la forma `{ "data": ..., "message": "..." }`. Los `GET`, `PATCH` y `DELETE` de este módulo responden con `200`; los `POST` con `201`. Los identificadores son cadenas con un ObjectId de MongoDB; no enviar nombres ni el `membershipId` donde se pide un identificador de usuario.

```ts
type TeamStatus = 'activo' | 'inactivo';

interface Team {
  id: string;
  name: string;
  specialty: string;
  memberIds: string[]; // IDs de usuario, no de membresía
  leaderId: string; // debe estar en memberIds
  status: TeamStatus;
  createdBy: string;
  createdAt: string; // fecha ISO 8601
  updatedAt: string;
}

interface TeamInput {
  name: string;
  specialty: string;
  memberIds: string[];
  leaderId: string;
}

interface AvailableTeam {
  id: string;
  name: string;
  specialty: string;
  leaderId: string;
}

interface TeamHistoryEntry {
  id: string;
  teamId: string;
  action: 'asignado' | 'retirado' | 'completado';
  actorId: string | null; // null para finalización automática
  actorName: string; // "Sistema" cuando es automática
  createdAt: string;
}
```

`GET /teams` devuelve `data: Team[]`, no un objeto paginado. Incluye equipos activos e inactivos, ordenados por nombre; si la interfaz necesita filtros o paginación para esta ruta, debe aplicarlos en memoria. `GET /teams/:id`, la creación, edición y desactivación devuelven `data: Team`. La disponibilidad devuelve `data: AvailableTeam[]`, sin miembros ni estado; el historial devuelve `data: TeamHistoryEntry[]`, ordenado cronológicamente.

Para mostrar nombres y correos de integrantes, combinar `Team.memberIds` y `Team.leaderId` con los usuarios de `GET /users?status=activo&limit=100&page=1`. Esa ruta sí devuelve `data.items` y `data.pagination`; consultar las páginas restantes hasta `totalPages`. El servicio existente `apps/web/services/users.service.ts` ya recorre las páginas, aunque su función `getUsers()` actual no aplica el filtro de estado. Conservar una presentación de respaldo si un ID ya no figura entre los usuarios activos o si el usuario actual no puede consultar usuarios; no suponer que los objetos de equipo incluyen nombres de integrantes.

### Pantalla de equipos

- Agregar navegación y protección de ruta para equipos usando `equipos.ver`, siguiendo `apps/web/lib/access-control.ts` y los componentes de autorización existentes. Mostrar solo las acciones para las que el usuario tenga permiso.
- Crear un servicio de equipos con funciones para listar, consultar, crear, editar, desactivar y gestionar especialidades. `GET /teams/specialties` devuelve `data: string[]`; `POST /teams/specialties` recibe `{ "name": "Escenografía" }` y devuelve `data: { "id": "...", "name": "Escenografía" }`. Después de crear una especialidad, volver a consultar la lista.
- El formulario de equipo debe solicitar nombre, una especialidad y al menos un integrante; elegir un líder de entre los integrantes seleccionados. Nombre: 2–120 caracteres; especialidad: 2–100. Se permiten hasta 200 integrantes, sin IDs repetidos. El backend recorta y normaliza espacios, comprueba membresías activas y rechaza integrantes que pertenezcan a otro equipo activo de la empresa.
- La especialidad es una cadena, no el ID del registro personalizado. El formulario puede elegir una sugerencia o enviar texto propio. Guardar primero una especialidad mediante `POST /teams/specialties` permite que vuelva a aparecer en el catálogo de la empresa; escribirla únicamente en el equipo no la agrega automáticamente a ese catálogo.
- En edición, `PATCH /teams/:id` acepta cualquiera de los campos de `TeamInput`; `memberIds` y `leaderId`, si se envían, sustituyen sus valores anteriores. Si se retira al líder, enviar también en la misma petición un nuevo `leaderId` que pertenezca a la lista resultante. No enviar `null` para estos campos.
- `DELETE /teams/:id` desactiva el equipo; no lo borra. Mostrar el estado inactivo y confirmar la acción. El backend la rechaza si existe una actividad no cancelada cuyo fin programado aún no haya pasado, incluso si se completó anticipadamente. No existe una ruta de reactivación en el contrato actual.
- Al desactivar un usuario desde la gestión existente, mostrar el mensaje de conflicto si aún pertenece a un equipo activo o es responsable de eventos con actividades futuras asignadas. Primero debe retirarse del equipo y reemplazarse como líder o responsable cuando corresponda.

### Cronograma, disponibilidad y asignaciones

1. Extender `ScheduleItem` en `apps/web/services/schedules.service.ts` con `teamId: string | null`. `GET /events/:eventId/schedules` devuelve ese campo; los registros antiguos sin equipo se presentan como `null`. El tipo actual del frontend todavía no lo declara.
2. En el cronograma, identificar al responsable del evento con `event.responsibleUserId === user.id`. Solo esa persona debe ver las acciones de consultar disponibilidad, asignar y retirar. Para resolver el nombre de un `teamId` ya asignado, consultar equipos con `equipos.ver`; si no tiene ese permiso, mostrar un dato de respaldo en vez de asumir que el nombre viene en la actividad.
3. Si la actividad no tiene equipo y es válida, consultar `GET /schedules/:id/available-teams` antes de abrir el selector. La ruta devuelve un arreglo vacío si la actividad ya tiene equipo, está cancelada o completada, su fin ya pasó, está fuera del período del evento o el evento está cancelado. Un usuario que no sea el responsable recibe `403`; si faltan permisos de alertas o eventos recibe `409`.
4. Al elegir una opción, enviar `POST /schedules/:id/team` con `{ "teamId": "<id del equipo>" }`. La respuesta es `data: { "scheduleId": "...", "teamId": "..." }`, no una actividad completa. Después, volver a cargar actividades, disponibilidad y, si está visible, el historial.
5. Cuando `teamId` no sea `null`, deshabilitar la edición y la cancelación de la actividad. Para modificarla, el responsable del evento debe usar `DELETE /schedules/:id/team`, cuya respuesta es `data: { "scheduleId": "...", "teamId": null }`; después puede editarla o cancelarla según sus permisos y volver a asignar un equipo. Una actividad completada conserva el equipo y no permite retirarlo.
6. Mostrar que una actividad tiene como máximo un equipo. La disponibilidad comprueba cruces en ambas direcciones: 15 minutos mínimos entre actividades del mismo evento y una hora entre eventos distintos. Se calcula con los horarios programados, incluso si se completó anticipadamente. Las actividades canceladas no reservan equipo. Ejemplo: si termina a las 15:00, el mismo equipo puede iniciar otra del mismo evento a las 15:15, o de otro evento a las 16:00.
7. La disponibilidad es una consulta puntual, no una reserva. Si otra persona asigna el equipo después de cargar el selector, `POST` puede responder `409`: informar el conflicto y volver a consultar disponibilidad. No calcular la disponibilidad solo en el navegador.
8. Al cambiar fechas de un evento, mostrar el `409` del servidor si alguna actividad con equipo asignado quedaría fuera del nuevo período. Revalidar las actividades al terminar el cambio.

### Finalización, historial y alertas

- Mostrar la acción de finalizar si el usuario es el líder del equipo asignado **o** el responsable del evento. `POST /schedules/:id/complete` no necesita cuerpo y responde `data: { "scheduleId": "...", "status": "completado" }`. Refrescar el cronograma y el historial tras la respuesta; no asumir que devuelve la actividad completa.
- La finalización automática solo procesa actividades con equipo asignado. La API comprueba las actividades aproximadamente cada 15 segundos y recupera pendientes al reiniciar. La interfaz debe volver a consultar el estado del servidor al entrar o volver a la vista y puede actualizarlo periódicamente; no hay una API de tiempo real documentada ni se debe cambiar el estado local definitivamente solo porque el reloj llegó a `endAt`.
- Consultar `GET /schedules/:id/team-history` con `cronogramas.ver` para mostrar asignación, retiro y finalización. El historial identifica al equipo por `teamId`; si no se puede resolver su nombre, conservar el identificador o un texto de respaldo. Una finalización automática llega con `actorId: null` y `actorName: "Sistema"`.
- La alerta usa `type: "activity_completed"`, `title`, `message`, `severity: "info"` y `eventId`. No incluye `scheduleId` en el contrato de alerta actual, por lo que se puede dirigir al evento o a su cronograma, pero no identificar de forma fiable la actividad concreta solo a partir de la alerta. Una vez resuelto el bloqueo de backend indicado arriba, agregar el nuevo valor a `AlertType` y a la presentación de `apps/web/services/alerts.service.ts` y de la pantalla de alertas. Las rutas existentes son `GET /alerts`, `GET /alerts/unread-count`, `PATCH /alerts/:id/read` y `PATCH /alerts/read-all`.
- Finalizar una actividad **no cambia automáticamente el estado del evento**. Mostrarlo por separado; si el responsable desea actualizarlo, usar el flujo existente de eventos y sus permisos.

### Ejemplo de consumo

Este ejemplo sigue el cliente existente y deja que `apiRequest` convierta los errores HTTP en `ApiError`:

```ts
import { apiRequest } from './api';

type ApiResponse<T> = { data: T; message: string };

export async function getAvailableTeams(
  scheduleId: string,
): Promise<AvailableTeam[]> {
  const response = await apiRequest<ApiResponse<AvailableTeam[]>>(
    `/schedules/${encodeURIComponent(scheduleId)}/available-teams`,
    { credentials: 'include', cache: 'no-store' },
  );
  return response.data;
}

export async function assignTeam(
  scheduleId: string,
  teamId: string,
): Promise<{ scheduleId: string; teamId: string }> {
  const response = await apiRequest<
    ApiResponse<{ scheduleId: string; teamId: string }>
  >(`/schedules/${encodeURIComponent(scheduleId)}/team`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId }),
  });
  return response.data;
}
```

`AvailableTeam` es el tipo definido en la sección anterior. Para las otras mutaciones usar el mismo patrón, con `PATCH`, `DELETE` o `POST` según la ruta; no añadir un cuerpo vacío a los métodos que no lo requieren.

### Errores y pruebas de aceptación

El cliente `apiRequest` expone `ApiError.status`, `message` y `messages`; un error de validación puede traer varios mensajes. Mostrar el mensaje devuelto y conservar los datos escritos. Manejar al menos:

| Estado      | Ejemplos y respuesta de la interfaz                                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`       | ID inválido, integrante sin membresía activa, campos inválidos o líder fuera del equipo. Señalar el campo y permitir corregirlo.                                                                                           |
| `401`       | Sesión ausente o vencida. Usar el flujo de autenticación y renovación existente.                                                                                                                                           |
| `403`       | Permiso insuficiente, empresa incorrecta o usuario que no es líder del evento/equipo según la acción. No mostrar datos de otra empresa.                                                                                    |
| `404`       | Equipo o actividad inexistente o no disponible en la empresa, incluido un equipo inactivo donde se requiere uno activo. Actualizar la vista.                                                                               |
| `409`       | Integrante ya asignado, especialidad duplicada, horario incompatible, actividad bloqueada, equipo con actividades pendientes o responsable sin permisos de alertas. Explicar el mensaje y refrescar los datos pertinentes. |
| `5xx` o red | Conservar el formulario y ofrecer reintento; no presentar la operación como exitosa.                                                                                                                                       |

Antes de entregar la interfaz, comprobar al menos:

1. Acceso y botones con perfiles que tengan y no tengan cada permiso; cambio de empresa sin datos residuales.
2. Crear y editar un equipo, especialidad personalizada, integrantes de distintas páginas, duplicados, líder fuera de la selección y desactivación bloqueada.
3. Disponibilidad y asignación con 14 y 15 minutos para el mismo evento, y 59 y 60 minutos para otro; comprobar también el `409` si la disponibilidad cambia simultáneamente.
4. Que otro usuario no pueda asignar ni retirar equipos de un evento ajeno; que el líder del equipo y el responsable del evento puedan finalizar, y que otro usuario no pueda hacerlo.
5. Bloqueo de edición y cancelación con equipo, retiro y nueva asignación, historial manual y automático, y recuperación del estado al volver a cargar la página.
6. Bloqueo al cambiar fechas del evento o desactivar integrantes en conflicto; alerta y navegación al evento después de que backend resuelva el bloqueo indicado al principio.
