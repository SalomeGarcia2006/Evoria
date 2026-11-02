# Backend de presupuestos

El presupuesto se guarda por evento. El líder que autoriza cambios es el usuario de `Event.responsibleUserId`. Todos los montos son enteros en COP.

## Integración con la creación de eventos

El equipo que incorpore el presupuesto base al formulario de creación debe llamar a `BudgetsService.initializeForEvent(eventId, tenantId, baseAmountCop, createdBy)` después de guardar el evento. El método solo permite una inicialización, verifica la empresa y reconstruye el costo de asignaciones existentes para eventos anteriores. El endpoint `POST /api/events/:eventId/budget` permite iniciar presupuestos de eventos creados antes de esa integración; no sirve para modificar el monto base una segunda vez.

Mientras un evento no tenga presupuesto inicial, las nuevas asignaciones de inventario y servicios de proveedores se rechazan con `409`. `GET /api/events/:eventId/budget` devuelve `initialized: false` y `baseAmountCop: null` para que la interfaz indique que falta completar la creación del presupuesto.

## Consultas

- `GET /api/budgets?search=&page=1&limit=20&includeCancelled=false`: resumen de eventos y totales de la empresa. Los totales siempre excluyen eventos cancelados.
- `GET /api/events/:eventId/budget`: resumen individual, renglones históricos de inventario y servicios, y solicitudes con sus decisiones. No modifica recursos.
- `GET /api/budgets/authorizations`: solicitudes pendientes de eventos activos cuyo `responsibleUserId` es el usuario autenticado.

## Solicitudes y decisiones

- `POST /api/events/:eventId/budget/requests` con `{ "type": "ampliacion" | "costo_adicional", "amountCop": 500000, "reason": "Motivo de al menos diez caracteres" }` crea una solicitud pendiente sin alterar los montos.
- `POST /api/events/:eventId/budget/requests/:requestId/approve` aplica el cambio si quien decide es el líder, tiene `presupuestos.aprobar`, no hizo la solicitud y el evento sigue activo. Un costo adicional requiere saldo suficiente al aprobar.
- `POST /api/events/:eventId/budget/requests/:requestId/reject` con `{ "reason": "Motivo de rechazo" }` conserva el rechazo y su autor.

La consulta exige `presupuestos.ver`; iniciar el presupuesto y solicitar cambios exigen `presupuestos.editar`. Las decisiones exigen `presupuestos.aprobar`. La asignación de recursos y servicios sigue exigiendo los permisos propios de esos módulos.

## Cálculo

`asignado = base + ampliaciones aprobadas`; `gastado = inventario histórico + servicios confirmados + costos adicionales aprobados`; `disponible = asignado - gastado`. El costo de inventario se fija al asignar y se conserva al devolverlo. Cancelar un servicio deja de contarlo como gasto; su renglón sigue visible. Las reservas del saldo se hacen de forma atómica sobre el documento de presupuesto, por lo que dos solicitudes de gasto simultáneas no pueden sobrepasar el saldo.

Las notificaciones y la bandeja visual se conectarán después. Sus casos previstos están en [alertas-y-autorizaciones-presupuestos.md](alertas-y-autorizaciones-presupuestos.md).
