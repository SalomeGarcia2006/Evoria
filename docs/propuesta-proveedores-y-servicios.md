# Propuesta: proveedores y servicios para eventos

Estado: propuesta funcional y técnica para coordinar backend y frontend. Las rutas, colecciones y permisos descritos aquí aún no están implementados.

## Objetivo

Mantener un directorio de contactos de proveedores y registrar los servicios que una empresa acuerda con ellos para sus eventos. La negociación y la confirmación de disponibilidad ocurren fuera de Evoria (por ejemplo, por teléfono o correo). Quien organiza el evento registra después el acuerdo en la aplicación.

Un proveedor es un contacto reutilizable. Un servicio asignado es un acuerdo concreto para un evento, con descripción, fecha de prestación y valor pactado. No representa unidades de inventario ni modifica existencias.

## Decisiones de producto

- Cada proveedor puede tener una o varias categorías. Esto permite encontrar, por ejemplo, una hacienda que también ofrece alimentación sin duplicar su contacto. El filtro por categoría muestra los proveedores que tengan esa categoría.
- Las categorías clasifican al proveedor, no definen un catálogo de servicios ni un precio. Propuesta inicial: transporte, alimentación, espacios, decoración, audiovisual y otros. El nombre específico del servicio se escribe al asignarlo.
- La disponibilidad no se administra como calendario. El usuario confirma el acuerdo con el proveedor antes de registrarlo.
- La fecha de prestación es obligatoria; la hora y el fin son opcionales. Para una cena puede bastar una fecha y una hora de inicio; para el alquiler de un lugar se puede indicar un intervalo de varios días. La interfaz debe llamar a este dato **fecha acordada de prestación**, para no sugerir que Evoria comprobó disponibilidad.
- El valor es el total acordado para ese servicio y ese evento, ingresado manualmente. No se toma de inventario ni de una tarifa fija del proveedor. La propuesta usa COP, como las cantidades monetarias que hoy muestra Recursos.
- Un mismo proveedor puede prestar varios servicios al mismo evento y participar en varios eventos. Cada acuerdo tiene su propio registro e identificador.

## Flujo de usuario

1. En **Proveedores**, la persona registra o consulta contactos y los filtra por categoría o nombre.
2. Se comunica con el proveedor por fuera de la aplicación y confirma servicio, fecha y valor.
3. En **Recursos → Asignaciones**, selecciona el evento. Junto a los recursos de inventario aparece una sección independiente, **Servicios de proveedores**.
4. Pulsa **Asignar servicio de proveedor**. Una ventana emergente permite buscar y seleccionar un proveedor activo, escribir el nombre del servicio, ampliar su descripción, indicar la fecha acordada y registrar el valor total pactado.
5. Al guardar, el servicio aparece en la lista del evento. Puede consultarse o corregirse; si el acuerdo deja de aplicar, se cancela conservando el historial.

Ejemplos: `Cena principal` con inicio el día del evento a las 19:00; `Alquiler de hacienda` desde el día anterior hasta el día posterior; `Transporte de recursos` con fecha y hora de recogida. Cada ejemplo es una asignación independiente, aunque pertenezca al mismo proveedor.

## Frontend propuesto

### Directorio de proveedores (`/proveedores`)

- Añadir **Proveedores** a la navegación para quien tenga permiso de consulta.
- Mostrar nombre, categorías, persona de contacto, teléfono, correo, ubicación y estado. Permitir búsqueda por nombre o contacto y filtro por categoría; una categoría seleccionada coincide con cualquiera de las categorías del proveedor.
- Ofrecer creación, edición y desactivación según permisos. En el formulario, exigir nombre, al menos una categoría y por lo menos un medio de contacto (teléfono o correo). Persona de contacto, ubicación y notas pueden quedar vacíos.
- Mostrar una vista vacía comprensible, estados de carga y error, y confirmación antes de desactivar. Un proveedor desactivado sigue visible en asignaciones históricas, pero no aparece en el selector de nuevos servicios.

### Servicios en Recursos (`/recursos/asignaciones`)

- Conservar el selector de evento actual y la sección de recursos de inventario. Debajo o al lado, mostrar **Servicios de proveedores** con lista propia y acción **Asignar servicio de proveedor**. Las dos secciones deben distinguir visualmente las reservas de unidades y los acuerdos de servicios.
- Deshabilitar la acción hasta seleccionar un evento. Para un evento cancelado, permitir consulta y cancelación de acuerdos existentes, pero impedir nuevas asignaciones, como ya sucede con los recursos de inventario.
- En la ventana emergente, mostrar: proveedor (selector con búsqueda y categoría), nombre del servicio, descripción detallada, fecha de inicio, hora de inicio opcional, fecha y hora de fin opcionales, y valor total acordado en COP. El proveedor se selecciona del directorio; los demás datos se escriben para este acuerdo.
- Mostrar errores junto a cada campo y conservar los valores si falla el guardado. Tras guardar, cerrar la ventana, refrescar solo la lista de servicios y anunciar el resultado.
- En la lista del evento, mostrar proveedor, servicio, fecha o intervalo, valor y estado. Incluir acciones de editar y cancelar según permisos. La cancelación pide confirmación y no borra el registro.
- Si la fecha acordada cae fuera del intervalo del evento, mostrar una advertencia, pero permitir guardar: montaje, preparación y desmontaje pueden ocurrir antes o después del evento.

