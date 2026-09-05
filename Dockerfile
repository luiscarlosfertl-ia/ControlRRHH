# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend/ frontend/
RUN npm run build -w frontend

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace=backend --include-workspace-root=false && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/luiscarlosfertl-ia/ControlRRHH"
LABEL org.opencontainers.image.title="ControlRRHH app"
LABEL org.opencontainers.image.description="Aplicación de control horario; no incluye datos ni secretos"
ENV NODE_ENV=production HTTP_HOST=0.0.0.0 PORT=3100
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY backend/package.json backend/package.json
COPY backend/src/ backend/src/
COPY --from=build /app/frontend/dist frontend/dist/
USER node
EXPOSE 3100 3444
CMD ["node", "backend/src/server.js"]
