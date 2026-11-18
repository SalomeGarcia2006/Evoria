# Cliente de un evento: contrato para frontend

Cada evento nuevo debe incluir el cliente que lo solicitó: nombre, identificación,
teléfono, dirección y correo. Los datos se guardan dentro del documento del evento
como `client`. Son una copia propia de ese evento: editar un cliente no modifica
otros eventos con la misma identificación. No se crea un directorio de clientes ni
una cuenta de usuario para el cliente.

## Crear un evento

`POST /api/events`, con sesión de empresa activa y `eventos.crear`:

```json
{
  "name": "Convención comercial",
  "startAt": "2030-01-10T13:00:00Z",
  "endAt": "2030-01-10T23:00:00Z",
  "baseBudget": 5000000,
  "invitados": 120,
  "client": {
    "name": "María López",
    "identification": "0012345678",
    "phone": "+57 300 123 4567",
    "address": "Calle 10 # 20-30, Bogotá",
    "email": "maria@example.test"
  }
}
```

Los cinco campos son obligatorios. La identificación y el teléfono deben enviarse
como **texto**, para conservar ceros iniciales y admitir documentos alfanuméricos.
No se supone un país o tipo de identificación ni se exige unicidad entre eventos.
Se eliminan espacios exteriores y se convierte el correo a minúsculas. No se
cambian mayúsculas, acentos ni espacios interiores del nombre o la dirección.

| Campo            | Reglas                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `name`           | Texto de 2 a 160 caracteres después de recortar espacios                                                     |
| `identification` | Texto de 3 a 50 caracteres                                                                                   |
| `phone`          | Texto de 7 a 30 caracteres; entre 7 y 15 dígitos; admite `+` inicial, espacios, paréntesis, puntos y guiones |
| `address`        | Texto de 3 a 255 caracteres                                                                                  |
| `email`          | Correo válido, máximo 254 caracteres                                                                         |

No se aceptan `client: null`, arreglos, cadenas ni objetos incompletos. Un cliente
inválido se rechaza antes de guardar el evento o iniciar su presupuesto. Continúan
vigentes las reglas de fechas, responsables, tipos de evento y presupuesto base.

## Consultar y editar

- `GET /api/events` y `GET /api/events/:id` requieren `eventos.ver` y devuelven
  `client` junto con los campos existentes del evento. El listado conserva su
  paginación y filtros actuales.
- `PATCH /api/events/:id` requiere `eventos.editar`. Omitir `client` conserva
  los datos actuales; incluirlo **reemplaza el objeto completo** y requiere
  los cinco campos válidos. No se admite borrar el cliente con `null` o `{}`.
- Cancelar el evento conserva el cliente y el historial existente. Un evento
  cancelado sigue sin admitir ediciones.

Ejemplo de actualización del contacto:

```json
{
  "client": {
    "name": "María López",
    "identification": "0012345678",
    "phone": "+57 310 456 7890",
    "address": "Carrera 50 # 10-20, Bogotá",
    "email": "maria@example.test"
  }
}
```

Las respuestas mantienen `{ "data": ..., "message": "..." }`. El cliente contiene
únicamente los cinco campos anteriores, sin identificador MongoDB adicional. Por
ejemplo, el fragmento correspondiente de `data` es:

```json
{
  "id": "64a000000000000000000001",
  "name": "Convención comercial",
  "client": {
    "name": "María López",
    "identification": "0012345678",
    "phone": "+57 310 456 7890",
    "address": "Carrera 50 # 10-20, Bogotá",
    "email": "maria@example.test"
  }
}
```

La asignación del responsable (`responsibleUserId`) es independiente del cliente:
el responsable es un usuario de la empresa y el cliente es quien solicita el evento.
No se envían correos ni notificaciones al cliente como parte de este cambio.

## Eventos existentes e integración gradual

No se inventan clientes para los eventos anteriores. La API devuelve `client: null`
cuando no existen datos. Esos eventos se pueden consultar y editar en sus otros
campos sin exigir información ficticia. Para completarlos, enviar el objeto válido
mediante `PATCH` mientras el evento permita ediciones. Los eventos cancelados
mantienen la restricción existente; no se habilita una edición administrativa nueva.

**La creación desde frontend debe incorporar `client` antes de integrar esta rama.**
El formulario actual, que no lo envíe, recibirá `400`. La interfaz no fue modificada.
Una actualización de cliente requiere reenviar los cinco valores vigentes, con los
cambios deseados. Ante una actualización concurrente del mismo objeto, se conserva
la última escritura confirmada; no hay control de versiones específico del cliente.

Los tipos están exportados desde `@evoria/contracts`: `EventClient`, `EventItem`,
`CreateEventRequest`, `UpdateEventRequest`, `EventList`, `EventQuery` y `EventStatus`.
`EventItem.client` admite `null` por compatibilidad histórica; en la creación es
obligatorio. No se cambian los contratos de reportes o PDF en esta entrega.

## Seguridad y errores

La empresa y el usuario provienen de la sesión. Enviar `tenantId`, propietario u
otros campos no autorizados no cambia la empresa del evento. Se conserva el
whitelist global de DTOs, también para el objeto anidado. No hay rutas públicas
para consultar clientes por identificación o correo.

Quien tenga permisos de consulta de eventos en la empresa puede consultar sus
clientes; no se añade un permiso separado para datos de clientes. Los datos no se
copian a mensajes de alertas, solicitudes de presupuesto o auditorías de edición.
Frontend debe evitar mostrar estos datos a personas sin acceso al evento y no
persistirlos en logs o almacenamiento público.

| Estado | Casos                                                                             |
| ------ | --------------------------------------------------------------------------------- |
| `400`  | Cliente faltante, incompleto, formato inválido o identificador de evento inválido |
| `401`  | Sesión inválida o membresía inactiva                                              |
| `403`  | Permisos insuficientes o contexto sin empresa activa                              |
| `404`  | Evento inexistente o perteneciente a otra empresa                                 |
| `409`  | Evento cancelado o conflicto con las reglas actuales de edición                   |

## Operación y pruebas

No requiere migraciones, seeds ni permisos nuevos. No se modifican bases
compartidas ni se rellena información histórica mediante scripts. El subdocumento
MongoDB admite ausencia para conservar los eventos antiguos; la obligatoriedad en
eventos nuevos se aplica en el DTO y en `EventsService.create`.

Desde `apps/api`, pruebas unitarias:

```powershell
node --require ts-node/register --test src/events/event-clients.spec.ts src/events/events.service.spec.ts
```

Para HTTP, levantar la réplica **aislada** del proyecto desde la raíz y después
ejecutar las pruebas desde `apps/api`:

```powershell
docker compose -f compose.alertas-test.yaml up -d --wait
# Desde apps/api:
$env:EVORIA_TEST_MONGO_URI='mongodb://127.0.0.1:27129/?replicaSet=evoriaAlertTest&directConnection=true'
node --require ts-node/register --test src/events/event-clients.http.mongo.spec.ts src/events/operations.http.mongo.spec.ts
```

Las pruebas crean y eliminan bases aleatorias. Nunca usar una base compartida como
destino de las pruebas. La suite general de integración incluye la prueba de clientes.
