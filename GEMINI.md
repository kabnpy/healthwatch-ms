# AGENT CONSTITUTION & ARCHITECTURAL INVARIANTS

> **MISSION:** Maintain and extend the HealthWatch MS insurance workspace with high code quality, strict financial precision, and zero-drift architecture.
> **SOURCE OF TRUTH:** [docs/](docs/) | **ROADMAP & STATUS:** [docs/04_development_roadmap.md](docs/04_development_roadmap.md)

---

## 1. Architectural Constraints

### Backend (FastAPI + SQLModel)
- **Routers:** All endpoints must live in `backend/app/api/routes/` and be aggregated in `backend/app/api/main.py`. Never place route handlers directly in `main.py`.
- **Schemas:** Use Pydantic v2 models for all request and response payloads.
- **Models:** Use SQLModel for database models in `backend/app/models.py`.
- **Business Logic:** Encapsulate domain calculations, rating, and state machines in `backend/app/services/` or `crud/`, never directly in endpoints.
- **Dependencies:** Inject database sessions via `SessionDep` (`FastAPI.Depends`).
- **Timestamps:** Enforce timezone-aware UTC timestamps across all models and queries.

### Domain Invariants & Terminology
- **Agency Identity:** HealthWatch MS is an **insurance agency** (representing carriers and serving client policyholders). Staff are **agents** or **account managers**. Use clear, professional agency terminology across documentation, code comments, and UI copy.
- **Tone & Typography:** Strictly **zero emoji** across all documentation, UI components, notifications, and code comments. Maintain a direct, professional, operationally grounded tone.
- **Policy Identity & Transactional Snapshots:** `Policy` is strictly a durable contract container identity. A `RiskNote` is a transaction overview document generated specifically for product lines that require carrier cover slips (such as Motor or Domestic); policies like **Medical never use a Risk Note**. When generated, a `RiskNote.cover_snapshot` captures an immutable overview of agreed terms and calculations for that specific event, but is not the universal single source of truth across all products. The calculation authority remains the versioned `PremiumCalculation`.
- **Payment Ledger & Spreadsheet Reconciliation:**
  - HealthWatch MS does not implement a full general ledger, automated bank feeds, or payment-gateway integrations. Account reconciliation is historically maintained by agency finance via comprehensive spreadsheets.
  - The system provides a clean, bounded financial ledger to feed these spreadsheets:
    - `PaymentRecord`: Represents cleared funds deposited in the agency's bank account or paybill.
    - `PaymentAllocation`: Records application of cleared funds against an invoice under lock ($\sum \text{allocations} \le \text{payment}$).
    - `Document (proof_of_payment)`: Client-submitted payment evidence (e.g., M-Pesa screenshot, bank slip); does not modify invoice balances.
    - `Document (insurer_receipt)`: Carrier-issued confirmation of remittance; unlocks commission eligibility and confirms policy active status.
- **Financial Precision:** Always use Python `Decimal` with fixed-point arithmetic for premiums, taxes, and levies. Never use floats.

### Frontend (React 19 + TanStack)
- **Routing:** TanStack Router in `frontend/src/routes/`.
- **State & Data Fetching:** TanStack Query v5 hooks in `frontend/src/hooks/`.
- **API Client:** Use generated `@hey-api` client services with `@hey-api/client-axios`. Always unwrap `.data` at the hook boundary before returning to UI components.

### Git & Commit Hygiene Invariants
- **Atomic Commits:** Make clean, atomic commits upon completing each logical task, feature step, or phase. Never leave multi-phase uncommitted file drifts across conversations.
- **Conventional Commits:** All commit messages must strictly comply with the Conventional Commits specification: `<type>(<scope>): <imperative subject>` (e.g., `feat(renewals): implement transition state machine`, `fix(rating): correct minimum premium calculation`). Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `style`.
- **Zero Checkpoint Spam:** Never create commits for task checklist increments (e.g., `conductor(plan): Mark task as complete`). Keep planning artifacts uncommitted until a meaningful feature milestone is reached.
- **Secret & Environment Protection:** Real environment files (`.env`, `frontend/.env`, `*.local`) are **never tracked in Git**. Maintain only sanitized `.env.example` templates.
- **Format Before Commit:** Always run backend formatting (`uv run ruff check --fix` and `uv run ruff format`) and frontend linting (`bun run lint`) before committing.
- **Branch Discipline:** Name branches descriptively according to their intent (`feat/<name>`, `fix/<name>`, `chore/<name>`). When completing work, squash-merge feature branches into `main` to preserve a clean, linear history. Reference [docs/06_git_hygiene.md](docs/06_git_hygiene.md).
- **AGY Sandbox Permissions:** In the Antigravity sandbox, `.git` is mounted read-only by default. When running commands that modify `.git` (such as `git add`, `git commit`, `git checkout`, `git branch`), always run with `BypassSandbox: true`.

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
- **Git & Pre-Commit:**
  - Validate hooks across all files: `backend/.venv/bin/prek run -a`
  - Reinstall shims: `backend/.venv/bin/prek install -t pre-commit -t commit-msg`
  - Note: All `.git` mutating operations (`git add`, `git commit`, `git checkout`, `git branch`) require `BypassSandbox: true`.

---

## 3. Workflows & Skills

- **Complex Features & Refactors:** Use the `/conductor` skill ([.agents/skills/conductor/SKILL.md](.agents/skills/conductor/SKILL.md)) for TDD red-green cycles and quality gates.
- **Database Schema Changes:** Use the `/db-migration` skill ([.agents/skills/db-migration/SKILL.md](.agents/skills/db-migration/SKILL.md)) for safe Alembic migrations and rollback testing.
- **Reviews & Audits:** Delegate independent checks or security audits to subagents via `invoke_subagent`.
