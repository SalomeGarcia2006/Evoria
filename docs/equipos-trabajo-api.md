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
