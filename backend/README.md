# Backend - TFG Kanban

API REST y WebSocket del proyecto Kanban, implementada con NestJS y MongoDB.

## Requisitos

- Node.js 20 o superior.
- MongoDB accesible desde el backend.
- Variables de entorno configuradas (usa `.env.example` como base).

## Instalación

```bash
npm install
```

## Ejecución

```bash
# Desarrollo con recarga
npm run start:dev

# Arranque normal
npm run start

# Producción (requiere build previo)
npm run build
npm run start:prod
```

## Semilla de datos

```bash
npm run seed
```

## Calidad y pruebas

```bash
# Lint
npm run lint

# Tests unitarios
npm run test

# Tests e2e
npm run test:e2e
```
