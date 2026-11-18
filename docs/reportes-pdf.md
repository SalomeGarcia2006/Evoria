# Exportación empresarial PDF: guía para frontend

El backend genera documentos A4 con tipografía Lato incrustada, identidad EVORIA,
azul corporativo y acentos turquesa, indicadores, tablas con encabezados repetidos,
gráfico de ejecución presupuestal y numeración de páginas. Incluye empresa,
fecha de generación, usuario y referencia documental. Las tablas extensas continúan
en otra página; no se recortan silenciosamente los registros.

## Contrato HTTP

`GET /api/reports/export/:kind?format=pdf` devuelve el archivo binario con
`Content-Type: application/pdf`, `Content-Disposition: attachment` y
`Cache-Control: private, no-store`. No viene envuelto en `{data,message}`.
Requiere la sesión habitual, membresía activa en la empresa y `reportes.ver`.
La empresa siempre se obtiene de la sesión. No se recibe `tenantId`.

| kind        | Contenido                                               | Permisos adicionales                                        |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| `events`    | Portafolio, estados, fechas e invitados                 | `eventos.ver`                                               |
| `budgets`   | Asignado, gasto, saldo y composición del gasto          | `eventos.ver`, `presupuestos.ver`                           |
| `inventory` | Referencias, cantidades, estado y stock bajo            | `inventario.ver`                                            |
| `resources` | Recursos actualmente asignados por evento               | `eventos.ver`, `inventario.ver`, `asignaciones.ver`         |
| `providers` | Servicios agrupados por proveedor y estado              | `eventos.ver`, `proveedores.ver`, `servicios_proveedor.ver` |
| `schedules` | Avance de actividades por evento                        | `eventos.ver`, `cronogramas.ver`                            |
| `event`     | Ficha detallada de un evento; requiere `eventId`        | `eventos.ver`                                               |
| `company`   | Contexto empresarial y secciones operativas autorizadas | `empresa_contexto.ver`                                      |
| `teams`     | Equipos de la empresa o ficha de uno con `teamId`       | `equipos.ver`                                               |

Las seis primeras rutas reutilizan los reportes actuales y sus filtros documentados
en [reportes-backend.md](reportes-backend.md). `page` y `limit` se validan, pero
la descarga incluye todas las filas filtradas. Inventario solo admite
`inventoryStatus` como filtro de datos. Los otros cinco reportes admiten los
filtros de eventos existentes. Las fechas del PDF se muestran en
`America/Bogota`; envíen fechas ISO con zona explícita para delimitar días locales.

Ejemplos:

```text
GET /api/reports/export/event?format=pdf&eventId=64a000000000000000000001
GET /api/reports/export/company?format=pdf
GET /api/reports/export/teams?format=pdf&teamId=64a000000000000000000002
GET /api/reports/export/inventory?format=pdf&inventoryStatus=disponible
GET /api/reports/export/budgets?format=pdf&from=2026-01-01T05:00:00Z&to=2027-01-01T04:59:59Z
```

`event` admite `eventId`, sin filtros de listado; también permite consultar el
historial de un evento cancelado. `teams` admite únicamente `teamId` como filtro;
sin él lista todos los equipos. `teamId` no se admite en otros tipos ni en CSV.
`company` aplica los filtros de eventos a sus secciones de eventos, presupuesto,
proveedores y cronogramas; `inventoryStatus` a inventario. Equipos refleja el
estado actual. Una sección puede estar vacía para los filtros elegidos.

Omitir `format` conserva CSV y su contrato anterior. Los tipos `event`, `company`
y `teams` están disponibles exclusivamente como PDF; no añaden rutas JSON de listado.
Los contratos compartidos exportan `PdfReportKind`, `ReportExportFormat` y
`ReportExportQuery` desde `@evoria/contracts`.

## Secciones y privacidad

La ficha de evento incluye fechas, descripción, ubicación e invitados. Solo añade
presupuesto con `presupuestos.ver`, recursos con los permisos de `resources`,
servicios con los de `providers` y actividades con los de `schedules`.
El informe de empresa agrega únicamente los módulos que el usuario puede consultar.
La ficha de equipo añade actividades cuando se dispone de `eventos.ver` y
`cronogramas.ver`.

