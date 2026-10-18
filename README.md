# Insurance Management System Workspace

A minimalist, high-performance insurance management workspace inspired by "Linear / Papermark" aesthetics. It unifies Client Portfolio Management, Policy Administration, Rating Engine, and Invoicing into a single streamlined workflow with context isolation and deep-nesting views.

---

## 🚀 Product Vision & Core Concepts

The **Insurance Management System** replaces cluttered, flat spreadsheet-like table views with a structured, folder-based context hierarchy. Key design principles and domain terms include:

- **Client Hub (`/clients/$id`)**: "Papermark" style card grid providing an at-a-glance portfolio view for active covers.
- **Insurance Dashboard (`/insurance/$id`)**: Deep-dive 3-column tabbed interface (Overview, History, Documents) for a specific insurance policy container.
- **Risk Note (Transaction Core)**: The dual-purpose document serving as both the transaction record (policy issuance/renewal/endorsement) and the official Debit Note (Invoice).
- **Risk Item (Asset & Versioning)**: Represents the insured asset (e.g. Vehicle, Property) with temporal history tracking.
- **Sum Insured**: The authoritative single source of truth for calculations across rating tiers, levies, taxes, and premiums.

---

## 🛠️ Key Features

### 1. Client & Portfolio Management
- Multi-contact support for corporate and individual clients.
- Visual card grid ("Papermark" style) with real-time coverage status indicators.

### 2. Insurance Policy Administration
- Tabbed dashboard for every cover:
  - **Overview ("The Face")**: Live state derived from the active `RiskNote` snapshot (dates, premiums, sums insured, clauses).
  - **History ("The Log")**: Immutable audit trail of transaction snapshots.
  - **Documents ("The Vault")**: Storage for policy schedules, valuation reports, and KYC documents.

### 3. Rating & Transaction Engine
- **Dynamic Rating Engine**: Supports percentage-based, tiered, and manual rating strategies based on vehicle value or asset sum insured.
- **Levy & Tax Auto-Calculation**: Standardized calculation of Training Levy, PHCF Levy, Stamp Duty, and Net Premium.
- **New Business & Renewal Wizards**: Wizard-driven policy issuance with dynamic coverage period calculations.
- **Mid-Term Endorsements & Pro-Rata**: Pro-rata premium adjustments on policy adjustments without losing historical state.

### 4. Printable Invoicing & Debit Notes
- Print-ready HTML layouts (`@media print`) for **Risk Notes** (coverage details) and **Debit Notes** (tax invoices and payment breakdowns).

---

## 🏗️ Architecture & Key Technical Decisions

- **Atomic Snapshot Strategy**: Every issued `RiskNote` stores a frozen snapshot (`cover_snapshot`) of the policy state, sum insured, and tax calculations at transaction time. This guarantees strict financial integrity and auditability.
- **Policy as Container**: The `Policy` table serves as the long-lived contract container, while all temporal details are derived from the active `RiskNote`.
- **Temporal Versioning**: Risk items are versioned rather than mutated in-place (`valid_from` / `valid_to`), enabling historical time-travel and accurate endorsements.
- **Feature Flagging (`frontend/src/config/features.ts`)**: Modular flags to toggle features such as Endorsements, Renewals, and Claims.

---

