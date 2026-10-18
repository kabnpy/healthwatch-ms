# Implementation Plan: Fix Risk Note & Invoice Template Data

This plan focuses on auditing the financial data lifecycle for Motor Private policies and ensuring the Risk Note and Invoice templates reflect the "Single Source of Truth" from the backend.

## Phase 1: Diagnosis & Backend Hardening [checkpoint: 3a4ff87]
Establish robust data persistence and rating audits.

- [x] **Task: Audit Rating Engine Outputs** [9b5da55]
    - [ ] Write unit tests in `backend/tests/test_rating_service.py` to verify that `MotorPrivateRatingStrategy` returns high-precision `Decimal` values for all levies and benefits.
- [x] **Task: Verify Policy Persistence** [b19116e]
    - [ ] Write integration tests in `backend/tests/crud/test_insurance.py` to verify that `PolicyService.create_policy` correctly persists the full financial breakdown in the `RiskNote.financial_breakdown` JSON field.
- [x] **Task: Restrict Product Selection** [5a420b3]
    - [ ] Update `frontend/src/components/Insurance/Wizard/NewPolicyWizard.tsx` to temporarily filter out all products except "Motor Private" to ensure system stability.
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Diagnosis & Backend Hardening' (Protocol in workflow.md)**

## Phase 2: Template Refactoring & Data Binding [checkpoint: [pending]]
Align document templates with the authoritative backend snapshots.

- [x] **Task: Refactor Risk Note Template** [f77e01a]
    - [ ] Update `frontend/src/components/Documents/templates/RiskNoteTemplate.tsx` to bind its financial table directly to the `financial_breakdown` object fetched from the backend.
- [x] **Task: Refactor Invoice Template** [c8d87d5]
    - [ ] Update `frontend/src/components/Documents/templates/InvoiceTemplate.tsx` to ensure total amounts and itemized lists are derived from the authoritative backend invoice record.
- [~] **Task: End-to-End Verification**
    - [ ] Create a Playwright E2E test in `frontend/tests/policy-issuance.spec.ts` that creates a policy and verifies the text content of the generated Risk Note and Invoice templates.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Template Refactoring & Data Binding' (Protocol in workflow.md)**

## Phase 3: Stabilization & Cleanup [checkpoint: [pending]]
Final validation and mock data alignment.

- [ ] **Task: Update Mock Seeding**
    - [ ] Align `backend/app/seed_mock_data.py` with the new financial breakdown format to ensure local development environments have high-quality test data.
- [ ] **Task: Coverage Audit**
    - [ ] Run backend coverage reports to ensure >80% coverage for the refactored services.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Stabilization & Cleanup' (Protocol in workflow.md)**
