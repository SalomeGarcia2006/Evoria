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

Las generaciones de un umbral quedan pendientes en la condición hasta que se incorporan a la cola; por ello, si se guardó la condición y falla la cola, el cruce se reintenta incluso si el valor ya se recuperó. La operación principal y la escritura de esa condición siguen siendo documentos distintos. Si también falla la escritura de la condición y el valor se recupera antes de conciliar, el cruce no puede reconstruirse. La prueba de Mongo aislado conserva ambos casos. Para garantizar todos los cruces habría que guardar una bitácora o salida de eventos en la misma escritura atómica que modifica inventario o presupuesto, o bien disponer de MongoDB con réplicas y usar transacciones que incluyan esa salida. La entrega actual no garantiza todos los cambios transitorios. La primera conciliación también puede crear alertas para solicitudes y decisiones ya existentes cuyos destinatarios aún tengan los permisos correspondientes.

Las decisiones usan un bloqueo persistente en el evento, sin caducidad automática. Si el proceso se interrumpe, detener y confirmar la terminación de **todas** las instancias de API antes de recuperar el bloqueo; una instancia detenida temporalmente no es suficiente. Consultar el token actual `budgetDecisionLock` del evento por un canal administrativo y ejecutar con la configuración MongoDB del entorno:

```sh
npm run build --workspace=@evoria/api
npm run recover:budget-lock --workspace=@evoria/api -- <empresa-id> <evento-id> <token-actual> --confirm-all-api-instances-stopped
```

El comando solo elimina el token que coincide. Su seguridad depende de que no quede ningún proceso anterior activo; no hay recuperación automática por tiempo. La prueba en Mongo aislado interrumpe un proceso mientras decide, comprueba que otro no puede decidir y ejecuta la recuperación después de confirmar que el proceso terminó. Para recuperación automática segura habría que reunir la autoridad sobre el responsable, la cancelación, la generación de fencing y la decisión en una misma escritura atómica, o coordinar esos documentos mediante transacciones en una réplica; una mera caducidad del bloqueo no garantiza exclusión. Los permisos `alertas.ver` y `alertas.editar` ya existen en el seed de control de acceso.

## Pruebas

`npm run test:alerts --workspace=@evoria/api` ejecuta pruebas unitarias. `npm run test:alerts:mongo --workspace=@evoria/api` requiere MongoDB local en `127.0.0.1:27017`; crea bases exclusivas `evoria_alertas_test_<id>` y las elimina al terminar. Incluye el recorrido de servicios con MongoDB real y una prueba HTTP con sesiones, permisos y lectura personal. No cubre un despliegue con múltiples instancias ni simula todos los fallos posibles de red.

La propuesta anterior de presupuestos contiene reglas que deben contrastarse con el código actual. En particular, la devolución de inventario libera su costo del saldo en la implementación vigente.
