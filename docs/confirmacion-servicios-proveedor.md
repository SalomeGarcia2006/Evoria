# Servicios de proveedor: confirmación por correo

## Comportamiento disponible

Crear un servicio genera una solicitud **pendiente** y un correo en cola. No
reserva saldo ni registra gasto. El proveedor revisa las condiciones y acepta
o rechaza desde un enlace, sin necesitar una cuenta de EVORIA.

| Estado               | Significado                                                   | Cargo vigente                              |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| `pendiente`          | Espera respuesta                                              | No                                         |
| `aceptado_sin_saldo` | Aceptó, falta saldo o presupuesto inicial                     | No                                         |
| `confirmado`         | Servicio efectivamente asignado                               | Sí                                         |
| `rechazado`          | No aceptó                                                     | No                                         |
| `vencido`            | Terminó el plazo de respuesta                                 | No                                         |
| `cancelado`          | Cancelado por usuario, falta de saldo o entidad no disponible | No; devuelve el cargo si estaba confirmado |

El proveedor dispone de 24 horas desde la emisión de la solicitud en la API,
no desde la apertura del correo. El correo incluye el vencimiento exacto. Los
reintentos automáticos de envío no lo prolongan. Puede aceptar aunque haya pasado
la hora de inicio propuesta; esto confirma el acuerdo del servicio, no registra
que la actividad se realizó ni cambia las fechas.

Si acepta sin saldo suficiente, la empresa tiene otras 24 horas desde `acceptedAt` para
conseguirlo. Las ampliaciones aprobadas por Presupuestos, la inicialización del
presupuesto y las devoluciones de costos de inventario o proveedores confirman
automáticamente los servicios aceptados que pueden cubrirse, dentro de la misma
transacción que hace disponible el saldo. Se atienden por `acceptedAt` y luego
por ID. No se crea otro sistema de autorización. Existe también una conciliación
periódica para recuperación tras reinicios. Al vencer el plazo sin confirmarse,
se cancela la solicitud sin gasto.

**No se pueden editar servicios.** Para cambiar condiciones, hay que cancelar
y crear otra solicitud. Cancelar conserva el historial y devuelve el cargo una
sola vez cuando corresponde. Se avisa al proveedor por correo; los registros
históricos que solo tienen teléfono no pueden recibirlo.

## Rutas internas para frontend

Todas obtienen usuario y empresa de la sesión y exigen membresía activa.

| Ruta                                                     | Permisos                                       | Resultado                                                         |
| -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `POST /api/events/:eventId/provider-services`            | `servicios_proveedor.crear`, `proveedores.ver` | 201, solicitud `pendiente` y estado de entrega del correo         |
| `GET /api/events/:eventId/provider-services`             | `servicios_proveedor.ver`                      | 200, pendientes vigentes, aceptados esperando saldo y confirmados |
| `POST /api/events/:eventId/provider-services/:id/resend` | `servicios_proveedor.crear`, `proveedores.ver` | 201, reenvío y estado de entrega del correo                       |
| `DELETE /api/events/:eventId/provider-services/:id`      | `servicios_proveedor.cancelar`                 | 200, cancelación idempotente                                      |
| `PATCH /api/events/:eventId/provider-services/:id`       | `servicios_proveedor.editar`                   | 409; edición deshabilitada                                        |

Cancelar y reenviar requiere además ser **el solicitante o el responsable vigente
del evento** (`responsibleUserId`). Tener permisos de administrador sin esas
relaciones no permite hacerlo. El responsable anterior pierde su facultad por
ese rol; el solicitante conserva la suya mientras mantenga sus permisos.

El listado admite `status` con cualquiera de los estados de la tabla. La sección
de recursos efectivamente asignados debe consultar **`status=confirmado`**.
`includeCancelled=true` devuelve el historial de todos los estados; `status`,
si se envía, tiene prioridad. El listado activo oculta solicitudes cuyo plazo
ya venció, aunque el worker todavía no haya guardado su estado terminal.

Reenviar invalida el enlace anterior y abre otras 24 horas. Solo se admite para
solicitudes pendientes aún vigentes, con al menos un minuto entre emisiones
manuales. Si cambió el proveedor o su correo, cancelar y crear otra solicitud.

Ejemplo de creación:

```json
{
  "providerId": "64a000000000000000000001",
  "serviceName": "Sonido principal",
  "description": "Instalación y operación del sonido",
  "startDate": "2030-01-10",
  "startTime": "10:00",
  "endDate": "2030-01-10",
  "endTime": "18:00",
  "agreedAmountCop": 200000,
  "idempotencyKey": "2cf0b0e0-b7aa-4dab-83a7-42573b9dcf27"
}
```

Frontend debe generar un UUID por intento lógico de creación y conservarlo si
reintenta porque perdió la respuesta. La misma clave y datos devuelven la misma
solicitud sin otro correo; la misma clave con otros datos devuelve 409. Para
una solicitud nueva, generar otra clave. Sin clave, cada creación es independiente;
se permiten varios servicios del mismo proveedor para un evento.

