# Technical Architecture

## 1. Tech Stack
- **Frontend:** React 19 (Vite 8), Bun, TanStack Query v5, TanStack Router, Shadcn UI, Tailwind CSS.
- **Backend:** Python 3.14.8, FastAPI, SQLModel (SQLAlchemy 2 + Pydantic v2), `pwdlib`.
- **Database:** PostgreSQL (Alembic migrations with `AUTO_CREATE_TABLES` dev support).
- **Runtime:** `uv` (Fast Python packaging/runner), Docker Compose v2 (Production & Local dev), Traefik v3.3, Mailpit.
- **Client Gen:** `@hey-api/openapi-ts` with `@hey-api/client-axios` (Syncs frontend types and Axios callers).

## 2. Database Schema Strategy
We use a **Transaction Log** approach for Risk Notes and a **Temporal Versioning** approach for Risk Items to support "Time Travel" (Endorsements) without losing history.

### Key Models
- **RiskNote (The Transaction):**
  - `transaction_type`: Enum (`New Business`, `Renewal`, `Endorsement`, `Cancellation`).
  - `invoice_number`: Optional[str] (For tax compliance/eTIMS).
  - `previous_risk_note_id`: FK (Self-referential link to history).
  - `payment_status`: Enum (`Unpaid`, `Partial`, `Paid`).
- **RiskItem (The Asset History):**
  - `valid_from`: Date.
  - `valid_to`: Date (Nullable).
  - `version_number`: Int (Increments on change).
  - `is_active`: Bool.
  - *Logic:* We never update a Risk Item in place. We "expire" the old one (set `valid_to`) and create a new one with `version_number + 1`.

## 3. Deployment Architecture (Split-Stack)
- **Frontend:** Deployed to Vercel (Static Site).
- **Backend:** Deployed to Render (Python Native).
- **DB:** Managed Postgres on Neon.
- **Config:** Frontend consumes `VITE_API_URL` environment variable.

alternative railway.app single point for deployments

## 4. Feature Flagging Strategy
We use a local config file to manage complexity and gate incomplete features.
- **File:** `frontend/src/config/features.ts`
- **Mechanism:** Simple boolean export.
  ```typescript
  export const FEATURES = {
    NEW_BUSINESS: true,     // MVP
    DASHBOARD_VIEW: true,   // MVP
    PRINT_RISK_NOTE: true,  // MVP
    ENDORSEMENTS: false,    // Future (Requires Temporal Logic)
    RENEWALS: false,        // Future (Requires Batch Logic)
    CLAIMS: false           // Future (Requires Workflow Engine)
  };
