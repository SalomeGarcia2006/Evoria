# EVORIA monorepo

Monorepo con npm workspaces, Turborepo, Next.js y NestJS.

## Requisitos

- Node.js 22.18 o superior
- npm 11

## Inicio rápido

```bash
npm install
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api
- Healthcheck: http://localhost:3001/api/health

La aplicación web consulta el healthcheck de la API al cargar. La URL se puede cambiar en `apps/web/.env.local` a partir de `.env.example`.

## Docker

Con Docker instalado, levanta la aplicación completa —MongoDB, API y web— con:

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/health
- MongoDB: `mongodb://localhost:27017`

Los datos se conservan en el volumen `mongo_data`. Para detener los servicios usa `docker compose down`; añade `-v` solo si también quieres eliminar los datos locales de MongoDB.

> Las credenciales de MongoDB se crean únicamente al inicializar un volumen vacío. Si cambias `MONGO_ROOT_USERNAME` o `MONGO_ROOT_PASSWORD`, reinicializa el entorno con `docker compose down -v` antes de volver a ejecutar Compose. Esto elimina los datos locales de MongoDB.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run format:check
```

## Estructura

```text
apps/web        # Frontend Next.js
apps/api        # Backend NestJS
packages/contracts # Tipos compartidos entre las aplicaciones
```

## Documentación

- [Arquitectura y modelo de datos](docs/arquitectura-y-modelo-datos.md)
