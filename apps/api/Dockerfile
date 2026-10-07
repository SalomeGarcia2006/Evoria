FROM node:24.21.0-alpine3.24 AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

FROM dependencies AS builder

COPY . .

RUN npm run build --workspace=@evoria/api -- --incremental false

FROM node:24.21.0-alpine3.24 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist

USER node

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
