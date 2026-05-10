<img width="1893" height="732" alt="Titulo" src="https://github.com/user-attachments/assets/48ab6a63-9e58-4ffb-973f-a38eee4ef13b" />

# Geckard Kanban

Tablero de trabajo colaborativo estilo **Kanban + Scrumban** 🚀  
Pensado para equipos que quieren organizar tareas, planificar sprints y tener visibilidad clara del flujo de trabajo.

## ✨ Qué incluye

- 🧩 Tableros con columnas y tarjetas
- 👥 Colaboración entre miembros con roles
- 📌 Etiquetas, prioridades, checklist y enlaces por tarea
- 🏃 Gestión de sprint activo e historial
- 🔔 Notificaciones en tiempo real
- 📊 Filtros y orden para priorizar trabajo

## 🛠️ Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** NestJS + MongoDB
- **Realtime:** Socket.IO
- **Entorno local:** Docker Compose

## 📁 Estructura

- `frontend/` → cliente web
- `backend/` → API y lógica de negocio
- `.github/workflows/` → CI/CD (lint + deploy)

## ⚡ Inicio rápido

1. Clona el repositorio  
2. Crea `.env` en la raíz a partir de `.env.example`  
3. Levanta el entorno:

```bash
docker compose -f docker-compose.dev.yml up --build
```
