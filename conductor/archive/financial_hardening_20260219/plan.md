# Implementation Plan: Financial Hardening & Rating Service Refinement

## Phase 1: Backend Core Hardening (Rating Service & Endorsement Logic) [checkpoint: 48e0abd]
This phase focuses on making the backend the single, robust source of truth for all financial calculations and ensuring endorsement audits are mathematically sound.

- [x] **Task: Implement Robust Numeric Parsing in Rating Service** [4b87e4c]
    - [x] Write failing tests in `backend/tests/test_rating_service.py` for `RatingService` handling currency strings (e.g., "1,500.00"), empty placeholders (`[ EMPTY ]`), and non-numeric characters.
    - [x] Implement regex-based parsing in `MotorPrivateRatingStrategy` and `RatingService`.
    - [x] Verify tests pass.
- [x] **Task: Implement Automated Tier Sorting** [1120272]
    - [x] Write failing tests for `MotorPrivateRatingStrategy` where provided `pricing_rules` tiers are out of order.
    - [x] Add sorting logic to `MotorPrivateRatingStrategy.calculate` before the tier lookup.
    - [x] Verify tests pass.
- [x] **Task: Implement Robust Endorsement Delta Logic** [17c15f2]
    - [x] Write failing integration tests in `backend/tests/test_transactional_service.py` that verify an endorsement's `financial_breakdown` JSON contains both `new_state` and `delta` objects.
    - [x] Update `PolicyService.create_endorsement` to calculate the full breakdown for the new state and explicitly derive the deltas.
    - [x] Ensure `net_premium`, `total_amount`, and `commission_amount` on the `RiskNote` match the calculated deltas.
    - [x] Verify tests pass.
- [x] **Task: Support Manual and Generic Pricing Strategies** [67f2287]
    - [x] Write failing tests for `MANUAL` pricing strategy and a generic fallback for products like "Fire" or "Personal Accident".
    - [x] Implement `ManualRatingStrategy` and update `RatingService._calculate_generic` to return a non-zero premium based on `pricing_rules` if available.
    - [x] Verify tests pass.
- [x] **Task: Conductor - User Manual Verification 'Backend Core Hardening' (Protocol in workflow.md)**

## Phase 2: Frontend & Model Refinement
This phase integrates the backend changes into the frontend and cleans up redundant logic to prevent future technical debt.

- [x] **Task: Cleanup Redundant Product Model Logic** [a28e47a]
    - [x] Identify and remove hardcoded logic in `backend/app/models.py` (`Product.calculate_premium`).
    - [x] Refactor `Product.calculate_premium` to delegate entirely to `RatingService`.
    - [x] Verify all existing tests pass.
- [x] **Task: Implement Unified Frontend Quote Hook** [3dc8541]
    - [x] Update `frontend/src/components/Insurance/Wizard/StepFinancials.tsx` to remove the `isMotorPrivate` restriction on the quote `useEffect`.
    - [x] Ensure the premium preview UI correctly maps to the generic `BaseFinancialBreakdown` when a motor-specific one isn't available.
    - [x] Verify that changing "Fire" or "PA" fields triggers a backend quote and updates the UI.
- [x] **Task: Fix Nested Path Lookup in `injectWizardData`** [d718bd9]
    - [x] Write failing unit tests in `frontend/src/utils/documentData.test.ts` for resolving nested paths like `VEHICLE DETAILS.Reg. No`.
    - [x] Update `injectWizardData` to support recursive dot-notation lookup in the `actualRoot` object.
    - [x] Verify tests pass.
- [x] **Task: Conductor - User Manual Verification 'Frontend & Model Refinement' (Protocol in workflow.md)**

## Phase 3: Final Verification & Audit
- [x] **Task: Comprehensive End-to-End Audit** [fe5e73d]
    - [x] Run a full "New Business" -> "Endorsement" flow for both a Motor and a Non-Motor product.
    - [x] Verify that the resulting Risk Notes and Invoices are mathematically consistent and the `financial_breakdown` JSONs are audit-ready.
- [ ] **Task: Conductor - User Manual Verification 'Final Verification & Audit' (Protocol in workflow.md)**
