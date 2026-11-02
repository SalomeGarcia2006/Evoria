# Alertas y autorizaciones pendientes para Presupuestos

Este documento registra las alertas y el flujo de autorización que necesita el presupuesto de eventos. La interfaz de Alertas y su bandeja de autorizaciones aún no están integradas; el backend de Presupuestos debe conservar las solicitudes y decisiones para que esa interfaz pueda conectarse después.

## Solicitudes que requieren autorización

| Operación                 | Datos que debe registrar la solicitud                      | Efecto antes de aprobar | Efecto al aprobar                                                    |
| ------------------------- | ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| Ampliar presupuesto       | Evento, monto COP, motivo obligatorio, solicitante y fecha | Ninguno                 | Aumenta el monto asignado al evento.                                 |
| Registrar costo adicional | Evento, monto COP, motivo obligatorio, solicitante y fecha | Ninguno                 | Aumenta el gasto extraordinario, solo si aún cabe en el presupuesto. |

La solicitud debe tener identificador y estado `pendiente`, `aprobada` o `rechazada`, con usuario decisor, fecha de decisión y motivo de rechazo cuando corresponda. El líder del proyecto recibe la solicitud y decide desde el futuro apartado **Alertas → Autorizaciones**. Una persona no debe aprobar su propia solicitud. Una solicitud decidida no puede decidirse de nuevo. La API debe comprobar empresa, evento, identidad del líder y permisos en cada operación; ocultar botones en la web no sustituye esas verificaciones.

El presupuesto y el gasto no cambian mientras la solicitud esté pendiente. Si se intenta aprobar un costo adicional y el saldo ya no alcanza, la aprobación debe fallar sin registrar el gasto. Una ampliación aprobada sí aumenta el saldo disponible. Un evento cancelado conserva su historial, pero no acepta solicitudes nuevas ni aprobaciones pendientes.

## Alertas necesarias

1. **Solicitud de ampliación pendiente:** avisar al líder del proyecto con evento, monto, motivo, solicitante y enlace a la autorización.
2. **Solicitud de costo adicional pendiente:** avisar al líder con los mismos datos y el saldo disponible actual.
3. **Solicitud aprobada o rechazada:** avisar al solicitante con decisión, fecha y motivo de rechazo, si existe.
4. **Saldo insuficiente al asignar inventario o servicio:** informar al usuario que la operación se bloqueó, cuánto falta y que puede solicitar una ampliación. No crear una asignación parcial.
5. **Saldo insuficiente al aprobar un costo adicional:** informar al líder que la solicitud sigue pendiente y debe aumentarse primero el presupuesto o rechazarse.
6. **Presupuesto cercano al límite:** umbral configurable para advertir antes de agotar el saldo; esta alerta es informativa y no autoriza gastos.
7. **Evento cancelado con autorizaciones pendientes:** informar al solicitante y al líder que ya no pueden aprobarse; conservar el historial de decisiones.

## Datos para la futura interfaz

La bandeja de autorizaciones debe permitir filtrar por estado y evento, mostrar el resumen financiero actualizado y abrir el detalle de la solicitud. El detalle muestra presupuesto base, ampliaciones aprobadas, gasto por inventario, gasto por servicios de proveedores, otros costos aprobados, saldo y motivo de la solicitud. La decisión requiere confirmación; el rechazo exige un motivo. La UI debe tratar las respuestas `403` (sin permiso), `404` (empresa o evento ajeno) y `409` (evento cancelado, solicitud ya decidida o saldo insuficiente).

## Reglas de cómputo relacionadas

- Presupuesto asignado = base del evento + ampliaciones aprobadas.
- Gastado = costos de asignaciones de inventario registradas + servicios de proveedores confirmados + costos adicionales aprobados.
- Disponible = asignado − gastado; nunca debe quedar negativo por una operación nueva.
- Los totales generales de la empresa excluyen eventos cancelados. La consulta individual de un evento cancelado conserva el detalle histórico.
- El costo de inventario se fija al asignar (`cantidad × costo unitario` de ese momento) y no cambia si se modifica después el catálogo. Liberar una reserva no borra su gasto histórico.
- Un servicio de proveedor cancelado deja de contar como gasto confirmado, pero permanece en el historial.

## Por definir con el equipo de Alertas

- Canal de entrega de notificaciones y si se requiere correo además de la bandeja interna.
- Umbral y frecuencia de la alerta de saldo cercano al límite, para evitar duplicados.
- Responsable final cuando un evento aún no tiene líder asignado o el líder deja de pertenecer a la empresa.
