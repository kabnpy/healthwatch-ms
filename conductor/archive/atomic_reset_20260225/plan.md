# Implementation Plan: Atomic Reset (Structural Simplification)

This plan implements the "Atomic Snapshot" architecture, simplifying the Policy/RiskNote relationship and moving document terms to text-based fields.

## Phase 1: Database & Model Refactoring
Focus: Strip Policy metadata and enhance RiskNote for full snapshots.

- [x] Task: Write tests for new `Policy`, `RiskNote`, and `Product` model structures.
- [x] Task: Update `backend/app/models.py` to remove `risk_details` from `Policy` and enhance `RiskNote`. 808bd81
- [x] Task: Create and apply a "Clean Slate" Alembic migration for the new schema. (Verified DB matches models)
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Service Layer & Business Logic
Focus: Implement atomic creation/endorsement and text-based terms logic.

- [x] Task: Write tests for `PolicyService` atomic snapshot creation and endorsement. bfe3a83
- [x] Task: Refactor `backend/app/services/policy.py` to remove diffing logic and use full snapshots. bfe3a83
- [x] Task: Update `RatingService` to handle the revised `cover_snapshot` structure. d650186
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) [checkpoint: 027e91b]

## Phase 3: API & Public Schemas
Focus: Expose the "Current State" (active note) via the Policy API.

- [x] Task: Write tests for `PolicyPublic` schema with the `active_note` field.
- [x] Task: Update `backend/app/schemas.py` and API utilities to populate `active_note`. 2165fdf
- [x] Task: Verify `/policies/{id}` endpoint returns the correct atomic snapshot. d536fe9
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md) [checkpoint: d536fe9]

## Phase 4: Frontend UI & Experience
Focus: Align the UI wizard and history view with the new atomic model.

- [x] Task: Update Frontend TypeScript types and regenerate the API client. 66b1235
- [x] Task: Refactor the New Policy Wizard to support text-based Terms and the new snapshot structure. 8ef2eb2
- [x] Task: Implement the "Version History" view on the Policy detail page. 142c5d0
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md) [checkpoint: 142c5d0]

## Phase 5: Architectural Hardening & Bug Fixes
Focus: Resolve critical API errors, improve document numbering, and clean up technical debt.

- [x] Task: Fix `PolicyCreateExtended` schema mismatch and `AttributeError` in routes. 089f258
- [x] Task: Harden document ID generation (Invoices/Risk Notes) to prevent collisions. 089f258
- [x] Task: Move decimal parsing to a shared utility to remove delegation duplication. 089f258
- [x] Task: Update `.gitignore` to exclude `backend.log`. 089f258

## Phase 6: Quality Polish & Strategy Registry
Focus: Refactor rating dispatch, deduplicate imports, and move document numbering to constants.

- [ ] Task: Deduplicate imports in `app/utils.py`.
- [ ] Task: Move document prefixes ("INV-", "RN-") to constants in `PolicyService`.
- [ ] Task: Implement a `StrategyRegistry` in `RatingService` to remove brittle string checks.
- [ ] Task: Move Policy Number generation from Frontend to `PolicyService` (Backend).
