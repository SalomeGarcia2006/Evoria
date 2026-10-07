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
