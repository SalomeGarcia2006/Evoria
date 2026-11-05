# Alertas y autorizaciones: estado de integración

Este informe describe el estado revisado del código y no anuncia funcionalidades pendientes como disponibles.

## Autorizaciones de presupuestos disponibles

- `GET /api/budgets/authorizations` requiere `presupuestos.aprobar` y consulta las solicitudes pendientes de eventos activos cuyo responsable es el usuario autenticado.
- `POST /api/events/:eventId/budget/requests` crea una solicitud con permiso `presupuestos.editar`.
- `POST /api/events/:eventId/budget/requests/:requestId/approve` y `POST /api/events/:eventId/budget/requests/:requestId/reject` requieren `presupuestos.aprobar`. La decisión permanece bajo las reglas del módulo de presupuestos.
- La consulta del presupuesto de un evento usa `GET /api/events/:eventId/budget` y requiere `presupuestos.ver`.

## Bandeja personal

La identidad y empresa proceden de la sesión. Las respuestas usan `{ "data": ..., "message": "..." }`. Los contratos se encuentran en `packages/contracts/src/alerts.ts`.

- `GET /api/alerts?page=1&limit=20&unread=true&type=budget_pending&severity=info&eventId=<id>`: todos los filtros son opcionales; `page` comienza en 1 y `limit` admite de 1 a 100. `unread` es `true` o `false`. Devuelve `data.items` y `data.pagination` (`page`, `limit`, `total`, `totalPages`).
- `GET /api/alerts/unread-count`: devuelve `data: { "count": 3 }`.
- `GET /api/alerts/:id`: detalle de una alerta propia y accesible.
- `PATCH /api/alerts/:id/read`: marca una alerta como leída; repetirlo conserva la primera fecha de lectura.
- `PATCH /api/alerts/read-all`: marca las alertas accesibles del usuario y devuelve `data: { "updated": 3 }`.

Las consultas requieren `alertas.ver`; las escrituras requieren `alertas.editar` y acceso de consulta. Cada tipo también exige permisos de su módulo de origen. Una sesión inválida devuelve 401, la falta de permisos 403, un identificador inválido 400 y una alerta ajena o inaccesible 404.

Ejemplo de elemento de `data.items`:

```json
{
  "id": "64a000000000000000000001",
  "type": "budget_pending",
  "title": "Solicitud pendiente",
  "message": "Hay una solicitud de presupuesto pendiente de tu decisión.",
  "severity": "info",
  "eventId": "64a000000000000000000002",
  "requestId": "64a000000000000000000003",
  "inventoryItemId": null,
  "readAt": null,
  "createdAt": "2026-11-04T12:00:00.000Z"
}
```

La alerta pendiente se filtra según responsable vigente y estado real de la solicitud. Los textos son genéricos y la información de la solicitud debe consultarse a través del presupuesto. La bandeja de autorizaciones debe consumir la fuente existente; no debe tratar una alerta como una decisión ni como una segunda solicitud.

## Tipos y destinatarios

- `event_responsibility`: responsable vigente cuando se crea o cambia, con `eventos.ver`.
- `budget_pending`: responsable vigente distinto del solicitante, con `eventos.ver`, `presupuestos.ver` y `presupuestos.aprobar`.
- `budget_decided`: solicitante, con `eventos.ver` y `presupuestos.ver`.
- `budget_limit`: responsable vigente, con `eventos.ver` y `presupuestos.ver`.
- `inventory_low`: miembros activos con `inventario.ver` e `inventario.editar`.
- `event_cancelled`: solicitantes y responsable de solicitudes pendientes, con `eventos.ver` y `presupuestos.ver`; las solicitudes mantienen su estado.

Todos necesitan además `alertas.ver`. Los umbrales iniciales son 80 % de presupuesto gastado y 20 % de inventario disponible, configurables con `ALERT_BUDGET_PERCENT` y `ALERT_INVENTORY_PERCENT` (1 a 100). El presupuesto sin inicializar o con asignado cero no produce porcentaje. La condición se avisa al cruzar, no se duplica mientras persiste y puede volver a avisar después de recuperarse y cruzar de nuevo.

## Entrega y recuperación

