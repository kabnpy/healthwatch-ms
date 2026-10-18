# Model Update Strategy - Temporal & Refined Architecture

## Objective
Implement the refined data models as defined in `docs/03_backend_data_models.md` to support history tracking, flexible pricing, and polymorphic document storage.

## Phase 1: Model Updates (Backend)

### 1.1 User & Client
- **User:** Add `role` Enum (`Admin`, `Underwriter`, `Cashier`, `Viewer`).
- **Client:** Rename `postal_address` to `physical_address`.

### 1.2 Catalog (Product)
- **Product:** Add `pricing_strategy` (Enum), `pricing_rules` (JSON), and `form_schema` (JSON).

### 1.3 Policy Engine
- **Policy:** Add `created_at` (Timestamp).
- **RiskItem:**
    - Implement Temporal Versioning: `version_number`, `valid_from`, `valid_to`, `is_active`.
    - Retain: `description`, `cover_description`, `total_premium`, `premium_breakdown`, `risk_details`.
- **RiskNote:**
    - Add: `invoice_number`, `created_by_id`, `previous_risk_note_id`, `payment_status`.
    - Financials: `net_premium`, `taxes`, `total_amount`.
    - Snapshots: `items_snapshot`.

### 1.4 Financials
- **Rename:** `Receipt` -> `Payment`.
- **Payment:** `date`, `amount`, `unallocated_amount`, `payment_mode`, `reference`, `created_by_id`.
- **PaymentAllocation:** Link between `Payment` and `RiskNote`.

### 1.5 Polymorphic Documents
- **Document:** Single table for all attachments.
- Fields: `entity_type`, `entity_id`, `document_type`, `file_path`, `mime_type`, `uploaded_at`.

## Phase 2: Implementation & Consumer Updates

### 2.1 CRUD & API
- Refactor all CRUD functions to handle new fields and temporal logic (especially `RiskItem` versioning).
- Update API routes to reflect schema changes.

### 2.2 Migrations
- Generate Alembic revision for the major schema change.
- Handle data migration for existing records if possible (or reset DB for MVP).

## Phase 3: Frontend Alignment

### 3.1 Client & Types
- Regenerate `src/client` using `openapi-ts`.

### 3.2 View Updates
- **Client Hub:** Update for new financial fields.
- **Policy Dashboard:** Handle multiple versions of `RiskItem`.
- **Wizard:** Prepare for `form_schema` based dynamic fields.

## Progress Tracking
- [ ] Phase 1: Backend Model Definitions
- [ ] Phase 2: Backend CRUD & API Refactoring
- [ ] Phase 3: Database Migrations
- [ ] Phase 4: Frontend Regeneration & Refactoring
