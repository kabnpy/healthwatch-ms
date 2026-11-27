# HealthWatch MS - Backend

FastAPI + SQLModel (SQLAlchemy 2 + Pydantic v2) backend targeting Python 3.14 and PostgreSQL 17.

For local startup, backing services, and workspace commands (`bun run dev`, `bun run test:backend`, `bun run migrate`, `bun run seed`), see [`../development.md`](../development.md).

## Environment Setup

Dependencies are managed with [uv](https://docs.astral.sh/uv/):

```bash
cd backend
uv sync
```

Point your editor's Python interpreter to `backend/.venv/bin/python`.

## Code Structure

- `app/models.py`: SQLModel database tables and Pydantic v2 schemas.
- `app/api/routes/`: FastAPI route handlers (registered in `app/api/main.py`).
- `app/services/` and `app/crud/`: Domain calculations, state transitions, and persistence logic.
- `app/seeds/`: Idempotent reference catalog and acceptance dataset seeders.
- `app/templates/documents/`: Printable A4 HTML/PDF document templates.
- `tests/`: Pytest suite.

See [`../CODING_STANDARDS.md`](../CODING_STANDARDS.md) for financial precision (`Decimal`), UTC timestamp, and layering invariants.

## Database Migrations (Alembic)

Alembic imports SQLModel metadata from `app/models.py`. After modifying models:

```bash
# Generate a new migration
cd backend && uv run alembic revision --autogenerate -m "describe change"

# Apply migrations (from repo root)
bun run migrate
```

Commit the generated revision file under `backend/app/alembic/versions/`.

## Email Templates

Email templates live in `app/email-templates/` (`src/` for `.mjml` sources, `build/` for compiled `.html` output). After editing a `.mjml` file, export it to `build/` using the VS Code MJML extension or `mjml` CLI.
