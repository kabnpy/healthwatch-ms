---
name: db-migration
description: >-
  Safe database schema migration and validation runbook using Alembic and SQLModel.
  Use when adding or modifying backend models, altering columns, creating new tables,
  or running database schema revisions.
---

# Database Migration Runbook (SQLModel & Alembic)

Guidelines for safely updating the PostgreSQL database schema in `healthwatch-ms`.

---

## 1. Migration Protocol

### Step 1: Update SQLModel Models
1. Modify or define models in `backend/app/models.py`.
2. Ensure:
   - All timestamps use timezone-aware UTC (`get_datetime_utc()`).
   - Financial amounts use `Decimal` with fixed precision.
   - Foreign keys and indexes are explicitly declared.

### Step 2: Generate Migration
Run Alembic autogenerate inside the backend environment:
```bash
cd backend
uv run alembic revision --autogenerate -m "describe_changes"
```

### Step 3: Inspect Generated Script
1. Review the generated file in `backend/app/alembic/versions/`.
2. Autogenerate misses subtle details:
   - Check enum creation / deletion.
   - Verify server defaults for non-nullable columns.
   - Verify foreign key constraints and `ondelete` actions.

### Step 4: Test Apply and Downgrade
```bash
# Upgrade to head
uv run alembic upgrade head

# Downgrade 1 revision to test rollback
uv run alembic downgrade -1

# Re-upgrade to head
uv run alembic upgrade head
```

### Step 5: Verify Application Boot & Prestart
Test that `tests_pre_start.py` and mock seeding complete cleanly:
```bash
uv run python app/tests_pre_start.py
```

---

## 2. Invariant Guidelines
- **Development Toggle:** `AUTO_CREATE_TABLES=true` allows running without applying migrations in transient testing, but all production and CI schema changes must use Alembic revisions.
- **Data Migrations:** If existing columns are split or transformed (e.g. normalizing JSON into relational tables), write explicit data migration logic in the migration's `upgrade()` function before dropping legacy columns.