## ⚡ Technology Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com) (Python 3.10+)
- **ORM / Validation**: [SQLModel](https://sqlmodel.tiangolo.com) (SQLAlchemy + [Pydantic v2](https://docs.pydantic.dev))
- **Database & Migrations**: PostgreSQL & [Alembic](https://alembic.sqlalchemy.org/)
- **Package & Runtime Manager**: [`uv`](https://github.com/astral-sh/uv)
- **Testing & Code Quality**: Pytest, Ruff, Mypy

### Frontend
- **Framework**: [React 19](https://react.dev) + [Vite](https://vitejs.dev)
- **Language**: TypeScript
- **State & Data Fetching**: [TanStack Query v5](https://tanstack.com/query)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **UI & Styling**: [Tailwind CSS v4](https://tailwindcss.com), [Shadcn UI](https://ui.shadcn.com), Lucide Icons
- **API Client Generation**: `@hey-api/openapi-ts`
- **Linting & Formatting**: [Biome](https://biomejs.dev)

### Infrastructure & Operations
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Traefik
- **Testing**: Playwright (E2E), Vitest (Unit)

---

## 📁 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/         # FastAPI endpoints / routers
│   │   ├── crud/           # Database CRUD logic
│   │   ├── models/         # SQLModel database models
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── services/       # Rating, Policy & Financial business logic
│   │   └── main.py         # App entry point
│   └── alembic/            # Database migrations
├── frontend/
│   ├── src/
│   │   ├── client/         # Auto-generated OpenAPI TypeScript client
│   │   ├── components/     # UI components & Shadcn primitives
│   │   ├── hooks/          # TanStack Query & custom React hooks
│   │   ├── routes/         # TanStack file-based routes / pages
│   │   └── config/         # Feature flags (`features.ts`)
├── docs/                   # Product & Technical Specifications
│   ├── 01_product_specs.md
│   ├── 02_tech_architecture.md
│   ├── 03_backend_data_models.md
│   └── 04_development_roadmap.md
└── planning/               # Architectural decisions and sprint tracking
    ├── status.md
    └── architecture_decision_records.md
```

---

## 🚀 Quick Start & Local Development

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd full-stack-fastapi-template
   ```

2. **Configure Environment Variables**:
   Copy the example `.env` file and adjust secrets if needed:
   ```bash
   cp .env .env.local
   ```

3. **Start the Stack**:
   ```bash
   docker compose up -d --build
   ```

   The services will be available at:
   - **Frontend**: http://localhost:5173
   - **Backend API Docs (Swagger)**: http://localhost:8000/docs
   - **Traefik Dashboard**: http://localhost:8090
   - **Mailcatcher**: http://localhost:1080

---

### Option 2: Local Native Development

#### Backend Setup

1. **Install `uv`** (if not already installed):
   ```bash
   pip install uv
   ```

2. **Navigate to backend and install dependencies**:
   ```bash
   cd backend
   uv sync
   ```

3. **Run Database Migrations & Seed Mock Data**:
   ```bash
   uv run alembic upgrade head
   uv run python app/initial_data.py
   ```

4. **Start Backend Server**:
   ```bash
   uv run fastapi dev app/main.py
   ```

#### Frontend Setup

1. **Navigate to frontend and install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Generate OpenAPI Client**:
   ```bash
   npm run generate-client
   ```

3. **Start Frontend Development Server**:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Quality Assurance

### Backend
Run backend test suite with Pytest:
```bash
cd backend
uv run pytest
```

Check linting and types:
```bash
cd backend
uv run ruff check .
uv run mypy app
```

### Frontend
Run unit tests and typecheck:
```bash
cd frontend
npm run test
npm run build
```

Run Biome linter:
```bash
cd frontend
npm run lint
```

---

## 🗺️ Roadmap & Phase Status

- [x] **Phase 1: MVP "Happy Path"** - New Business Wizard, Client Hub, Cover Dashboard, Printable Risk/Debit Notes, Atomic Snapshots.
- [ ] **Phase 2: Temporal Endorsements** - Pro-rata calculations, asset versioning history views, mid-term cover adjustments.
- [ ] **Phase 3: Financial Invoicing & Cashiering** - Receipting, allocation, knock-off status, multi-invoice payments.
- [ ] **Phase 4: Claims Management** - Loss reporting, claim lifecycle tracker, loss adjuster document attachments.

For full architectural details and status updates, refer to [docs/](./docs/) and [planning/status.md](./planning/status.md).

---

## 📄 License

This project is licensed under the MIT License.
