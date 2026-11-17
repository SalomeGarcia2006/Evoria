# Reportes: contrato para frontend

Los reportes consultan los datos existentes de la empresa activa. No crean una
segunda fuente de verdad ni guardan las exportaciones. Las rutas devuelven
`{ "data": ..., "message": "..." }`, excepto la descarga CSV. Requieren
sesión de empresa activa y `reportes.ver`, además de los permisos siguientes:

| Tipo                    | Consulta                     | Permisos adicionales                                        |
| ----------------------- | ---------------------------- | ----------------------------------------------------------- |
| Eventos                 | `GET /api/reports/events`    | `eventos.ver`                                               |
| Presupuestos            | `GET /api/reports/budgets`   | `eventos.ver`, `presupuestos.ver`                           |
| Inventario              | `GET /api/reports/inventory` | `inventario.ver`                                            |
| Asignaciones actuales   | `GET /api/reports/resources` | `eventos.ver`, `inventario.ver`, `asignaciones.ver`         |
| Proveedores y servicios | `GET /api/reports/providers` | `eventos.ver`, `proveedores.ver`, `servicios_proveedor.ver` |
| Cronogramas             | `GET /api/reports/schedules` | `eventos.ver`, `cronogramas.ver`                            |

`GET /api/reports/summary` devuelve bloques `events`, `budgets` e `inventory`.
Cada bloque que no corresponda a los permisos actuales es `null`; no significa
que su valor sea cero. El bloque `events` contiene `pagination`, `byStatus` e
`invitados`; los otros dos contienen los totales del reporte correspondiente.
El inventario del resumen es el estado actual de toda la empresa, sin aplicar
los filtros de evento.

## Filtros y paginación

Para eventos, presupuestos, asignaciones, proveedores y cronogramas se admiten:

- `from` y `to`: fechas ISO 8601 para la **fecha de inicio del evento**,
  inclusivas. `from` debe ser anterior o igual a `to`. Envíen fecha y hora con
  zona, por ejemplo `2030-03-01T05:00:00.000Z`; una fecha sin hora se interpreta
  como medianoche UTC, no como el final del día local.
- `status`: estado del evento (`borrador`, `planificado`, `en_progreso`,
  `finalizado`, `cancelado`); `eventType`: tipo exacto; `responsibleUserId` y
  `eventId`: identificadores MongoDB.
- `includeCancelled=true`: presupuestos y proveedores incluyen eventos
  cancelados; por defecto no los incluyen. Si se solicita `status=cancelado`
  en esos reportes también se debe enviar `includeCancelled=true`.
- `page` comienza en 1 y `limit` admite entre 1 y 100, con valores iniciales 1
  y 20. `pagination.total` cuenta todos los resultados filtrados, no solo la
  página. `totalPages` es 0 cuando no hay resultados.

Inventario es una fotografía actual, no un histórico: admite `inventoryStatus`
(`disponible`, `mantenimiento`, `inactivo`) y paginación, pero no filtros de
evento ni de fechas. Por defecto excluye los artículos inactivos. Los filtros
que no corresponden a una ruta individual se rechazan con 400. En `summary`,
`inventoryStatus` afecta al bloque de inventario y los filtros de evento a
los bloques de eventos y presupuestos.

Ejemplo: `GET /api/reports/budgets?from=2030-01-01T05:00:00Z&to=2031-01-01T04:59:59Z&page=1&limit=20`:

```json
{
  "data": {
    "items": [
      {
        "eventId": "64a000000000000000000001",
        "eventName": "Feria",
        "eventStatus": "planificado",
        "initialized": true,
        "baseAmountCop": 1000,
        "approvedIncreaseCop": 200,
        "allocatedCop": 1200,
        "inventorySpentCop": 300,
        "providerSpentCop": 200,
        "extraSpentCop": 100,
        "spentCop": 600,
        "remainingCop": 600,
        "executionPercent": 50
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "totals": {
      "allocatedCop": 1200,
      "spentCop": 600,
      "remainingCop": 600,
      "inventorySpentCop": 300,
      "providerSpentCop": 200,
      "extraSpentCop": 100
    }
  },
  "message": "Reporte obtenido correctamente."
}
```

Los totales usan todos los eventos que cumplen el filtro, no solo los de la
página. Un presupuesto sin inicializar se identifica con `initialized=false`,
`baseAmountCop=null` y `executionPercent=null`; la asignación cero tampoco
tiene porcentaje. El gasto es el costo registrado en Presupuestos, no equivale
necesariamente a pagos, facturación o utilidad.

`events` incluye `byStatus` con todos los estados e `invitados`, que suma el
número registrado, no la asistencia efectiva. `inventory` incluye `totals` y
`lowStock`, calculado con `ALERT_INVENTORY_PERCENT` (20 por defecto). `resources`
incluye solo asignaciones actualmente activas. `providers` agrupa por proveedor,
cuenta servicios confirmados y cancelados y suma solamente montos confirmados;
no afirma que estén pagados. `schedules` agrupa actividades por evento y estado;
incluye solo eventos con actividades. Sus fechas son programadas, no duración
real. No se proporciona historial completo de inventario ni asistencia real.

## Exportación CSV

`GET /api/reports/export/:kind` acepta los tipos y filtros de la tabla y exige
los mismos permisos que la consulta. Devuelve `text/csv; charset=utf-8` con
cabecera, BOM UTF-8 y todas las filas filtradas, ignorando `page` y `limit`.
Se rechazan reportes de más de 5000 filas con 400 para evitar una descarga sin
límite; reduzcan los filtros. Los campos de texto que podrían ejecutarse como
fórmulas en una hoja de cálculo se escapan. Las consultas y la exportación son
lecturas actuales: si los datos cambian durante varias páginas, no representan
una instantánea histórica inmutable. No se implementó PDF.

`401` indica sesión inválida o membresía inactiva, `403` permiso insuficiente y
`400` filtros o identificadores inválidos. La empresa y la identidad provienen
de la sesión; no se acepta escoger un destinatario o empresa en la consulta.

Los tipos están en `packages/contracts/src/reports.ts`. `reportes.ver` ya existe
en el catálogo de permisos; no se añadió migración ni seed nuevo. Para verificar
el flujo HTTP contra una réplica **aislada**, desde la raíz del repositorio:

```powershell
docker compose -f compose.alertas-test.yaml up -d --wait
```

Después, desde `apps/api`:

```powershell
$env:EVORIA_TEST_MONGO_URI='mongodb://127.0.0.1:27129/?replicaSet=evoriaAlertTest&directConnection=true'
node --require ts-node/register --test src/reports/reports.http.mongo.spec.ts
```

La suite crea y elimina su propia base con nombre aleatorio. No la apunten a una
instancia compartida. El script de integración del proyecto incluye esta prueba.
