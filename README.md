# HealthWatch MS

HealthWatch MS is an agency management workspace designed to digitize the day-to-day operations of an insurance agency.

---

## Why This System Was Built

At HealthWatch, managing insurance policies historically meant managing physical paper files. If an agent needed to verify what a client was charged last year, check an endorsement, or inspect a client's logbook and KRA PIN certificate, someone had to walk over to the filing cabinets, pull the physical folder, flip through printed pages, and scan documents again.

When an agency manages hundreds of policies across multiple insurance carriers, physical paperwork creates constant friction:

- **Lost Time:** Agents spend hours locating physical folders, verifying older policy schedules, and re-scanning the same client KYC records.
- **Renewal Risks:** In insurance, timing is critical. If a policy expiry date slips by unnoticed, a client is left uninsured on the road, and the agency risks losing the account.
- **Payment and Balance Confusion:** Clients often pay in installments or send M-Pesa transaction messages over WhatsApp. Without a single ledger, tracking which invoices are paid, which are pending, and whether the insurer has confirmed receipt of funds becomes messy.
- **Manual Calculation Errors:** Calculating premiums by hand against carrier rate sheets, minimum premiums, and statutory levies (Training Levy, Policyholders Compensation Fund, Stamp Duty) is slow and prone to mistakes.

HealthWatch MS was built to translate the real, everyday workflow of the agency into a working digital system. It replaces physical file cabinets with a single, reliable workspace where any agent can find what they need in seconds.

---

## What This Means for the Agency

### 1. Centralized Client Files and KYC
Every client profile acts as a digital master folder. National ID cards, KRA PIN certificates, vehicle logbooks, valuation reports, and correspondence are attached directly to the client and policy records. Documents are scanned and uploaded once, accessible to the entire team from any screen.

### 2. A Disciplined Renewal Workflow
The system actively tracks policy expiration dates and organizes renewals into an operational pipeline starting 30 days before expiry:
- Tracking when the carrier's renewal notice is requested and received.
- Reviewing terms before issuing a client invitation.
- Handling client change requests without losing track of original terms.
- Ensuring that two agents never accidentally work on or alter the same renewal simultaneously.

### 3. Clear Invoices, Payments, and Statements
The system brings clarity to client balances and accounting:
- **Client Invoices:** Generated automatically when new cover or a renewal is issued.
- **Payment Records:** Payments received by the agency are logged with their payment method (M-Pesa, bank transfer, cheque, financing) and allocated directly to outstanding invoices.
- **Proof vs. Cleared Funds:** Client-provided M-Pesa screenshots or transfer slips are stored safely as evidence, but are kept distinct from cleared agency funds.
- **Insurer Receipts:** Documents from the insurance company confirming payment are tracked separately, serving as the official indicator that coverage is in force and agency commission can be recognized.
- **Statements on Demand:** Accurate, running-balance account statements can be generated for any client and date range with one click.

### 4. Fast, Accurate Premium Estimates
Instead of digging through printed insurer circulars, agents can run instant indicative premium calculations:
- **Motor Cover:** Automatically applies the right percentage rate and minimum premium based on the vehicle value.
- **Domestic Cover:** Handles building and household contents values separately.
- **Medical Cover:** Selects the appropriate insurer tier and benefit limits.
- **Statutory Levies:** Automatically calculates and breaks down the Training Levy, PHCF levy, and Stamp Duty.

### 5. Reliable Business History
Whenever a risk note, renewal invitation, invoice, or statement is produced, the system locks in an exact snapshot of the terms and figures used at that moment. Updating a client's phone number or changing an insurer rate table later will never alter or corrupt a document that was issued months earlier.

---

## What the System Covers

- **Command Deck:** A daily dashboard highlighting upcoming expiries, renewals awaiting carrier notices, and accounts pending payment.
- **Global Search (Cmd + K):** Instant lookup across clients, policy numbers, vehicle registration numbers, and uploaded files.
- **Policy Administration:** Long-lived policy records that maintain their complete history of renewals and changes over time.
- **Document Vault:** Secure storage and in-app preview for all client KYC documents, carrier notices, and valuation reports.
- **Activity Timeline:** A chronological log of client calls, meetings, reminders, and notes attached to each account.

---

## Project Documentation

Documentation is organized for both engineers and coding agents:

- **[Domain Glossary](GLOSSARY.md):** Canonical domain language and `_Avoid_` terms.
- **[Coding Standards](CODING_STANDARDS.md):** Architectural, financial precision, and review invariants.
- **[Architecture Decision Records](docs/adr/):** Atomic architectural decisions (`0001`–`0006`).
- **[Product Specifications](docs/01_product_specs.md):** Core workflows, renewal state machine, and rating math.
- **[Design System](docs/02_design_system.md):** UI patterns, OKLCH color tokens, financial numeral rules, and A4 print specifications.
- **[Git Hygiene](docs/03_git_hygiene.md):** Branching conventions, Conventional Commits, and pre-commit hooks.
- **[Reference Catalog & Seeding](docs/04_reference_catalog_and_seeding.md):** Kenyan underwriter catalog, statutory levy benchmarks, and realistic test portfolio.

---

## Technical Overview

For technical teams and developers:

- **Backend:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2 + Pydantic v2), PostgreSQL 16+.
- **Frontend:** React 19, Vite 8, Bun, TanStack Query v5, TanStack Router, Tailwind CSS, Shadcn UI.
- **Storage:** Cloudflare R2 object storage with secure, short-lived signed URLs.
- **Infrastructure:** Docker Compose v2 / Podman Compose for local development, Railway for production hosting.

### Running Locally

Ensure `.env` exists (copied from `.env.example`), then use root `package.json` scripts via `bun run`:

```bash
# 1. Start database, run migrations, seed data, and launch backend + frontend concurrently:
bun run dev

# 2. Check operational status of runtime, DB, API, and frontend:
bun run status
```

Service URLs:
- Frontend UI: http://localhost:5173
- Backend API Documentation: http://localhost:8000/docs
- Local Email Viewer (Mailpit): http://localhost:1080

Additional workspace commands (`package.json`):
```bash
bun run dev:backend   # Run FastAPI dev server natively
bun run dev:frontend  # Run Vite dev server natively
bun run test          # Run all backend pytest and frontend vitest suites
bun run test:e2e      # Run Playwright E2E suite
bun run typecheck     # Run TypeScript compiler check
bun run lint          # Run Ruff and Biome linters
bun run format        # Auto-format codebase
bun run client        # Export OpenAPI schema and regenerate TypeScript client
bun run migrate       # Apply Alembic database migrations
bun run seed          # Seed realistic underwriting and client portfolio
```

---

## License

This project is licensed under the MIT License.