Se mantiene `{ data, message }`. El servicio conserva sus campos y añade:
`responseExpiresAt`, `acceptedAt`, `respondedAt`, `responseDecision`, `fundingExpiresAt`, `confirmedAt`,
`rejectionReason`, `cancellationReason`, `emailDelivery` y `emailSentAt`.
Las fechas son ISO 8601 o `null`. `emailDelivery` es `queued`, `failed`, `sent`
o `null` para registros anteriores al flujo. `sent` significa aceptado por SMTP,
no leído ni recibido en el buzón. No se devuelven tokens ni sus huellas.
`emailDelivery` y `emailSentAt` describen la invitación, no el aviso posterior
de cancelación. `responseDecision` es `aceptar`, `rechazar` o `null` y permite
distinguir una aceptación seguida de cancelación de una solicitud sin respuesta.

`cancellationReason` identifica `cancelado_por_usuario`, `sin_saldo_en_24h`,
`sin_respuesta_en_24h`, `rechazado_por_proveedor` o
`evento_o_proveedor_no_disponible`, según el estado terminal. El motivo opcional
del proveedor está en `rejectionReason`.

Los montos acordados pendientes pueden figurar en el historial del presupuesto,
pero no son gasto. Usar los totales reales de Presupuestos; no sumar todas las
líneas históricas de `agreedAmountCop`. Los contratos están en
`packages/contracts/src/provider-services.ts` y `packages/contracts/src/budgets.ts`.

## Respuesta pública del proveedor

`GET /api/provider-service-confirmation` entrega una página mínima desde la API;
no requiere modificar `apps/web`. El correo lleva ID y token en el fragmento
`#id=...&token=...`, que no se envía como query a los registros HTTP. La página
retira ese fragmento de la dirección y consulta mediante JSON:

- `POST /api/provider-service-confirmation/details`: `{ serviceId, token }`.
- `POST /api/provider-service-confirmation/respond`:
  `{ serviceId, token, decision: "aceptar" | "rechazar", reason?: string }`.

Ambas devuelven 201 con `{ data, message }`. `data` incluye `serviceId`,
`eventName`, condiciones, monto, `status`, `responseExpiresAt`, `fundingExpiresAt`
y `canRespond`. No se expone el presupuesto ni el directorio de la empresa.
El enlace es una credencial: no compartirlo. Deja de estar disponible si la
empresa/proveedor está inactivo o cambió el correo del proveedor.

Abrir la página o consultar detalles **no registra una decisión**. Se requiere
una acción explícita, para que los escáneres de correo no acepten servicios.
La página usa CSP, evita caché y referentes y no permite ser embebida.

Si se pierde la respuesta de una aceptación o rechazo, repetir la misma decisión
con el mismo enlace devuelve el estado actual sin repetir el cargo. Cambiar la
decisión después de responder devuelve 409. Repetir una aceptación de un servicio
que luego se canceló no lo reactiva.

## Alertas personales y errores

`type=provider_service` mantiene una alerta por solicitud y destinatario, dirigida
al solicitante. Su ID es estable; título y `serviceStatus` cambian según la
solicitud. Las transiciones nuevas vuelven a marcarla sin leer. Entregas antiguas
no retroceden el estado ni reinician su lectura.

Alertas añade `providerServiceId` y `serviceStatus`, conservando las rutas de
consulta, conteo y lectura. Ver esta alerta requiere membresía activa,
`alertas.ver`, `eventos.ver` y `servicios_proveedor.ver`. Leerla no confirma nada.
La revocación de permisos impide consultarla, aunque se conozca el ID.

Errores: 400 para datos inválidos, montos fuera del rango entero seguro de COP o
proveedor sin correo; 401 para sesión/membresía inválida; 403 para permisos o
relación insuficientes; 404 para entidades ajenas o enlaces inválidos; 409 para
solicitudes vencidas/decididas, evento cancelado, edición o reenvío prohibidos;
503 para configuración insegura o ausente del enlace/secreto de confirmación.

## Consistencia, reintentos y operación

La respuesta y el gasto comparten una transacción MongoDB con lectura snapshot
y escritura majority. Se escriben revisiones compartidas del evento y proveedor
para detectar cambios concurrentes; el cargo exige saldo suficiente de forma
atómica. No se usan bloqueos persistentes de decisión.

La cola de correo se guarda en la transacción de creación/cancelación. Las
alertas usan la cola persistente existente. Una entrega fallida no pierde el
acontecimiento ni altera el presupuesto. Las revisiones evitan que entregas
concurrentes o fuera de orden sobrescriban el estado reciente de una alerta.

