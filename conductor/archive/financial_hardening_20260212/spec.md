# Specification: Core Financial and Architectural Hardening

## 1. Overview
This track implements the critical and high-priority recommendations from the Principal Engineer's code review. It focuses on financial precision, transactional integrity, architectural separation (Service Layer), and security (RBAC).

## 2. Functional Requirements

### 2.1 Financial Integrity (P0)
- **Decimal Migration:** Update all financial fields (Policy, Invoice, Receipt, RiskNote) from `float` to `Decimal` using `Numeric(15, 2)`.
- **Atomic Transactions:** Refactor `create_risk_note` to ensure Risk Note and Invoice/LineItem creation happen within a single database transaction.
- **Allocation Validation:** Add strict server-side checks in `create_receipt_allocation` to prevent over-allocation, negative amounts, or allocations to voided/cancelled entities.

### 2.2 Security & Type Safety (P1)
- **Status Enums:** Replace string literals for statuses (Policy, Invoice, Risk Note, etc.) with strict Python `Enum` types.
- **Role-Based Access Control (RBAC):**
  - Create a `@require_role` decorator.
  - Enforce role checks on all mutation routes (POST, PUT, DELETE).
- **Database Indexing:** Add indexes to all foreign key columns (`client_id`, `policy_id`, `product_id`, etc.) to optimize query performance.

### 2.3 Architectural Refinement (P2)
- **Soft Delete Pattern:** Implement a `deleted_at` and `deleted_by_id` audit mixin for all primary models. Update CRUD methods to respect soft deletes by default.
- **Document Model Refactor:** Implement a polymorphic document structure using PostgreSQL inheritance to handle various external attachments (IDs, Receipts, etc.) with referential integrity.
- **Service Layer Implementation:**
  - Create `backend/app/services/` directory.
  - Extract high-level business logic from CRUD into services, starting with Policy and Risk Note flows.
- **Motor Private Schema Validation:** Implement a nested Pydantic model for the `risk_details` JSON field specifically for "Motor Private" products.

### 2.4 Bug Fixes
- Fix the `Client` seeding crash in `seed_mock_data.py` by removing the non-existent `city` field.

## 3. Non-Functional Requirements
- **Precision:** All financial calculations must be rounding-error free.
- **Auditability:** Every deletion must be traceable.
- **Performance:** Significant reduction in full-table scans via foreign key indexing.

## 4. Acceptance Criteria
- `npm run build` and `pytest` pass.
- No `float` types used for currency in the backend models.
- Attempting to delete a record results in a soft delete.
- A user with a `VIEWER` role cannot create an Invoice or Risk Note.
- Motor Private policy creation fails if required `risk_details` (Reg No, Make, etc.) are missing or malformed.
