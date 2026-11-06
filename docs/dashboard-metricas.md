# Métricas del dashboard

El resumen operativo se consulta mediante `GET /api/dashboard/summary` y
requiere el permiso `dashboard.ver` con una empresa activa.

La respuesta contiene únicamente los bloques a los que el perfil activo tiene
acceso. Por ejemplo, alguien sin `inventario.ver` recibe `inventory: null`.

```json
{
  "data": {
    "events": {
      "total": 12,
      "active": 5,
      "byStatus": {
        "borrador": 1,
        "planificado": 3,
        "en_progreso": 1,
        "finalizado": 6,
        "cancelado": 1
      },
      "upcoming": [
        {
          "id": "...",
          "name": "Feria Evoria",
          "startAt": "2026-12-01T10:00:00.000Z",
          "endAt": "2026-12-01T18:00:00.000Z",
          "status": "planificado"
        }
      ]
    },
    "inventory": {
      "resources": 8,
      "total": 250,
      "available": 180,
      "reserved": 50,
      "maintenance": 20
    },
    "budgets": {
      "allocatedCop": 10000000,
      "spentCop": 6200000,
      "remainingCop": 3800000
    }
  },
  "message": "Resumen del dashboard obtenido correctamente."
}
```

El backend calcula las métricas desde eventos, recursos y presupuestos de la
empresa activa. No crea una colección de métricas ni requiere migración.

- `events` requiere `eventos.ver`.
- `inventory` requiere `inventario.ver`.
- `budgets` requiere `presupuestos.ver`.

Los eventos cancelados no aportan al resumen presupuestal. `upcoming` contiene
como máximo los próximos cinco eventos no finalizados ni cancelados.