En servidores persistentes, el procesador recupera trabajos al iniciar y cada
15 segundos; los errores se reintentan con espera creciente. Los correos usan reclamaciones recuperables
de 60 segundos. SMTP puede duplicar un correo si se pierde su confirmación o
el proceso se interrumpe tras enviarlo; no se garantiza entrega exactamente una
vez. Esos correos apuntan a la misma solicitud, cuya decisión y cargo sí son
idempotentes. Los trabajos terminados se limpian por TTL después de 90 días,
sin borrar el historial del servicio.

Los cambios visibles de alertas y vencimientos son asíncronos. Una respuesta
fuera de plazo se bloquea inmediatamente, aunque el worker no haya guardado aún
`vencido`. Los pendientes se cancelan si el evento se cancela o el proveedor
deja de estar disponible. Cancelar el evento conserva el gasto histórico de
servicios confirmados: para devolver ese costo, cancelar expresamente el servicio.

## Configuración y transición

Usar MongoDB como réplica, como requiere el backend transaccional del proyecto.
Configurar mediante `.env` o el gestor de secretos:

```dotenv
API_PUBLIC_URL=https://api.ejemplo.com/api
PROVIDER_CONFIRMATION_SECRET=secreto-aleatorio-de-al-menos-32-caracteres
BREVO_SMTP_USER=usuario-smtp
BREVO_SMTP_KEY=clave-smtp
MAIL_FROM_EMAIL=remitente-verificado@ejemplo.com
```

La API usa únicamente Brevo para los correos de proveedores y los códigos de
autenticación. Las tres variables anteriores deben estar disponibles para el
proceso de la API; no se incluyen claves en Git.

En desarrollo se permite `http://localhost:3001/api`; una URL pública debe usar
HTTPS y ser accesible para el proveedor. El prefijo `/api` forma parte de la
URL. El secreto debe ser igual en todas las instancias y conservarse al reiniciar.
No usar el valor de ejemplo. Al rotarlo, reenviar manualmente las solicitudes
vigentes: los reintentos de correos antiguos no pueden regenerar el token anterior.

En un servidor persistente, el worker está habilitado por defecto y procesa la
cola cada 15 segundos; `PROVIDER_WORKER_ENABLED=false` se reserva para pruebas
controladas. En Vercel no se inicia ese temporizador: la petición de creación,
reenvío o cancelación procesa sus correos antes de responder. Así el envío no
depende de que la función continúe ejecutándose después de enviar la respuesta.
Si SMTP falla, `emailDelivery=failed` queda visible y el usuario puede reenviar
la solicitud pendiente después de un minuto. Los reintentos automáticos y la
conciliación periódica en Vercel requieren un proceso persistente o un programador
con frecuencia adecuada; el temporizador de la aplicación no los proporciona allí.
Compose propaga URL y secreto. Si SMTP falla o falta su configuración, crear la
solicitud no se presenta como un correo entregado.

No hay seed nuevo. Los índices y campos son aditivos. Los servicios históricos
conservan estados y montos; no se pide aceptación retroactiva. Coordinar el cambio
del contrato de creación con frontend antes de usarlo en un entorno compartido.
Detener las versiones anteriores de la API durante la transición, pues su ruta
de creación confirmaría servicios inmediatamente. Para revertir, detener las
instancias nuevas y resolver/cancelar pendientes antes de volver a una versión
que solo conozca `confirmado` y `cancelado`; no borrar colecciones.

## Pruebas aisladas

Desde la raíz:

```powershell
docker compose -f compose.alertas-test.yaml up -d --wait
```

Desde `apps/api`:

```powershell
$env:EVORIA_TEST_MONGO_URI='mongodb://127.0.0.1:27129/?replicaSet=evoriaAlertTest&directConnection=true'
$env:EVORIA_TEST_FAILPOINTS='1'
node --require ts-node/register --test src/provider-services/provider-service-workflow.http.mongo.spec.ts
```

La suite crea y elimina su propia base aleatoria. Los casos de confirmación
incierta e interrupción del proceso usan failpoints y parámetros de la instancia
aislada en `127.0.0.1:27129`; nunca apuntar a una base compartida. SMTP se simula:
las pruebas comprueban el procesamiento real del correo, no la recepción en un
buzón externo. Antes de desplegar, verificar el remitente Brevo y la accesibilidad
del enlace mediante un correo de prueba autorizado.

Validación realizada en esta implementación: 49 pruebas unitarias; 12 casos del
nuevo recorrido HTTP (más su prueba contenedora); siete pruebas de regresión con
MongoDB aislado; typecheck de API, contratos y web; y build de API aprobados.
Se verificaron una interrupción real del proceso durante una aceptación y una
confirmación incierta de la transacción, sin duplicar el gasto.

En Windows, el ejecutor habitual de unitarias falla por la ruta de Node con
espacios; las 49 pruebas se ejecutaron directamente. El lint habitual reporta
960 errores de finales de línea existentes; la revisión completa con
`endOfLine: auto` pasó. Docker no estaba instalado en el equipo: se validó la
sintaxis YAML y se usó un `mongod` aislado con réplica de un nodo para las pruebas,
sin afirmar que se haya levantado Compose aquí.
