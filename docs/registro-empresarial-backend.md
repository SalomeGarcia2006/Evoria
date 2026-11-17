# Registro de usuarios por empresa

El desarrollador sigue creando la empresa y su administrador. El administrador configura `emailDomain` en `PATCH /api/tenants/context`, por ejemplo `empresa.com`, sin incluir `@`. Cada dominio solo puede pertenecer a una empresa. Las empresas existentes pueden conservar el campo vacío hasta configurarlo. Cambiarlo no modifica los correos de las cuentas existentes; esas cuentas pueden seguir iniciando sesión.

Los endpoints requieren una sesión de empresa y el permiso `empresa_contexto.editar`:

- `GET /api/tenants/registration-link`: obtiene `{ token, url, emailDomain }`. La URL apunta a `/registro` en `WEB_ORIGIN` y está destinada a la futura vista del frontend.
- `POST /api/tenants/registration-link/rotate`: genera otra clave. La anterior deja de funcionar, incluso para verificaciones pendientes. El enlace es sensible y debe compartirse solo con quien se desee invitar.

## Registro público

1. `GET /api/auth/registration/:token` valida el enlace y devuelve `companyName` y `emailDomain`. La vista puede mostrar el dominio fijo y construir el correo completo.
2. `POST /api/auth/registration/request` recibe `{ token, name, lastName, email, password }`. El backend valida el dominio y la contraseña y envía un código de seis caracteres al correo. El código caduca en diez minutos.
3. `POST /api/auth/registration/confirm` recibe `{ token, email, code }`. Verifica el código y crea el usuario y su membresía en una transacción. Hay un máximo de cinco intentos por código. Para pedir otro, se repite el paso 2.

La API requiere MongoDB configurado como réplica para las transacciones. El usuario confirmado puede iniciar sesión: `pendingProfile` será `true`, el perfil tendrá el identificador vacío y la lista de permisos estará vacía. Hasta la asignación del perfil solo puede consultar `GET /api/auth/me` y usar los endpoints públicos de sesión; los módulos protegidos responden 403. Cuando un administrador asigna un perfil válido de la empresa mediante `PATCH /api/users/:id`, las siguientes solicitudes usan los permisos de ese perfil. La lista de usuarios devuelve `profile: null` para los pendientes. `GET /api/users/profiles` requiere `usuarios.editar`.

La creación directa mediante `POST /api/users` fue retirada. El frontend existente debe adaptarse al nuevo flujo antes de ofrecerlo a usuarios; este cambio no incluye esa vista.

Ejecuta `npm run migrate` desde la raíz tras actualizar para crear los índices únicos del dominio y de los registros pendientes, además del índice de caducidad y desactivar el permiso obsoleto `usuarios.crear`. Se necesitan las variables SMTP ya existentes y MongoDB en ejecución. No hace falta modificar los correos de los usuarios existentes ni ejecutar el seed por este cambio.
