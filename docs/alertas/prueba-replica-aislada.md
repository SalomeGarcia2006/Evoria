# Pruebas de alertas con MongoDB aislado

`transactions.mongo.spec.ts` ejecuta servicios reales de EVORIA;
`replica-feasibility.mongo.spec.ts` comprueba propiedades de MongoDB con
documentos de ejemplo. Ambas crean y eliminan bases con nombres aleatorios de
prueba. No las ejecute contra una instancia compartida.

Con Docker instalado, compruebe primero que el puerto 27129 esté libre y, desde
la raíz, inicie el servicio de prueba independiente:

```powershell
Test-NetConnection 127.0.0.1 -Port 27129
docker compose -f compose.alertas-test.yaml up -d
docker compose -f compose.alertas-test.yaml ps
```

Espere a que esté `healthy`. Es una instancia sin autenticación publicada solo
en `127.0.0.1`, con comandos de prueba activados: no es apropiada para entornos
compartidos. No usa el volumen ni el puerto de la base de desarrollo. La
dirección anunciada es válida desde el anfitrión, no desde un contenedor de API.

Para iniciar la API local desde el anfitrión contra esa réplica de prueba, use
una base de prueba distinta de cualquier base existente y establezca antes de
arrancarla la variable `MONGODB_URI`, además de las demás variables habituales
de la API:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27129/evoria_alertas_local?replicaSet=evoriaAlertTest'
npm.cmd run dev --workspace=@evoria/api
```

Esa base temporal está vacía; los usuarios y permisos necesarios para probar la
API deben crearse mediante los seeds del proyecto dirigidos explícitamente a
esta URI, nunca sobre la base compartida. Las suites automatizadas usan sus
propias bases aleatorias y no requieren esos seeds.

También puede iniciar manualmente MongoDB 9 y `mongosh` en Windows. Tras
comprobar que el puerto esté libre, cree un directorio vacío y ejecute:

```powershell
$testDir = Join-Path $env:TEMP ('evoria-alertas-rs-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testDir
& 'C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe' --dbpath $testDir --port 27129 --bind_ip 127.0.0.1 --replSet evoriaAlertTest --setParameter transactionLifetimeLimitSeconds=5 --setParameter enableTestCommands=1
```

En otra consola inicialice la réplica y espere a que sea primaria:

```powershell
mongosh --quiet --host 127.0.0.1 --port 27129 --eval "rs.initiate({_id:'evoriaAlertTest',members:[{_id:0,host:'127.0.0.1:27129'}]})"
```

Desde `apps/api`, con la réplica de prueba levantada:

```powershell
node --require ts-node/register --test src/alerts/replica-feasibility.mongo.spec.ts
$env:EVORIA_TEST_MONGO_HOST='127.0.0.1:27129'
npm.cmd run test:alerts:mongo
$env:EVORIA_TEST_FAILPOINTS='1'
npm.cmd run test:alerts:transactions
Remove-Item Env:EVORIA_TEST_FAILPOINTS
```

Si la instancia aislada tiene autenticación, use `EVORIA_TEST_MONGO_URI` con
una URI de esa instancia, sus credenciales de prueba, `authSource=admin`, el
nombre de réplica correcto y `directConnection=true`. Las suites sustituyen el
nombre de base de la URI por uno aleatorio; el puerto debe ser 27129 para los
fallos simulados. No coloque credenciales reales en comandos compartidos ni en
el repositorio.

La última prueba configura fallos globales temporales de `commitTransaction`
(desconexión y error de reconocimiento de escritura) en esa instancia: no la
ejecute en paralelo con otras suites ni con datos o procesos ajenos. El tiempo
de cinco segundos solo acelera la limpieza de transacciones abandonadas en la
instancia de prueba; no es una recomendación para otros entornos. Detenga solo
el proceso o servicio temporal al terminar, sin borrar volúmenes existentes.

## Antes de usar la API en un entorno compartido

Las rutas transaccionales requieren una réplica. La configuración habitual
ahora usa volúmenes separados para la réplica local; una instancia anterior
independiente no se convierte automáticamente. El equipo debe preparar y
ensayar sobre una copia aislada:

1. Una copia de seguridad verificable y un plan de restauración; no convertir
   ni reinicializar un volumen existente sin el procedimiento del entorno.
2. Réplica y autenticación interna por keyfile o certificados, credenciales,
   permisos, conexión `replicaSet`, DNS y direcciones anunciadas accesibles para
   todas las instancias de API. Una réplica de un nodo no da alta disponibilidad.
3. Parar todas las instancias de la versión anterior y revisar los posibles
   `budgetDecisionLock` heredados. El procedimiento de recuperación documentado
   en `informe-frontend.md` exige confirmar que no queda ningún proceso anterior.
4. Probar índices, inicio, transacciones, reinicio y restauración. Para revertir,
   detener las nuevas instancias y restaurar la aplicación y configuración
   conocidas; revisar previamente los datos y bloqueos con una copia de respaldo.

El controlador MongoDB reintenta una confirmación incierta, pero si se pierde el
resultado definitivamente el cliente debe consultar el estado antes de repetir:
no hay idempotencia HTTP general. Al inicializar un evento, una confirmación
incierta conserva el evento para revisión en vez de borrarlo automáticamente.
No se ha realizado ninguna migración ni validado esta configuración con Docker
en el equipo donde se implementó el cambio.
