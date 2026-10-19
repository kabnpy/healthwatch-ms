# Technical Architecture: Insurance Agency Management System

> **STATUS:** Authoritative Architecture Baseline
> **ALIGNMENT:** Synchronized with the expanded [insurance_agency_system_documentation.md](./insurance_agency_system_documentation.md) baseline.

---

## 1. System Technology Stack

- **Frontend:**
  - **Framework & Runtime:** React 19, Vite 8, Bun.
  - **State & Data Fetching:** TanStack Query v5 (unwrap `.data` at hook boundary).
  - **Routing:** TanStack Router (`frontend/src/routes/`).
  - **UI & Styling:** Tailwind CSS, Shadcn UI primitives, Lucide icons.
  - **Client Generation:** `@hey-api/openapi-ts` with `@hey-api/client-axios`.
- **Backend:**
  - **Language & Framework:** Python 3.14.8, FastAPI.
  - **ORM & Validation:** SQLModel (SQLAlchemy 2 + Pydantic v2).
  - **Authentication:** `pwdlib[argon2,bcrypt]` password hashing, JWT bearer tokens.
  - **Tooling:** `uv` for fast dependency management and test execution.
- **Database & Storage:**
  - **Primary Database:** PostgreSQL 16+ (Alembic migrations).
  - **Object Storage:** Cloudflare R2 (S3-compatible API) for production document storage; local filesystem abstraction for development.
- **Document Generation Pipeline:**
  - Asynchronous background worker for PDF generation (WeasyPrint / Headless Chromium).
  - Pre-renders documents using HTML/CSS Jinja2 templates.
- **Infrastructure & Deployment:**
  - **Target Platform:** Railway (FastAPI backend service, PostgreSQL database, React static assets).
  - **Local Development:** Docker Compose v2 (`compose.yml` + `compose.override.yml`), Traefik v3.3, Mailpit.

---

## 2. Core Architectural Patterns

### 2.1 Transactional Snapshot Pattern & Policy Identity
- `Policy` serves strictly as the durable identity container (`policy_number`, `client_id`, `product_id`, `inception_date`, `status`). It contains no transient duplicate cover details.
- `RiskNote.cover_snapshot` is an immutable transaction overview snapshot capturing asset terms, limits, and rating calculations specifically for product lines that require carrier cover slips (e.g. Motor, Domestic). Product classes like Medical never generate a Risk Note.
- The authoritative source for pricing rules and formula evaluation is the versioned `PremiumCalculation`, not the generated document.
- Generated documents (Invitations, Risk Notes, Invoices, Statements) capture their input snapshot at **request time**, not when a delayed worker executes.

### 2.2 Deterministic Rating Engine & `PremiumCalculation`
- Rate tables are versioned data (`RateTableVersion` with lifecycle: `draft` ➔ `published` ➔ `retired`). Once published or referenced, a version is immutable.
- A `PremiumCalculation` is a persisted, deterministic calculation run capturing exact input values, rule provenance (table version, brackets, taxes, benefits), itemized formula calculations, and integer KES totals.
- Generated artifacts link directly to the specific `PremiumCalculation` run.

### 2.3 Optimistic Concurrency Control (OCC)
- Stateful entities (specifically `Renewal`) maintain a `version: int` column.
- Updates require matching the client-held version. Stale writes reject with `HTTP 409 Conflict` and stable error code `renewal_modified_concurrently`.

### 2.4 At Most One Active Renewal Invariant
- A policy may have multiple historical renewals, but must have **at most one active renewal** in flight.
- Enforced at both application service level and by a PostgreSQL partial unique index:
  ```sql
  CREATE UNIQUE INDEX uq_policy_single_active_renewal
  ON renewal (policy_id)
  WHERE status NOT IN ('completed', 'cancelled');
  ```

### 2.5 Asynchronous Generation Contract & Public Job State Machine (§7, §9)
- All document generation endpoints return `202 Accepted` with a durable job record:
  ```json
  {
    "job_id": "<uuid>",
    "status": "pending",
    "status_url": "/document-jobs/<uuid>",
    "resource": { "type": "risk_note", "id": "<uuid>" }
  }
  ```