Los nombres de responsables e integrantes requieren `usuarios.ver`, usuario activo
y membresía activa en esa empresa. Una referencia externa inválida se muestra como
no disponible; no se usa para consultar nombres de otra empresa. Sin ese permiso
se indica la asignación sin identificar a la persona. El NIT se incluye solo con
`empresa_contexto.ver`. No se exportan correos, contraseñas ni tokens.

Los costos de recursos y servicios requieren `presupuestos.ver`, incluso si el
usuario puede consultar el módulo operativo. Montos expresados en COP. Presupuesto
sin inicializar y asignado igual a cero se distinguen; no se inventa porcentaje.
Solo servicios confirmados están asignados; el acuerdo de una solicitud pendiente
no representa un cargo. Gasto registrado no certifica pagos ni utilidad. Invitados
registrados no certifica asistencia. Disponibles excluye recursos en mantenimiento,
aunque sus cantidades físicas figuren en las filas del inventario.

## Descarga desde el cliente

Ejemplo de consumo con la sesión basada en cookies; utilicen el cliente HTTP y
los manejadores de sesión habituales del proyecto al integrarlo:

```ts
async function descargarFichaEvento(eventId: string) {
  const query = new URLSearchParams({ format: 'pdf', eventId });
  const response = await fetch(`/api/reports/export/event?${query}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message ?? 'No fue posible exportar el PDF.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'evoria-evento.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
```

Ofrezcan selección del tipo de reporte y filtros pertinentes, un estado de descarga
y mensajes claros si faltan permisos o hay demasiados datos. La generación es
sincrónica y no almacena copias en el servidor. Esta entrega no modifica la interfaz.

## Límites, errores y operación

- `400`: formato/tipo/filtros/identificadores inválidos, o exportación demasiado
  extensa. Máximo 500 registros por sección, 100 páginas y 15 MiB. Reducir filtros;
  no se devuelve un PDF parcial. CSV conserva su límite de 5000 filas.
- `401`: sesión inválida o membresía inactiva.
- `403`: permiso requerido ausente o revocado.
- `404`: evento/equipo no encontrado dentro de la empresa activa.

Los errores mantienen el formato JSON habitual de la API. Las exportaciones
consultan datos actuales de los servicios y modelos existentes. No son una
instantánea transaccional de todas las colecciones ni un archivo histórico firmado;
si los datos cambian durante la consulta, pueden reflejar instantes diferentes.
La referencia identifica el documento generado, no un registro recuperable.

No requiere migraciones, seeds ni permisos nuevos. Ejecutar `npm ci` y compilar
la API instala PDFKit y las fuentes empaquetadas. No necesita navegador, Python,
acceso a fuentes externas ni cambios de Docker. La identidad visual es fija EVORIA;
no se implementó personalización de logo por empresa ni PDF etiquetado PDF/UA.

## Verificación y muestras

Prueba unitaria del renderizador desde `apps/api`:

```powershell
node --require ts-node/register --test src/reports/report-pdf.renderer.spec.ts
```

Pruebas HTTP reales, exclusivamente contra MongoDB aislado:

```powershell
# Desde la raíz; usa el entorno de pruebas existente, no bases compartidas.
docker compose -f compose.alertas-test.yaml up -d --wait
# Después, desde apps/api:
$env:EVORIA_TEST_MONGO_URI='mongodb://127.0.0.1:27129/?replicaSet=evoriaAlertTest&directConnection=true'
node --require ts-node/register --test src/reports/reports-pdf.http.mongo.spec.ts src/reports/reports.http.mongo.spec.ts
```

La suite crea y elimina su propia base aleatoria; no escribir una URI compartida.
También está incluida en `npm run test:integration`.
Para regenerar las cuatro muestras con datos ficticios, establecer
`EVORIA_PDF_QA_DIR` a una carpeta de salida antes de ejecutar la prueba PDF.
Las muestras incluyen un aviso visible de demostración. La verificación visual
de esta entrega renderiza todas sus páginas y comprueba márgenes y superposiciones;
Python se utiliza solo en esa inspección local, no en el backend.
