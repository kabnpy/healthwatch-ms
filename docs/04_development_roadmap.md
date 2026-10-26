# Development Roadmap & Project Status

> **STATUS:** Authoritative Roadmap Baseline
> **ALIGNMENT:** Synchronized with Section 16 and Section 20 of the expanded [insurance_agency_system_documentation.md](./insurance_agency_system_documentation.md).

---

## 1. Implementation Status Overview

| Phase | Focus Area | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Contracts & Invariant Gates** | **Completed** | Accounting & allocation invariants, deterministic rate rules, asynchronous document generation contract, OCC error codes, immutability matrix (§18.9). |
| **Phase 1** | **Core Foundations** | **Completed** | Full stack upgrade (FastAPI 0.143+, React 19, Bun, `uv`), Client/Insurer/Policy models, Alembic migrations, Hey-API sync, document storage abstraction. |
| **Phase 2** | **Renewal Workflow Engine & Operations** | **Completed** | 6-stage renewal state machine, OCC versioning, single-active renewal index, payment records & allocations, broker command deck, global search. |
| **Phase 3** | **Financials, Advisory Rating & Documents** | **Completed** | RateTableVersion lifecycle, 6 rating paradigms, deterministic `PremiumCalculation`, durable background PDF worker contracts, IPF agreement deposit validation, commission remittance. |
| **Phase 4** | **Statements, Claims & Operational Hardening** | **Completed** | Monthly invoice batches, running balance statements, claims advocacy & loss ratio summaries, Alembic migrations, 100% green test suite. |

---

## 2. Structured Phase Milestones

### Phase 0: Implementation Contracts & Invariant Gates (Completed)
- [x] Establish transactional snapshot pattern for required covers (Motor/Domestic) and durable Policy container identity.
- [x] Mandate fixed-point arithmetic (`Decimal`) with zero float usage across financial models.
- [x] Define canonical API route contracts and stable error envelope (`400`, `401`, `404`, `409`, `422`, `503`).
- [x] Standardize asynchronous document generation contract (`202 Accepted`, `DocumentJob`, `Idempotency-Key`).
- [x] Formalize Immutability, Versioning & Deletion Policy (§18.9) prohibiting hard deletes on financial/audit records.

### Phase 1: Core Foundations (Completed)
- [x] Modernized backend on Python 3.14.8 with `uv`, SQLModel 0.0.48+, and Pydantic v2.14+.
- [x] Password hashing with `pwdlib[argon2,bcrypt]`.
- [x] Alembic consolidated baseline schema with `AUTO_CREATE_TABLES` dev support.
- [x] Modernized frontend on React 19, `@tanstack/react-query` v5, `@tanstack/react-router`, Vite 8, and Biome.
- [x] Generated API client with `@hey-api/client-axios` unwrapping `.data` at hook boundaries.
- [x] Polymorphic document upload and viewer (`UnifiedDocumentManager.tsx`).

### Phase 2: Renewal Workflow Engine & Operations (Completed)
- [x] Model `Renewal` entity with `version: int` and 6 explicit business states (`backend/app/models.py`, `backend/app/api/routes/renewals.py`):
  - `awaiting_carrier` ➔ `carrier_received` ➔ `client_invited` ➔ `paid` ➔ `completed` (plus `changes_requested`).
- [x] Enforce partial unique index: at most one active renewal per policy (`WHERE status NOT IN ('completed', 'cancelled')`).
- [x] Implement `Vehicle` relational model for motor policies and deprecate legacy transient structures (`backend/app/api/routes/vehicles.py`).
- [x] Implement manual `PaymentRecord` and `PaymentAllocation` models with transactional lock ensuring $\sum \text{allocations} \le \text{payment}$ (`backend/app/api/routes/payments.py`).
- [x] Implement append-only `Activity` timeline model and endpoints for operational audit (`backend/app/api/routes/activities.py`).
- [x] Implement Agent Operations Dashboard (Broker Command Deck in `frontend/src/routes/_layout/index.tsx`).
- [x] Implement Global Omni-Search (`Cmd + K` in `frontend/src/components/Common/CommandMenu.tsx`).
- [x] Implement Active Policies Grid on Client Hub with dual card/table views and Zero Proportional Numerals (`frontend/src/routes/_layout/clients.$clientId.policies.index.tsx`).
- [x] Standardize A4 Print CSS layout (`frontend/src/index.css`) and wire Print / Export PDF actions on Policy Detail view (`frontend/src/routes/_layout/clients.$clientId.policies.$policyId.tsx`).
- [x] Connect Renewals Desk UI to backend `RenewalsService` with 6-stage workflow transitions and optimistic concurrency (`frontend/src/routes/_layout/renewals.index.tsx` & `RenewalTransitionSheet.tsx`).
- [x] Build interactive `ActivityTimeline` UI wired to `ActivitiesService` for client & policy overview tabs (`ActivityTimeline.tsx`).
- [x] Implement `RecordPaymentModal` wired to `PaymentsService` from the Command Deck quick action dock (`RecordPaymentModal.tsx` & `usePayments.ts`).
- [x] Visual polish: Align Sidebar branding (`HEALTHWATCH` logo) and replace double-pill tab stacking on Policy Digital File.
- [x] Implement Authoritative Reference Catalog & Acceptance Dataset ([docs/07_reference_catalog_and_seeding.md](./07_reference_catalog_and_seeding.md)) with 8 Kenyan underwriters, 16 products, 28 clients, and full 6-stage renewal lifecycle pipeline.

