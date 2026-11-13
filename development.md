# HealthWatch MS - Development Guide

## Local Development Workflow (Podman & Docker)

All workspace commands live in root [package.json](package.json) and auto-detect **Podman** (`podman compose` / `podman-compose`) or **Docker** (`docker compose`).

```bash
# Start PostgreSQL + Mailpit in Podman/Docker, apply migrations, seed initial data,
# and run FastAPI + Vite natively with hot-reload:
bun run dev

# Check container runtime, DB, API, and frontend status:
bun run status

# Manage background backing services (PostgreSQL + Mailpit):
bun run up
bun run down
bun run logs
```

### Service URLs (Local Development)

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend** | <http://localhost:5173> | Vite Hot-Module-Replacement |
| **Backend API** | <http://localhost:8000> | FastAPI with auto-reload |
| **Swagger UI** | <http://localhost:8000/docs> | Interactive API documentation |
| **ReDoc** | <http://localhost:8000/redoc> | Alternative API documentation |
| **Mailpit** | <http://localhost:1080> | Local email inspection (SMTP on port 1025) |
| **Adminer** | <http://localhost:8080> | Optional DB UI (`bun run up adminer`) |

---

## Testing, Typechecking & Client Generation

```bash
bun run test          # Run backend pytest + frontend vitest suites (auto-starts DB if stopped)
bun run test:backend  # Run backend pytest suite
bun run test:frontend # Run frontend vitest suite
bun run test:e2e      # Run Playwright E2E suite
bun run typecheck     # Run TypeScript compiler check
bun run lint          # Run Ruff and Biome linters
bun run format        # Auto-format backend and frontend
bun run client        # Export OpenAPI schema and regenerate TypeScript client
bun run migrate       # Apply Alembic database migrations
bun run seed          # Seed realistic underwriting and client portfolio
```

---

## Container Files

- `Dockerfile`: Unified production build (Stage 1 builds the React SPA with Bun; Stage 2 runs FastAPI on Python 3.14 and serves the embedded SPA).
- `compose.yml` + `compose.override.yml`: Backing services (`db` PostgreSQL 17, `mailpit`, `adminer`) and CI container targets (`backend`, `frontend`, `playwright`), compatible with both rootless Podman and Docker Compose.

---

## Pre-Commit & Code Quality (`prek`)

```bash
cd backend
uv run prek install -t pre-commit -t commit-msg
uv run prek run --all-files
```
