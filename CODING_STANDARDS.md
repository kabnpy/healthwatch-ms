# Coding Standards

Authoritative standards for `/code-review` (Standards axis) and implementation across HealthWatch MS. Skip rules already enforced by `bun run lint` (`ruff` and `biome`) or `bun run typecheck` (`tsc`).

## 1. Financial Precision & Rating Authority

- **Fixed-Point `Decimal` Only:** Represent all monetary amounts, rates, sums insured, taxes, levies, and commissions with Python `Decimal` (constructed from strings or integers, quantized with explicit `ROUND_HALF_UP`). Never use `float` in backend models, schemas, or services, or IEEE-754 arithmetic on money in the frontend.
- **Pricing Authority:** `PremiumCalculation` is the sole calculation authority. Route handlers, UI components, and document templates render persisted calculation outputs rather than recomputing premiums or statutory levies (`StatutoryLevy`) independently.

## 2. Domain & Ledger Invariants

- **Policy vs. RiskNote:** `Policy` is strictly a durable contract container (`policy_number`, `client_id`, `product_id`, `status`). A `RiskNote` and its immutable `cover_snapshot` are generated only for slip-based lines (Motor, Domestic) on new business, renewals, or endorsements. **Medical policies and cancellations never generate a Risk Note.**
- **Bounded Payment Ledger vs. Evidence:**
  - `PaymentRecord` represents verified, cleared funds received into the agency account.
  - `PaymentAllocation` applies cleared funds against an `Invoice` under database lock such that $\sum \text{active allocations} \le \text{PaymentRecord.amount}$.
  - `Document (proof_of_payment)` is unverified client evidence and never modifies invoice balances.
  - `Document (insurer_receipt)` is carrier confirmation of remittance; only it confirms active coverage and unlocks commission eligibility.
  - Do not introduce general-ledger accounting, automated bank feeds, or payment-gateway integrations (see `docs/adr/0002-bounded-payment-ledger-and-evidence-separation.md`).
- **Append-Only Historical Records:** Published `RateTableVersion` rows, `PremiumCalculation` runs, issued `Invoice` records, committed `PaymentRecord` / `PaymentAllocation` rows, and `Activity` logs are immutable (`docs/adr/0006-append-only-immutability-and-reversals.md`). Corrections use explicit reversal or successor records, never in-place mutation or hard deletion.

## 3. Backend Architecture (`backend/app/`)

- **Layering:** Place FastAPI route handlers in `backend/app/api/routes/` and register them in `backend/app/api/main.py`. Encapsulate domain calculations, state transitions, and persistence logic in `backend/app/services/` or `backend/app/crud/`.
- **Contracts & Sessions:** Define request and response payloads as Pydantic v2 schemas and database tables in `backend/app/models.py`. Inject database sessions via `SessionDep`.
- **UTC Timestamps:** Use timezone-aware UTC timestamps (`get_datetime_utc()`) across all models, defaults, and queries. Avoid naive `datetime.now()` or `datetime.utcnow()`.

## 4. Frontend Architecture (`frontend/src/`)

- **Generated OpenAPI Client:** Never hand-edit `frontend/src/client/`. After changing backend routes or Pydantic schemas, regenerate via `bun run client` (in a single serialized step, never concurrently across parallel worktrees).
- **Data Fetching Boundary:** Place TanStack Query v5 hooks in `frontend/src/hooks/` and unwrap `.data` inside the hook before returning to components.
- **Financial Typography & Tone:** Render all currency figures with `font-mono tabular-nums text-right` (`docs/02_design_system.md`). Use canonical terminology from `GLOSSARY.md` and zero emoji across code, comments, docs, and UI copy.