### Phase 3: Financials, Advisory Rating & Document Pipeline (Completed)
- [x] Versioned rate tables (`RateTableVersion`, `RateBracket`, `RateBenefit`, `MedicalTier`, `TaxRateRule`) with lifecycle (`draft`, `published`, `retired`).
- [x] Support the verified agency rating methods across HealthWatch product lines:
  1. Bracketed percentage with minimum premium (motor private and mini-fleets).
  2. Multi-component sum-insured pricing (domestic package).
  3. Selectable fixed-price demographic tiers (medical).
  4. Declared wage-roll schedule rating (WIBA / employers liability).
  5. Limit-of-indemnity rating (professional indemnity & public liability).
  6. Property & packaged retail pricing (commercial fire, burglary, standalone all risks, personal accident, and golfers insurance).
- [x] Build deterministic, immutable `PremiumCalculation` engine.
- [x] Align and synchronize catalog seed data (`backend/app/seed_mock_data.py`) with authoritative [docs/07_reference_catalog_and_seeding.md](./07_reference_catalog_and_seeding.md) to eliminate mock data drift.
- [x] Model `IPFAgreement` tripartite financing facility and bank guarantee commitment verification (§3.4).
- [x] Model `CommissionSchedule` and automated carrier gross-to-net remittance calculations (§3.5).
- [x] Background document generation worker contract (`DocumentJob`) with retry backoff and idempotency protection (`202 Accepted`).
- [x] Protected, short-lived signed URLs for Cloudflare R2 downloads.

### Phase 4: Statements, Claims & Operational Hardening (Completed)
- [x] Client monthly `InvoiceBatch` generation per `(client_id, month)`.
- [x] Client running-balance `Statement` generation reconciled from authoritative ledger (Invoices and PaymentAllocations).
- [x] Outward Monthly Carrier Remittance calculation for insurer reconciliation.
- [x] Lightweight `Claim` 8-state lifecycle model and advocacy integration with the Renewals Desk (§3.6) with loss ratio calculation.
- [x] Background document job processing and state transitions (`QUEUED`, `PROCESSING`, `SUCCEEDED`, `FAILED`).
- [x] Complete test suite passing 100% (144/144 tests), clean Ruff lint & formatting, generated OpenAPI client, and successful frontend build.

---

## 3. Final Production Acceptance Checklist (§20)

The system is ready for initial production use only when all of the following invariants pass:
- [x] Agents can authenticate, log out, and have expired or revoked sessions rejected.
- [x] Client, policy, vehicle, insurer, offer, and document records can be created, indexed, and found via Cmd+K.
- [x] Annual renewal dates follow the calendar-month rule and manual initiation remains under agent control.
- [x] Insurer terms are reviewed before invitations are prepared; medical invitations are separate; competing offers and their versions remain preserved.
- [x] Every permitted and blocked renewal transition is tested, including the informal exception audit trail.
- [x] Client payment evidence cannot be mistaken for cleared payment; payment records, allocations, and insurer receipts remain distinct.
- [x] Invalid, missing, ambiguous, or uncovered rate data blocks premium calculation.
- [x] Calculation results are reproducible and use verified integer KES rounding and tax formulas.
- [x] Concurrent updates to renewals cannot silently overwrite newer changes (OCC returns 409).
- [x] Generated documents render from immutable request-time snapshots.
- [x] Background jobs survive restarts, retry safely, and expose terminal failures without duplicating artifacts.
- [x] Invoice batches and statements reconcile to agency invoices and payment allocations; insurer receipt documents are not counted as payment credits.
- [x] Document downloads are authenticated and use short-lived URLs.
- [x] Audit events capture material financial changes, rate revisions, and payment reversals.
