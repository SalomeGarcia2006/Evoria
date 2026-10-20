# Evoria

Evoria es una plataforma web para planificar y gestionar eventos. Este
repositorio reúne el frontend, la API y los contratos compartidos en un único
monorepo.

> Estado: en desarrollo. La base técnica, la conexión con MongoDB y el modelo
> inicial de perfiles, permisos y usuarios ya están disponibles.

## Comenzando

Estas instrucciones permiten ejecutar una copia local de Evoria para desarrollo
y pruebas.

### Requisitos

- [Git](https://git-scm.com/)
- [Docker Engine](https://docs.docker.com/engine/install/) Versión recomendada Docker versión 29.9.0, con el complemento
  Docker Compose version recomendada Docker Compose version v5.6.0
- Node.js 22.18 o superior y npm 11, solo si se ejecutará la aplicación fuera
  de Docker

### Instalación con Docker

Es la opción recomendada: levanta MongoDB, la API y el frontend sin instalar
dependencias de Node.js en el equipo.

```bash
git clone https://github.com/SalomeGarcia2006/Evoria.git
cd Evoria
cp .env.example .env
npm run docker:dev
```

La primera ejecución descarga las imágenes necesarias y crea los servicios. A
partir de entonces Docker sincroniza los cambios de código automáticamente.

Cuando los servicios estén listos, abre:

- Frontend: <http://localhost:3000>
- API: <http://localhost:3001/api>
- Estado de la API: <http://localhost:3001/api/health>
- MongoDB: `localhost:27017`

Para detener los servicios:

```bash
docker compose down
```

Para una ejecución similar a producción, sin sincronización automática:

```bash
docker compose up --build
```

### Ejecución local sin Docker para la aplicación

MongoDB puede mantenerse en Docker mientras el frontend y la API se ejecutan en
el equipo.

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
docker compose up mongo --detach
npm install
npm run dev
```

### Variables de entorno

El archivo `.env.example` contiene las variables de MongoDB y autenticación:

```env
MONGO_ROOT_USERNAME=
MONGO_ROOT_PASSWORD=
MONGO_DATABASE=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=false
SEED_ADMIN_NAME=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

Nunca se debe subir el archivo `.env` con credenciales reales al repositorio.

`JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` deben ser valores largos, aleatorios
y diferentes entre sí. Puedes generar cada uno localmente con:

```bash
openssl rand -base64 48
```

En desarrollo, `COOKIE_SECURE=false` permite usar HTTP en `localhost`. En
producción debe ser `true` y la aplicación debe servirse mediante HTTPS.

MongoDB crea el usuario administrador en la base interna `admin`. Por ello, una
herramienta gráfica como MongoDB Compass debe conectarse con una URI de esta
forma:

```text
mongodb://<MONGO_ROOT_USERNAME>:<MONGO_ROOT_PASSWORD>@localhost:27017/<MONGO_DATABASE>?authSource=admin
```

`authSource=admin` indica dónde MongoDB valida el usuario; los datos de Evoria
se guardan en la base definida por `MONGO_DATABASE`.

### Datos iniciales

Antes de ejecutar el seed, define en tu archivo `.env` las credenciales del
desarrollador inicial. No uses los valores de otra persona ni subas ese archivo
al repositorio.

```env
SEED_ADMIN_NAME=Nombre del desarrollador
SEED_ADMIN_EMAIL=desarrollador@ejemplo.com
SEED_ADMIN_PASSWORD=una-contraseña-larga-y-unica
```

Con MongoDB iniciado, crea los permisos iniciales, el perfil global
`Desarrollador` y el usuario inicial con:

```bash
npm run seed
```

El proceso es idempotente: se puede ejecutar varias veces sin duplicar los
permisos, el perfil ni el desarrollador. Una vez creada la cuenta,
cambiar estas variables no modifica sus credenciales; esto evita
restablecimientos accidentales.

## Autenticación

La API expone `POST /api/auth/login`. Recibe correo y contraseña, y al
validarlos crea cookies `HttpOnly` para el token de acceso y el token de
renovación. Los tokens no se devuelven en el cuerpo de la respuesta.

```json
{
  "email": "desarrollador@ejemplo.com",
  "password": "una-contraseña-larga-y-unica"
}
```

El inicio de sesión permite hasta cinco intentos fallidos antes de bloquear la
cuenta durante quince minutos. Cuando vence el token de acceso, `POST
/api/auth/refresh` usa la cookie de renovación para reemplazar ambas cookies
sin solicitar nuevamente las credenciales. `POST /api/auth/logout` invalida el
token de renovación almacenado y elimina ambas cookies.

Las rutas de la API requieren una cookie de acceso válida por defecto. Las
rutas públicas se declaran explícitamente con `@Public()`. `GET /api/auth/me`
es una ruta protegida que devuelve el usuario, su perfil y sus permisos actuales.

Los módulos pueden restringir una ruta a permisos concretos con
`@RequirePermissions(...)`. El guard consulta los permisos activos del perfil
en cada petición, por lo que un cambio de perfil se aplica sin que el usuario
vuelva a iniciar sesión.

```ts
@RequirePermissions('usuarios.ver')
@Get()
findAll() {}
```

Cuando una ruta declara más de un permiso, el perfil debe tenerlos todos. El
guard responde con `403 Forbidden` si la sesión es válida pero no cuenta con el
permiso necesario.

### Creación de empresas

El usuario con perfil global `Desarrollador` puede crear una empresa mediante
`POST /api/tenants`. La operación crea también el perfil `Administrador` de esa
empresa, su propietario y la membresía que los vincula. No existe una empresa
interna ficticia de Evoria.

```json
{
  "name": "Eventos Ejemplo",
  "nit": "900123456-7",
  "ownerName": "Nombre del propietario",
  "ownerEmail": "propietario@ejemplo.com",
  "ownerPassword": "una-contraseña-larga-y-unica"
}
```

## Verificaciones de calidad

Todavía no hay pruebas unitarias o de integración. Por ahora, estas
verificaciones comprueban formato, reglas de código, tipos y compilación:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

GitHub Actions ejecuta esas verificaciones y además comprueba que Docker pueda
iniciar la web, la API y MongoDB, incluyendo una operación básica sobre la base
de datos.

### Hooks de Git

`npm install` activa Husky automáticamente. Antes de cada commit, el hook
formatea los archivos preparados y ejecuta ESLint sobre los cambios de la API y
el frontend. Si queda un error sin corregir, el commit se cancela.

## Despliegue

El despliegue en un entorno productivo está por definir. La configuración actual
de Docker está orientada a ejecución local y validación continua.

## Tecnologías

| Tecnología                                            | Uso en el proyecto              | Versión     |
| ----------------------------------------------------- | ------------------------------- | ----------- |
| [Next.js](https://nextjs.org/)                        | Frontend                        | 16.4.0      |
| [NestJS](https://nestjs.com/)                         | API backend                     | 12.1.2      |
| [MongoDB](https://www.mongodb.com/)                   | Base de datos                   | 9.0.2       |
| [Mongoose](https://mongoosejs.com/)                   | Modelado y conexión con MongoDB | 9.11.0      |
| [Tailwind CSS](https://tailwindcss.com/)              | Estilos del frontend            | 4.3.3       |
| [Docker](https://www.docker.com/)                     | Contenedores y ejecución local  | Por definir |
| [GitHub Actions](https://github.com/features/actions) | Integración continua            | Por definir |
| [Turborepo](https://turborepo.com/)                   | Orquestación del monorepo       | Por definir |

## Estructura del repositorio

```text
apps/
├── api/          # API construida con NestJS
└── web/          # Frontend construido con Next.js
packages/
└── contracts/    # Tipos compartidos entre frontend y API
docs/              # Documentación técnica del proyecto
```

## Documentación

- [Arquitectura y modelo de datos](docs/arquitectura-y-modelo-datos.md)

## Contribución

El proceso formal de contribución está por definir. Mientras tanto, cada cambio
debe realizarse en una rama, validarse localmente y proponerse mediante un pull
request hacia `main`.

## Licencia

La licencia del proyecto está por definir.

## Guía rápida para probar el login

Para que el inicio de sesión funcione en un entorno local, cada integrante debe
instalar primero las dependencias del monorepo:

```bash
npm install
```

Después, debe verificar que el archivo `.env` de la raíz contenga las variables
de MongoDB, autenticación y del desarrollador inicial. Si el archivo no existe,
puede crearse a partir de `.env.example`:

```bash
cp .env.example .env
```

La configuración mínima para desarrollo local es:

```env
MONGO_ROOT_USERNAME=evoria
MONGO_ROOT_PASSWORD=evoria_local_password
MONGO_DATABASE=evoria

JWT_ACCESS_SECRET=evoria_access_secret_local_change_me
JWT_REFRESH_SECRET=evoria_refresh_secret_local_change_me
JWT_ACCESS_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=false

SEED_ADMIN_NAME=Desarrollador Evoria
SEED_ADMIN_EMAIL=desarrollador@evoria.com
SEED_ADMIN_PASSWORD=Evoria123*
```

Los secretos y la contraseña son únicamente valores de desarrollo. Cada
integrante puede reemplazarlos por valores propios, pero las variables
`SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` son necesarias
para crear el usuario global inicial. La contraseña debe tener al menos ocho
caracteres.

### Levantar la base de datos y crear el usuario

Con Docker instalado, inicia MongoDB:

```bash
docker compose up mongo --detach
```

Luego ejecuta el seed desde la raíz del repositorio:

```bash
npm run seed
```

Este comando compila la API y crea los permisos, el perfil global
`Desarrollador` y el usuario inicial si no existen. Es idempotente, por lo que
se puede ejecutar nuevamente sin duplicar registros. Modificar las variables
`SEED_*` después de crear los registros no cambia sus datos existentes.

Finalmente, inicia la aplicación:

```bash
npm run dev
```

El formulario de login está disponible en
<http://localhost:3000/login>. Con la configuración anterior, los datos de
prueba son:

```text
Correo: desarrollador@evoria.com
Contraseña: Evoria123*
```

El frontend envía las credenciales a `POST /api/auth/login`. La API guarda el
access token y el refresh token en cookies `HttpOnly`; por eso no se debe
guardar ningún token manualmente en `localStorage`. Las pantallas privadas
consultan `GET /api/auth/me`, renuevan la sesión con `/api/auth/refresh` cuando
es necesario y redirigen a `/login` si no existe una sesión válida.

### Problemas frecuentes al ejecutar el seed

Si aparecen errores como `Cannot find module '@nestjs/jwt'`,
`Cannot find module '@nestjs/throttler'` o `Cannot find module 'cookie-parser'`,
las dependencias aún no están instaladas. Ejecuta:

```bash
npm install
npm run seed
```

Si aparece un mensaje indicando que una variable `SEED_*` es obligatoria,
comprueba `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en el
archivo `.env` de la raíz. Si el seed no puede conectarse a MongoDB, comprueba
el estado del contenedor:

```bash
docker compose ps
```

MongoDB debe aparecer como activo y saludable antes de volver a ejecutar
`npm run seed`.
