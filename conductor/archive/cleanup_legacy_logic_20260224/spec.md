# Specification: Cleanup Convoluted Legacy Logic

## Overview
This track focuses on removing technical debt introduced during the transition to streamlined models. We will replace convoluted "best-effort" mapping logic with a **Strict Semantic Nesting** pattern. Each product class will have a dedicated, validated schema that organizes data into logical groups (e.g., `vehicle`, `extensions`) without supporting legacy key fallbacks.

## Functional Requirements
- **Validation Cleanup:** 
    - Remove all "best-effort" key mapping (e.g., mapping "Value Kshs." to "sum_insured").
    - Implement dedicated Pydantic models for each product class that enforce semantic nesting.
- **Policy Service Refactor:** 
    - Remove all references to `policy_snapshot` in `PolicyService`.
    - Ensure `create_policy` and `create_endorsement` logic works exclusively with the nested `risk_details` stored on the `Policy` object.
- **Rating Engine Standardization:** 
    - Standardize the `MotorPrivateRatingStrategy` to pull data from the `vehicle` and `extensions` sub-objects.
- **Migration Hardening:** Review the latest Alembic migrations to ensure they correctly initialize the new nested structures from available snapshot data.

## Non-Functional Requirements
- **Single Source of Truth:** Authoritative data must live on the primary model (e.g., `Policy.risk_details`), not in redundant snapshots.
- **Code Clarity:** Significant reduction in logic complexity in the Service and Model layers.
- **Data Integrity:** All financial calculations must maintain decimal precision without using legacy "float" conversions except for final JSON serialization.

## Acceptance Criteria
- [ ] `MotorPrivateRiskDetails` schema has no legacy aliases or validators for old keys.
- [ ] `Product.validate_risk_details` method is simplified to direct validation without key-mapping loops.
- [ ] `PolicyService` implementation has no `policy_snapshot` assignments or retrievals.
- [ ] `RatingService` logic only pulls from standardized top-level keys.
- [ ] All unit and integration tests pass using only the new flat data structures.

## Out of Scope
- Adding new insurance classes.
- Modifying the UI components (except where needed to align with schema changes).
