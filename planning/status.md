# Project Status (Session End: 2026-02-20)

## Finished (Key Milestones)
- **Database & Model Reconciliation**: Synchronized the database schema with the backend models. Updated Alembic migration `c5c580ca4b1f` to correctly implement `RiskNote.cover_snapshot` as the source of truth for risk details, replacing the redundant `Policy.risk_details` approach.
- **Service Layer Hardening**: Refactored `PolicyService` to improve temporal precision in endorsements and optimized the `RatingService` by consolidating tier sorting logic.
- **Wizard Data Flow Alignment**: Enhanced the frontend `NewPolicyWizard` to calculate dynamic coverage periods based on selected duration, eliminating hardcoded 1-year assumptions.
- **Financial Hardening & Rating Engine**: Standardized `sum_insured` as the single authoritative source for insured values across the stack. Refactored `RatingService` to use a singular semantic input and implemented `ManualRatingStrategy` for non-motor products.
- **Prestart Service Stabilization**: The `prestart` service now successfully completes database migrations and mock data seeding.
- **Upstream Sync Phase 1 (Backend Core & Python 3.14)**: Successfully upgraded backend to Python 3.14.8, synchronized dependencies to upstream FastAPI template (FastAPI 0.143+, SQLModel 0.0.48+, Pydantic 2.14+, Alembic 1.20+), migrated password hashing from `passlib` to `pwdlib[argon2,bcrypt]`, enforced UTC-aware timestamps across models and soft-deletes, squashed all 31 legacy Alembic migrations into a single clean baseline (`19bab995ff26_initial_schema.py`), and added an `AUTO_CREATE_TABLES` development toggle.
- **Upstream Sync Phase 2 (Frontend Modernization & OpenAPI Client)**:
  - Upgraded frontend dependencies to match upstream: React 19.3.1, `@tanstack/react-query` 5.104.4, `@tanstack/react-router` 1.170.45, Vite 8.3.4, TypeScript 6.0.3, and Biome 2.5.15.
  - Regenerated API client using `@hey-api/openapi-ts` 0.97.3 with the modern `@hey-api/client-axios` 0.9.1 plugin.
  - Preserved `@tanstack/react-table` at 8.21.3 to protect all 12 custom insurance table column components against TanStack Table v9 breaking changes.
  - Refactored all 4 domain hooks (`useInsurance.ts`, `useCatalog.ts`, `useFinancials.ts`, `useDocuments.ts`), `useAuth.ts`, `queryClient.ts`, and direct service callers to use structured options (`path`, `query`, `body`) and unwrap `.data`.
  - Verified with 0 TypeScript compiler errors (`bun x tsc -p tsconfig.build.json`) and successful Vite production bundle (`bun run build`).
- **Upstream Sync Phase 3 (Docker Compose Modernization)**:
  - Transitioned from legacy `docker-compose*.yml` to standard Docker Compose v2 specification: `compose.yml` (base), `compose.override.yml` (local dev), and `compose.deploy.yml` (production).
  - Modernized proxy to Traefik v3.3, utilizing native entrypoint HTTP-to-HTTPS redirection (`entrypoint.to=https`) and clean Let's Encrypt TLS challenge configs in `compose.deploy.yml`.
  - Upgraded local dev email testing service from obsolete `mailcatcher` to `mailpit` (`axllent/mailpit`).
  - Removed deprecated `docker-compose.traefik.yml` and updated staging/production deployment workflows.
- **Upstream Sync Phases 4 & 5 (Root Workspaces, Scripts, & CI/CD Modernization)**:
  - Modernized shell automation scripts (`scripts/build.sh`, `scripts/build-push.sh`, `scripts/deploy.sh`, `scripts/test-local.sh`) to use Docker Compose v2 commands and file flags.
  - Aligned all GitHub Actions workflows (`test-backend.yml`, `playwright.yml`, `pre-commit.yml`, `generate-client.yml`) with Python 3.14, Node LTS, and `setup-uv` v0.9.26.
  - Updated Dependabot configuration (`.github/dependabot.yml`) to maintain `@hey-api/openapi-ts` alongside standard dependencies.

## Ongoing
- **Upstream Template Synchronization Completed**: All 5 phases are completed and committed on `chore/upstream-sync`.

## Next Steps
1. **Audit Traceability**: Finalize the `change_log` implementation for endorsements to ensure full traceability of risk detail modifications.
2. **Automated Testing**: Expand the backend test suite to cover the new pro-rata endorsement calculations and rating tier logic.
3. **Merge Preparation**: Review git log and open PR / merge `chore/upstream-sync` into `main`.

## Architectural Decisions
- **Docker Compose v2 File Structure**: Standardized on `compose.yml`, `compose.override.yml`, and `compose.deploy.yml` matching upstream template. Local execution defaults seamlessly to `compose.yml` + `compose.override.yml`, while deployments use `-f compose.yml -f compose.deploy.yml`.
- **Mailpit over Mailcatcher**: Replaced abandoned `mailcatcher` with modern `axllent/mailpit` for high performance, zero Ruby vulnerability overhead, and built-in web UI and API.
- **TanStack Table Pinning (v8.21.3)**: Maintained `@tanstack/react-table` at v8.21.3 instead of upstream's v9.2.4. TanStack Table v9 introduces breaking API redesigns (multi-type argument `ColumnDef<TData, ...>`, `useTable` changes) that would break 12 custom insurance tables; v8 builds cleanly under React 19 and Vite 8.
- **Hook-Boundary Data Unwrapping**: Because modern `@hey-api/client-axios` returns raw `AxiosResponse<T>`, all custom domain hooks unwrap `.data` directly at the hook boundary, preserving existing component consumption signatures without touching dozens of downstream components.
- **Squashed Alembic Baseline Migration**: Because the project is pre-production with no historical data, all 31 incremental migrations were consolidated into a single clean initial schema (`19bab995ff26_initial_schema.py`).
- **Flexible Schema Initialization (`AUTO_CREATE_TABLES`)**: Supported in `prestart.sh`, `.env`, and `Settings`: when set to `true`, tables can be created directly from SQLModel metadata without applying Alembic migrations. When `false` (default), Alembic migrations execute as usual.
- **Password Hashing via `pwdlib`**: Replaced deprecated `passlib` with `pwdlib[argon2,bcrypt]` for Python 3.14+ compatibility while ensuring bcrypt hash verification remains completely functional.
- **Strict Timezone-Aware UTC Datetimes**: Standardized on timezone-aware UTC timestamps via `get_datetime_utc()` to comply with SQLModel 0.0.48+ and Pydantic 2.14+ requirements.
- **Atomic Snapshot Strategy**: We store the full state of the risk (the "Snapshot") on the `RiskNote` issued for each transaction. This ensures that every document (Risk Note, Invoice) refers to the authoritative state of the cover at the exact moment of issuance.
- **Policy as the Contract Container**: The `Policy` model remains the long-lived container for the contract, but coverage-specific data (dates, values) is derived from its related `RiskNotes`.
- **Pro-rata Endorsements**: Premium adjustments for mid-term modifications are calculated pro-rata based on the remaining coverage period relative to the original term.
