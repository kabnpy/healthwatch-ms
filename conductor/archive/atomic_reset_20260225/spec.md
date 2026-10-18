# Specification: Atomic Reset (Structural Simplification)

## Overview
This track implements a foundational refactor of the core insurance data models. We are moving from a "Policy Cache + Delta" model to an **Atomic Snapshot** architecture. Each `RiskNote` contains the full, immutable state of the cover.

## Functional Requirements

### 1. Model Refactoring (SQLModel)
- **Policy Table**:
    - Remove `risk_details` (no longer the source of truth).
    - Fields: `id`, `policy_number`, `client_id`, `product_id`, `status`, `inception_date`.
- **RiskNote Table**:
    - Rename `risk_details` to `cover_snapshot`.
    - **Logical Nesting**: The `cover_snapshot` should use sensible nesting (e.g., a `vehicle` object, an `extensions` object) to group related data.
    - **Terms as Text**: `benefits_and_limits`, `excesses`, and `special_clauses` must be stored as plain-text/markdown strings, not nested objects.
- **Product Table**:
    - Add default text templates for: `default_benefits_and_limits`, `default_special_clauses`, and `default_excesses`.

### 2. Service Layer Updates
- **`PolicyService`**:
    - Create New Business: Insert Policy + RiskNote v1 (Full Snapshot).
    - Create Endorsement: Insert RiskNote v2 (Full Snapshot).
    - **Logic**: Remove all recursive diffing and patching logic.

### 3. API Enhancements
- **Policy Schema**:
    - Update `PolicyPublic` to include `active_note: RiskNotePublic | None`.
    - Populate this field by fetching the latest issued RiskNote for the policy.
- **Endpoints**:
    - `/policies/{id}`: Returns metadata + the current active snapshot.

### 4. Frontend & UI
- **History View**: Add a tab to browse through historical RiskNote snapshots.
- **Text Areas**: Use simple text areas for Terms, initialized from Product templates.

## Acceptance Criteria
- [ ] Policy creation and endorsements work with an atomic snapshot in the database.
- [ ] No "cached" risk details exist on the Policy table.
- [ ] The `PolicyPublic` API response contains the latest `active_note`.
- [ ] The Terms section (`benefits_and_limits`, etc.) are plain text fields in the DB and UI.
