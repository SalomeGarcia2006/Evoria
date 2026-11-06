# MongoDB para Alertas: arranque, respaldo y reversión

`compose.yaml` inicia una réplica de desarrollo de un nodo con autenticación.
El chequeo de salud crea `evoria-rs` solo cuando el nodo no está inicializado y
espera al primario antes de arrancar la API. La réplica anuncia `mongo:27017`
para los contenedores; la API en el anfitrión utiliza `localhost:27017` con
`directConnection=true`. [MongoDB documenta esta opción para desarrollo con un
único extremo Docker](https://www.mongodb.com/docs/manual/reference/connection-string-options/).

Los nuevos volúmenes son `mongo_replica_data` y `mongo_replica_key`; el volumen
anterior `mongo_data` **no se convierte ni se borra** y los datos no se copian
automáticamente. La clave se genera una sola vez y se conserva separada de los
datos. Si falta la clave y existen datos, el arranque se detiene. No elimine
volúmenes ni use `docker compose down -v`. Una réplica de un nodo no proporciona
alta disponibilidad. La configuración es para desarrollo, no producción.

```sh
docker compose up --build
docker compose ps
```

Espere a que MongoDB, API y web estén saludables. Para la API en el anfitrión,
el `.env` usa las credenciales de desarrollo y la conexión directa por defecto.
`MONGODB_URI`, si está definida, tiene prioridad y debe apuntar explícitamente a
una réplica válida; no cambie la URI de una base compartida para probar. Para
la suite de prueba separada, consulte [prueba-replica-aislada.md](prueba-replica-aislada.md).

## Respaldo y migración planificada

No se ha realizado ningún respaldo o migración sobre la base del equipo. El
procedimiento debe ensayarse primero con una copia y un servidor aislado:

1. Identifique la instancia y la base de origen, su versión, usuarios y roles.
   Detenga todas las escrituras de las APIs y de los procesos que usan la base.
   Prepare un destino de respaldo privado, con nombre nuevo y espacio suficiente.
2. Con MongoDB Database Tools compatible y la instancia anterior en ejecución,
   cree un archivo de respaldo. Sustituya los marcadores por valores verificados;
   al omitir `--password`, la herramienta solicita la contraseña interactivamente:

   ```sh
   mongodump --host localhost --port 27017 --authenticationDatabase admin --username USUARIO_ADMIN --db evoria --archive=evoria-respaldo-unico.archive.gz --gzip
   ```

3. Guarde el archivo y su suma de verificación en un lugar seguro. Restaure una
   copia en una **instancia aislada**, en una base vacía con otro nombre; el
   siguiente ejemplo supone que dicha instancia escucha en el puerto 27129 y
   tiene su propio usuario administrativo:

   ```sh
   mongorestore --host localhost --port 27129 --authenticationDatabase admin --username USUARIO_PRUEBA --archive=evoria-respaldo-unico.archive.gz --gzip --nsInclude='evoria.*' --nsFrom='evoria.*' --nsTo='evoria_verificacion.*'
   ```

4. Compruebe que la restauración no tuvo errores y compare colecciones,
   cantidades de documentos, índices y datos críticos con el origen. Verifique
   también cuentas y roles administrativos: un volcado de `evoria` no incluye
   necesariamente los usuarios del almacén `admin`. No considere válido el
   respaldo sin ensayar su restauración.
5. Cree la nueva réplica con volúmenes independientes y credenciales propias;
   restaure el archivo en una base de destino vacía usando `mongorestore` con
   `--nsInclude='evoria.*'`, sin `--nsFrom` ni `--nsTo`. Verifique que conexión,
   permisos, datos e índices sean correctos antes de permitir escrituras.
   Conserve el volumen de claves de la réplica mediante un respaldo protegido.
   No copie contraseñas o claves al repositorio.

## Bloqueos heredados

La versión nueva no crea `budgetDecisionLock`, pero respeta los existentes. Un
token puede pertenecer a una instancia antigua aún activa: **no se debe
liberar por edad o vencimiento**. Detenga y confirme la terminación de todas
las instancias anteriores de la API antes de cualquier recuperación. Compilar y
consultar los bloqueos de una empresa en la instancia identificada:

```sh
npm run build --workspace=@evoria/api
npm run list:budget-locks --workspace=@evoria/api -- EMPRESA_ID
```

Revise el evento y la solicitud antes de actuar. Para liberar uno, use su token
exacto y la confirmación expresa; si cambió el token o la empresa no coincide, el
comando no modifica el evento:

```sh
npm run recover:budget-lock --workspace=@evoria/api -- EMPRESA_ID EVENTO_ID TOKEN_ACTUAL --confirm-all-api-instances-stopped
```

Estos comandos de mantenimiento no inician la conciliación de alertas. El
indicador es una declaración del operador, no detecta procesos remotos por sí
solo. Para inspeccionar la base anterior independiente, establezca explícitamente
su `MONGODB_URI` y use las credenciales correctas. Nunca ejecute recuperación
contra datos compartidos sin el procedimiento aprobado del equipo.

## Reversión

Detenga los escritores de la versión nueva, respalde y verifique el estado de
la réplica nueva y sus claves. Para volver al despliegue anterior, restaure su
configuración y apúntela al volumen anterior preservado o a una restauración
verificada. **El volumen anterior no contiene las escrituras posteriores a la
migración**: planifique su traslado o la posible pérdida antes de volver a él.
No borre ninguno de los volúmenes durante la reversión.
