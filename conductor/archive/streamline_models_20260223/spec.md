# Specification: Backend Model Streamlining & Debt Reduction

## 1. Overview
This track refactors the backend database models to align with a more robust, "single source of truth" architecture as defined in `./planning/models.py`. The primary goal is to eliminate data redundancy, remove unnecessary computed properties, and consolidate financial state management into the appropriate layers.

## 2. Functional Requirements

### 2.1 Authoritative Risk State
- **Refactor `Policy` Model:** Add a `risk_details` JSON column to the `Policy` model. This becomes the authoritative, real-time record of what is being insured.
- **Refactor `RiskNote` Model:** Remove the `policy_snapshot` and `financial_breakdown` (if redundant) from `RiskNote`.
- **Implement `change_log`:** Update `RiskNote` to store a structured `change_log` for endorsements, recording only the diffs relative to the `Policy` state.
- **Explicit Coverage Period:** `RiskNote` remains the source of truth for `coverage_start` and `coverage_end` for a specific term, but it no longer stores a full copy of the policy's risk data.

### 2.2 Financial Consolidation
- **Remove `payment_status`:** Delete the `payment_status` field from the `RiskNote` model.
- **Derived Payment State:** Update any logic that relied on `RiskNote.payment_status` to instead query the linked `Invoice` and its `balance_due`.

### 2.3 Structural Cleanup & Performance
- **Remove Computed Properties:** Eliminate `@computed_field` and `@property` decorators on the `Policy` model that perform relationship traversals (e.g., `current_risk_details`, `total_premium`, `display_name`).
- **Standardize Enums:** Align all project enums with the streamlined definitions in the blueprint (e.g., `PolicyStatus`, `TransactionType`).
- **Simplify Models:** Ensure models carry data only. Validation and calculation logic must reside in the `RatingService` or other service layers.

## 3. Non-Functional Requirements
- **Data Integrity:** Provide an Alembic migration that safely migrates existing `policy_snapshot` data from `RiskNote` to the new `Policy.risk_details` field before dropping the old columns.
- **Type Safety:** Ensure all models use Python 3.10+ type hints and `SQLModel` standards.
- **Auditability:** Retain the `AuditMixin` on all primary entities (Client, Policy, RiskNote, etc.).

## 4. Acceptance Criteria
- [ ] Existing backend tests pass (after being updated to reflect the new structure).
- [ ] `Policy.risk_details` contains the current state of the risk for all existing policies.
- [ ] `RiskNote` no longer contains redundant `policy_snapshot` data.
- [ ] Endorsements correctly update the `Policy.risk_details` and log the diff in `RiskNote.change_log`.
- [ ] Payment status is correctly derived from the `Invoice` layer.

## 5. Out of Scope
- Redesigning the frontend UI components.
- Implementing new insurance products or rating strategies.
- Changing the RBAC system.
