# Implementation Plan: Cleanup Convoluted Legacy Logic

## Phase 1: Validation & Schema Semantic Nesting
Refactor the schema layer to use strict nesting (e.g., `vehicle`, `extensions`) and remove all legacy aliases.

- [x] Task: Refactor `MotorPrivateRiskDetails` schema
    - [x] Create `VehicleDetails` sub-model
    - [x] Create `MotorExtensions` sub-model
    - [x] Remove all top-level keys and `field_validator` legacy parsing
- [x] Task: Update `Product.validate_risk_details`
    - [x] Clean up any remaining fallback loops in `backend/app/models.py`
    - [x] Ensure it returns the correctly nested Pydantic output
- [x] Task: Conductor - User Manual Verification 'Phase 1: Validation & Schema Semantic Nesting' (Protocol in workflow.md)

## Phase 2: Rating Engine & Service Alignment
Update the business logic to work with the new nested risk details.

- [x] Task: Standardize `MotorPrivateRatingStrategy`
    - [x] Update it to pull `sum_insured` from `risk_details["vehicle"]["sum_insured"]`
    - [x] Update it to pull benefits from `risk_details["extensions"]`
- [x] Task: Refactor `PolicyService` for nested state
    - [x] Ensure `create_endorsement` diffing handles the nested structure correctly
- [x] Task: Conductor - User Manual Verification 'Phase 2: Rating Engine & Service Alignment' (Protocol in workflow.md)

## Phase 3: Migration & Database Finalization
Ensure data integrity and clean deployment.

- [x] Task: Cleanup migration data extraction
    - [x] Ensure `c5c580ca4b1f` migration initializes the nested structure if possible or defaults to empty
- [x] Task: Final System Verification
    - [x] Run E2E Playwright tests to ensure wizard flows work with nested backend structure
- [x] Task: Conductor - User Manual Verification 'Phase 3: Migration & Database Finalization' (Protocol in workflow.md)

## Phase 4: Robustness & Transactional Integrity
Address critical bugs in the pro-rata engine, atomicity violations, and tight coupling.

- [x] Task: Harden `PolicyService` logic
    - [x] Fix `calculate_diff` crash risk with explicit `None` checks
    - [x] Add `effective_date` parameter to `create_endorsement`
    - [x] Remove internal commits from `create_risk_note_with_invoice` to ensure atomicity
- [x] Task: Update API Routers for Transactional Integrity
    - [x] Update `policies.py` to handle session commits after service calls
    - [x] Expose `effective_date` in the endorsement endpoint
- [x] Task: Decouple `display_name` property
    - [x] Refactor `display_name` in `backend/app/models.py` to be more generic or product-aware
- [x] Task: Finalize Frontend Wizard
    - [x] Refactor `NewPolicyWizard.tsx` to use the blueprint-driven structure instead of hardcoded mapping
- [~] Task: Conductor - User Manual Verification 'Phase 4: Robustness & Transactional Integrity' (Protocol in workflow.md)
