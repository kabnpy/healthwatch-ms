# AGENT CONSTITUTION & ARCHITECTURAL INVARIANTS

> **MISSION:** Maintain and extend the HealthWatch MS insurance workspace with high code quality, strict financial precision, and zero-drift architecture.
> **SOURCE OF TRUTH:** [docs/](docs/) | **ROADMAP & STATUS:** [docs/04_development_roadmap.md](docs/04_development_roadmap.md)

---

## 1. Architectural Constraints

### Backend (FastAPI + SQLModel)
- **Routers:** All endpoints must live in `backend/app/api/v1/endpoints/`. Never place route handlers in `main.py`.
- **Schemas:** Use Pydantic v2 models for all request and response payloads.
- **Models:** Use SQLModel for database models in `backend/app/models.py`.
- **Business Logic:** Encapsulate domain calculations, rating, and state machines in `backend/app/services/` or `crud/`, never directly in endpoints.
- **Dependencies:** Inject database sessions via `SessionDep` (`FastAPI.Depends`).
- **Timestamps:** Enforce timezone-aware UTC timestamps across all models and queries.

### Domain Invariants
- **Atomic Snapshot Pattern:** `RiskNote.cover_snapshot` is the single source of truth for coverage details, asset terms, and premium breakdowns at transaction time. `Policy` is the durable container identity.
- **Financial Precision:** Always use Python `Decimal` with fixed-point arithmetic for premiums, taxes, and levies. Never use floats.

### Frontend (React 19 + TanStack)
- **Routing:** TanStack Router in `frontend/src/routes/`.
- **State & Data Fetching:** TanStack Query v5 hooks in `frontend/src/hooks/`.
- **API Client:** Use generated `@hey-api` client services with `@hey-api/client-axios`. Always unwrap `.data` at the hook boundary before returning to UI components.

---

## 2. Tooling & Commands

- **Backend (Python 3.14):** Execute all Python commands with `uv run` inside `backend/`:
  - Run tests: `uv run pytest`
  - Lint & Format: `uv run ruff check --fix` and `uv run ruff format`
  - Migrations: `uv run alembic upgrade head`
- **Frontend (Bun / React 19):** Execute commands with `bun run` inside `frontend/`:
  - Dev server: `bun run dev`
  - Type-check & build: `bun x tsc -p tsconfig.build.json && bun run build`
  - Lint: `bun run lint`
- **Infrastructure:** Docker Compose v2 specification:
  - Local dev: `docker compose up` (merges `compose.yml` + `compose.override.yml`)
  - Staging/Deploy: `docker compose -f compose.yml -f compose.deploy.yml up`

---

## 3. Workflows & Skills

- **Complex Features & Refactors:** Use the `/conductor` skill ([.agents/skills/conductor/SKILL.md](.agents/skills/conductor/SKILL.md)) for TDD red-green cycles and quality gates.
- **Database Schema Changes:** Use the `/db-migration` skill ([.agents/skills/db-migration/SKILL.md](.agents/skills/db-migration/SKILL.md)) for safe Alembic migrations and rollback testing.
- **Reviews & Audits:** Delegate independent checks or security audits to subagents via `invoke_subagent`.
