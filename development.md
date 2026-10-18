# HealthWatch MS - Development Guide

## Container Workflow (Docker / Podman)

Start the local stack with Docker Compose or Podman Compose:

```bash
# Docker Compose
docker compose watch
# Or background
docker compose up -d

# Podman Compose
podman compose up -d db adminer mailpit backend frontend
```

> **Podman Notes:**
> - Ensure your images and database host connect properly: the compose files automatically configure `POSTGRES_SERVER=db` for container services.
> - The rootless Podman user socket can be activated with `systemctl --user enable --now podman.socket`.
> - If you want to use the optional Traefik `proxy` container on port 80 with rootless Podman, permit unprivileged binding via `sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80` or customize `PROXY_HTTP_PORT` in your environment.

### Service URLs (Local Development)

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend** | <http://localhost:5173> | Vite Hot-Module-Replacement |
| **Backend API** | <http://localhost:8000> | FastAPI with auto-reload |
| **Swagger UI** | <http://localhost:8000/docs> | Interactive API documentation |
| **ReDoc** | <http://localhost:8000/redoc> | Alternative API documentation |
| **Adminer** | <http://localhost:8080> | Database web administration |
| **Traefik UI** | <http://localhost:8090> | Reverse proxy routing & metrics |
| **Mailpit** | <http://localhost:1080> | Local email inspection (SMTP on port 1025) |

To monitor logs:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

---

## Local Native Development

You can stop specific Docker Compose services and run them natively on your host.

### 1. Stopping Containerized Services
```bash
docker compose stop frontend
docker compose stop backend
```

### 2. Frontend (React 19 + Vite 8 + Bun)
```bash
cd frontend
bun install
bun run generate-client  # Sync OpenAPI Axios client with backend
bun run dev              # Starts dev server on http://localhost:5173
```

### 3. Backend (FastAPI + SQLModel + uv)
```bash
cd backend
uv sync
uv run alembic upgrade head
uv run python app/initial_data.py
uv run fastapi dev app/main.py   # Starts dev server on http://localhost:8000
```

---

## Docker Compose Files Specification

We use the modern Docker Compose v2 file layout:
- `compose.yml`: Base service definitions (Traefik, DB, Backend, Frontend, Mailpit).
- `compose.override.yml`: Local development overrides (ports exposed on localhost, volume mounts, `develop.watch` sync). Automatically loaded alongside `compose.yml` during `docker compose up`.
- `compose.deploy.yml`: Production & staging configurations (Let's Encrypt TLS certificates, domain labels, production entrypoints).

---

## Pre-commit & Code Quality (`prek`)

We use [`prek`](https://prek.j178.dev/) (a fast Rust-based runner compatible with pre-commit) for automated linting and formatting.

### Install Git Hook
```bash
cd backend
uv run prek install -f
```

### Run Checks Across All Files
```bash
cd backend
uv run prek run --all-files
```

Checks executed by prek:
- **Python:** `ruff check --fix` and `ruff format`
- **Frontend:** `biome check` (Biome handles linting and formatting for TypeScript/React)
- **Formatting:** File end newline, trailing whitespace, TOML, and YAML validation.
