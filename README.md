# Evoria

Evoria es una plataforma web para planificar y gestionar eventos. Este
repositorio reúne el frontend, la API y los contratos compartidos en un único
monorepo.

> Estado: en desarrollo. La base técnica, la conexión con MongoDB y el modelo
> inicial de roles y usuarios ya están disponibles.

## Comenzando

Estas instrucciones permiten ejecutar una copia local de Evoria para desarrollo
y pruebas.

### Requisitos

- [Git](https://git-scm.com/)
- [Docker Engine](https://docs.docker.com/engine/install/) con el complemento
  Docker Compose
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

El archivo `.env.example` contiene las variables requeridas para MongoDB:

```env
MONGO_ROOT_USERNAME=
MONGO_ROOT_PASSWORD=
MONGO_DATABASE=
```

Nunca se debe subir el archivo `.env` con credenciales reales al repositorio.

MongoDB crea el usuario administrador en la base interna `admin`. Por ello, una
herramienta gráfica como MongoDB Compass debe conectarse con una URI de esta
forma:

```text
mongodb://<MONGO_ROOT_USERNAME>:<MONGO_ROOT_PASSWORD>@localhost:27017/<MONGO_DATABASE>?authSource=admin
```

`authSource=admin` indica dónde MongoDB valida el usuario; los datos de Evoria
se guardan en la base definida por `MONGO_DATABASE`.

### Datos iniciales

Con MongoDB iniciado, crea los roles iniciales con:

```bash
npm run seed
```

El proceso es idempotente: se puede ejecutar varias veces sin duplicar los
roles `Administrador`, `Coordinador`, `Empleado` y `Proveedor`.

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