- **Public States:** Only `pending`, `processing`, `succeeded`, and `failed` are exposed. Worker claims and lease expirations are internal.
- **Snapshot Before Enqueue:** In the same database transaction that creates the job and resource stub, the immutable generation-input snapshot is persisted. Workers render strictly from this snapshot.
- **Idempotency:** Generation and financial endpoints accept an `Idempotency-Key` scoped to agent and operation. Reusing a key with a different payload returns `409 idempotency_key_reused`.
- **Statement Exception:** No `Statement` database row is created until rendering and storage succeed; status is tracked via the returned `job_id`.

### 2.6 Strict Financial Precision & Ledger Invariants (§4.9, §18.3)
- Fixed-point arithmetic is mandatory across the entire stack.
- Monetary amounts are represented as integer KES (`Numeric(15, 2)` / integer minor units) with documented `ROUND_HALF_UP` rounding. Floating-point arithmetic (`float`) is prohibited.
- **Allocation Invariant:** Under database lock, the sum of active allocations on a `PaymentRecord` must never exceed the payment amount:
  $$\sum \text{PaymentAllocation.amount} \le \text{PaymentRecord.amount}$$
- Invoice balances are derived from issued invoice debits minus net active payment allocations.

### 2.7 Bounded Ledger Scope & Spreadsheet Reconciliation Alignment
- HealthWatch MS does not implement a full general ledger, multi-currency bank feeds, or automated gateway integrations. Full month-end reconciliation across bank accounts, paybills, and carrier statements was historically managed in comprehensive agency spreadsheets.
- The system's financial domain is intentionally bounded to provide reliable receivables (`Invoice`), cleared receipts (`PaymentRecord`), and allocations (`PaymentAllocation`), outputting deterministic statements and structured tabular ledger data designed to export into the agency's reconciliation spreadsheets without manual data entry or drift.

---

## 3. Immutability, Versioning & Deletion Policy (§18.9)

Generic `PUT` or `DELETE` operations are strictly forbidden on historical, financial, or published records:

| Record Type | Draft Phase | After Publication / Use | Deletion Rule |
| :--- | :--- | :--- | :--- |
| **RateTableVersion & Rules** | Fully editable in `draft`. | Frozen once published or referenced. Correct via successor version. | No deletion once published. |
| **PremiumCalculation** | N/A (runs are atomic). | Immutable once persisted. New calculation creates a new run. | Never deleted. |
| **Invoices & Batches** | Editable before issuance/freezing. | Issued terms are immutable. Correct via explicit void/credit reversal. | Never hard-deleted. |
| **PaymentRecords & Allocations** | Editable before commitment. | Append-only. Reverse via linked reversal records. Payment reversal cascades to allocations. | Never hard-deleted. |
| **Generated Artifacts** | Editable inputs prior to enqueue. | Frozen at request time. Changed terms require a new version. | Never hard-deleted. |
| **Activities & Audit Events** | Working note before save. | Append-only. Correct with linked follow-up activity. | Never hard-deleted. |

---

## 4. Canonical API Routes (§7)

- **Clients & KYC:** `POST /clients`, `GET /clients/{id}`, `POST /clients/{id}/documents`
- **Insurers & Offers:** `POST /insurers`, `POST /renewals/{id}/carrier-offer`
- **Policies & Assets:** `POST /policies`, `GET /policies/{id}`, `PATCH /policies/{id}/vehicle`
- **Renewals & Transitions:** `POST /renewals`, `PATCH /renewals/{id}/transition` (OCC check)
- **Calculations:** `POST /ratings/compute` (transient), `POST /premium-calculations` (persisted)
- **Documents & Generations:** `POST /renewals/{id}/invitation`, `POST /policies/{id}/risk-notes`
- **Payments & Ledger:**
  - `POST /payment-records` — Manually record payment instrument.
  - `POST /payment-records/{id}/allocations` — Allocate payment to invoice.
  - `POST /payment-allocations/{id}/reverse` — Reverse single allocation.
  - `POST /payment-records/{id}/reverse` — Atomically reverse payment and allocations.
  - `POST /invoice-batches` — Create monthly client batch.
  - `POST /statements` — Generate client running-balance statement (`202 Accepted`).
- **Job Polling:** `GET /document-jobs/{job_id}`, `POST /document-jobs/{job_id}/retry`