## Backend propuesto

### Datos

**Proveedor** (`providers`): `id`, `tenantId`, `name`, `categoryKeys[]`, `contactName?`, `phone?`, `email?`, `location?`, `notes?`, `status` (`activo | inactivo`), `createdBy`, `createdAt`, `updatedAt`. El proveedor pertenece a una empresa. No contiene precios, disponibilidad ni servicios ofertados como registros separados.

**Servicio asignado** (`event_provider_services`): `id`, `tenantId`, `eventId`, `providerId`, `serviceName`, `description`, `startDate`, `startTime?`, `endDate?`, `endTime?`, `agreedAmountCop`, `status` (`confirmado | cancelado`), `assignedBy`, `createdAt`, `updatedAt`, `cancelledAt?`. `startDate` y `endDate` son fechas de calendario (`YYYY-MM-DD`); las horas opcionales se guardan aparte (`HH:mm`) para no desplazar el día por una conversión implícita de zona horaria. El acuerdo guarda su propio nombre, descripción y valor: editar el contacto del proveedor no cambia lo pactado.

Índices sugeridos: proveedores por `(tenantId, name)` y `(tenantId, categoryKeys, status)`; servicios por `(tenantId, eventId, status)` y `(tenantId, providerId)`. No imponer unicidad entre proveedor y evento, porque puede haber varios servicios distintos.

### API sugerida

Seguir el patrón actual de respuestas `{ data, message }` y de paginación de listados de la API.

| Operación | Ruta                                                    | Uso                                                                                   |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET`     | `/api/providers?search=&category=&status=&page=&limit=` | Buscar y filtrar el directorio de la empresa activa.                                  |
| `POST`    | `/api/providers`                                        | Crear contacto.                                                                       |
| `GET`     | `/api/providers/:id`                                    | Consultar contacto.                                                                   |
| `PATCH`   | `/api/providers/:id`                                    | Editar contacto y categorías.                                                         |
| `DELETE`  | `/api/providers/:id`                                    | Desactivar sin borrar referencias históricas.                                         |
| `GET`     | `/api/events/:eventId/provider-services`                | Listar acuerdos del evento, incluidos los cancelados cuando se solicite el historial. |
| `POST`    | `/api/events/:eventId/provider-services`                | Registrar el servicio confirmado.                                                     |
| `PATCH`   | `/api/events/:eventId/provider-services/:id`            | Corregir los datos de un acuerdo confirmado.                                          |
| `DELETE`  | `/api/events/:eventId/provider-services/:id`            | Marcar el acuerdo como cancelado, sin eliminarlo físicamente.                         |

Ejemplo de cuerpo para crear un servicio:

```json
{
  "providerId": "<id-del-proveedor>",
  "serviceName": "Cena principal",
  "description": "Cena para 80 invitados, incluye personal de servicio",
  "startDate": "2026-12-05",
  "startTime": "19:00",
  "endDate": "2026-12-05",
  "endTime": "22:00",
  "agreedAmountCop": 3200000
}
```

### Validaciones y permisos

- Derivar siempre `tenantId` de la sesión. Verificar que proveedor, evento y servicio pertenezcan a la misma empresa antes de leer o modificar. La web solo oculta acciones; la API aplica las reglas.
- Validar identificadores, longitud de textos, categorías admitidas, correo cuando exista, al menos un contacto, fecha válida, fin no anterior al inicio y valor acordado mayor que cero. Exigir fecha de fin si se informa hora de fin. No inventar una comprobación automática de disponibilidad.
- No permitir asignar a un evento cancelado ni seleccionar un proveedor inactivo para un nuevo acuerdo. Mantener la consulta de acuerdos antiguos aunque el proveedor se desactive.
- Proponer permisos empresariales separados: `proveedores.ver`, `proveedores.crear`, `proveedores.editar`, `proveedores.desactivar`; y `servicios_proveedor.ver`, `servicios_proveedor.crear`, `servicios_proveedor.editar`, `servicios_proveedor.cancelar`. La ventana necesita además `proveedores.ver` para seleccionar el contacto. Así la gestión del directorio puede delegarse por separado de la asignación a eventos.
- Compartir los tipos de solicitud y respuesta entre API y web mediante `packages/contracts`, siguiendo la estructura del monorepo.

## Límites de esta propuesta

El directorio no hace reservas, consulta agendas, envía mensajes, gestiona pagos ni calcula precios. El monto pactado queda disponible como dato del acuerdo; su incorporación automática a Presupuestos requiere definir primero cómo se suman y editan los demás costos de esa pantalla. Esa integración puede abordarse después sin mezclar servicios con inventario.

## Criterios de aceptación

1. Una empresa puede crear un proveedor con varias categorías y encontrarlo al filtrar por cualquiera de ellas; otra empresa no puede verlo.
2. Seleccionado un evento, una persona autorizada registra dos servicios distintos del mismo proveedor con fechas y valores diferentes.
3. Registrar o cancelar un servicio no cambia cantidades disponibles ni reservadas del inventario.
4. Un proveedor desactivado conserva sus acuerdos anteriores y no puede elegirse para uno nuevo.
5. Un evento cancelado muestra sus servicios, pero no permite agregar otros.
6. El valor y la descripción de un acuerdo se conservan aunque se edite el contacto del proveedor.