Las alertas, la cola de reintentos y las condiciones tienen índices únicos por empresa, destinatario y clave. La API crea esos índices al iniciar. La cola se reintenta aproximadamente cada 15 segundos y una conciliación paginada revisa eventos, presupuestos e inventario persistidos. La retención es indefinida y no hay limpieza automática. No se implementaron correo ni tiempo real.

Las generaciones de un umbral quedan pendientes en la condición hasta que se incorporan a la cola. Las operaciones de inventario, asignaciones, servicios de proveedor, inicialización y decisión de presupuesto registran la condición en la misma transacción que el cambio correspondiente. Si falla la escritura de la condición, la operación se revierte; si falla la entrega después de confirmar, puede reintentarse aunque el valor se recupere. Las escrituras directas en MongoDB, scripts antiguos o módulos que omitan estas rutas no adquieren esa garantía. La conciliación puede crear alertas para solicitudes y decisiones antiguas cuyos destinatarios conserven los permisos.

Las nuevas decisiones actualizan el evento y el presupuesto en una transacción, que también registra su alerta y auditoría. Así, el cambio de responsable o la cancelación compiten por el mismo documento del evento; la transacción comprueba de nuevo las condiciones al reintentarse. Una interrupción deja una transacción abandonada que MongoDB aborta, no un nuevo token persistente. El controlador de MongoDB reintenta confirmaciones inciertas, pero si finalmente se pierde el resultado el cliente debe consultar la solicitud antes de repetir: no existe una clave de idempotencia HTTP para reconstruir la respuesta.

Los tokens `budgetDecisionLock` creados por versiones anteriores se siguen respetando y deben revisarse antes de migrar. Solo después de detener y confirmar la terminación de **todas** las instancias de la versión anterior, consultar el token y ejecutar por un canal administrativo:

```sh
npm run build --workspace=@evoria/api
npm run recover:budget-lock --workspace=@evoria/api -- <empresa-id> <evento-id> <token-actual> --confirm-all-api-instances-stopped
```

El comando solo elimina el token que coincide; no debe ejecutarse mientras una instancia antigua pueda seguir actuando. Las transacciones requieren una réplica; el arranque local y la migración están en [migracion-replica.md](migracion-replica.md), y la réplica aislada de prueba en [prueba-replica-aislada.md](prueba-replica-aislada.md). Los permisos `alertas.ver` y `alertas.editar` ya existen en el seed de control de acceso.

### Si se pierde la respuesta de una decisión

Conserve `eventId` y `requestId`. Después de recuperar la conexión y la sesión,
consulte `GET /api/events/:eventId/budget` con `presupuestos.ver` y busque ese
identificador en `data.requests`. Si está `aprobada` o `rechazada`, muestre el
estado real, `decidedBy`, `decidedAt` y el motivo cuando exista; no vuelva a
decidirla. Una alerta leída no cambia ese estado. Si la respuesta es 401, 403,
404 o no incluye la solicitud, no asuma que quedó pendiente: recupere el acceso
o solicite a una persona autorizada que compruebe el historial.

Si aún está `pendiente`, la operación anterior podría seguir en curso. Actualice
el estado y, si corresponde, reintente solo la misma decisión; dos intentos no
pueden aplicar dos veces una solicitud. Un 409 no confirma por sí solo qué
ocurrió: vuelva a consultar el historial y compruebe quién decidió y cuál fue
el resultado. La API no proporciona una clave HTTP que reconstruya la respuesta
perdida; el identificador de solicitud y su estado son la fuente de verdad.

## Pruebas

`npm run test:alerts --workspace=@evoria/api` ejecuta pruebas unitarias. `npm run test:alerts:mongo --workspace=@evoria/api` y `npm run test:alerts:transactions --workspace=@evoria/api` requieren una réplica MongoDB aislada y crean bases exclusivas de prueba que eliminan al terminar. Incluyen recorridos de servicios y HTTP, fallos de entrega, decisiones concurrentes, interrupción y lectura personal. La configuración y las variables para ejecutarlas están en [prueba-replica-aislada.md](prueba-replica-aislada.md). No cubren un despliegue con múltiples instancias ni todos los fallos posibles de red.

La propuesta anterior de presupuestos contiene reglas que deben contrastarse con el código actual. En particular, la devolución de inventario libera su costo del saldo en la implementación vigente.
