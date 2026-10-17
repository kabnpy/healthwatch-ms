# Project Status (Session End: 2026-02-20)

## Finished (Key Milestones)
- **Database & Model Reconciliation**: Synchronized the database schema with the backend models. Updated Alembic migration `c5c580ca4b1f` to correctly implement `RiskNote.cover_snapshot` as the source of truth for risk details, replacing the redundant `Policy.risk_details` approach.
- **Service Layer Hardening**: Refactored `PolicyService` to improve temporal precision in endorsements and optimized the `RatingService` by consolidating tier sorting logic.
- **Wizard Data Flow Alignment**: Enhanced the frontend `NewPolicyWizard` to calculate dynamic coverage periods based on selected duration, eliminating hardcoded 1-year assumptions.
- **Financial Hardening & Rating Engine**: Standardized `sum_insured` as the single authoritative source for insured values across the stack. Refactored `RatingService` to use a singular semantic input and implemented `ManualRatingStrategy` for non-motor products.
- **Prestart Service Stabilization**: The `prestart` service now successfully completes database migrations and mock data seeding.
- **Client Regeneration**: Successfully regenerated the TypeScript client from the backend OpenAPI schema and verified type integrity with `tsc`.

- **Upstream Sync Phase 1 (Backend Core & Python 3.14)**: Successfully upgraded backend to Python 3.14.8, synchronized dependencies to upstream FastAPI template (FastAPI 0.143+, SQLModel 0.0.48+, Pydantic 2.14+, Alembic 1.20+), migrated password hashing from `passlib` to `pwdlib[argon2,bcrypt]`, enforced UTC-aware timestamps across models and soft-deletes, and synchronized Alembic migration `f1e2d3c4b5a6` with `risknote.coverage_start` and `coverage_end`.

## Ongoing
- **Upstream Template Synchronization**: Step-by-step merge of upstream improvements onto `chore/upstream-sync`.
- **Type Integrity & Stabilization**: Resolving persistent TypeScript errors in the auto-generated client and components.

## Next Steps
1. **Upstream Sync Phase 2**: Frontend dependency updates, TanStack Query/Router bumps, TypeScript 6 verification, and Hey-API OpenAPI client regeneration.
2. **Upstream Sync Phase 3**: Container & Compose modernization (standardize on `compose.yml`, remove legacy Traefik/nginx configurations).
3. **Audit Traceability**: Finalize the `change_log` implementation for endorsements to ensure full traceability of risk detail modifications.
4. **Automated Testing**: Expand the backend test suite to cover the new pro-rata endorsement calculations and rating tier logic.

## Architectural Decisions
- **Password Hashing via `pwdlib`**: Replaced deprecated `passlib` with `pwdlib[argon2,bcrypt]` for Python 3.14+ compatibility while ensuring bcrypt hash verification remains completely functional.
- **Strict Timezone-Aware UTC Datetimes**: Standardized on timezone-aware UTC timestamps via `get_datetime_utc()` to comply with SQLModel 0.0.48+ and Pydantic 2.14+ requirements.
- **Atomic Snapshot Strategy**: We store the full state of the risk (the "Snapshot") on the `RiskNote` issued for each transaction. This ensures that every document (Risk Note, Invoice) refers to the authoritative state of the cover at the exact moment of issuance.
- **Policy as the Contract Container**: The `Policy` model remains the long-lived container for the contract, but coverage-specific data (dates, values) is derived from its related `RiskNotes`.
- **Pro-rata Endorsements**: Premium adjustments for mid-term modifications are calculated pro-rata based on the remaining coverage period relative to the original term.
