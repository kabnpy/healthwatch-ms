# Track Specification: Financial Hardening & Rating Service Refinement

## 1. Overview
This track addresses critical architectural inconsistencies and functional regressions identified during the code review of the initial Rating Service implementation. The goal is to restore system integrity, ensure mathematical accuracy for endorsements, and establish the Backend as the single authoritative source of truth for all premium calculations.

## 2. Functional Requirements

### 2.1 Authoritative Rating Service
- **Robust Parsing:** Implement regex-based numeric parsing in `RatingService` to handle currency formatting and placeholders (e.g., `[ EMPTY ]`) safely.
- **Tier Integrity:** Ensure pricing tiers are automatically sorted by `max` value before lookup to prevent incorrect rate applications.
- **Unified Strategy Fallback:** Replace the zero-premium generic fallback with a functional default that calculates premiums based on the product's `pricing_rules`.
- **Manual Pricing Support:** Implement the `MANUAL` pricing strategy logic to allow user-defined premiums.

### 2.2 Accurate Endorsement Accounting (Robust Delta Logic)
- **Single Transaction Truth:** Update the `RiskNote` creation logic to store BOTH the full new state AND a structured "Delta" breakdown within the `financial_breakdown` JSON.
- **Audit Consistency:** Ensure that the `net_premium`, `total_amount`, and `commission_amount` fields for an endorsement perfectly align with the delta values in the breakdown.

### 2.3 Unified Frontend Quote Integration
- **Global Backend Quotes:** Modify the `StepFinancials` component to trigger a backend quote for ALL product types, not just Motor Private.
- **Dynamic Pricing UI:** Ensure the premium preview remains responsive and accurately reflects backend calculations for all product classes.

## 3. Non-Functional Requirements
- **Data Integrity:** All financial calculations must utilize Python's `Decimal` type with fixed-point arithmetic.
- **Architectural Rigor:** Eliminate redundant calculation logic in the `Product` model; all math must flow through the `RatingService`.

## 4. Acceptance Criteria
1. **Endorsement Auditability:** An endorsement transaction's `financial_breakdown` must clearly separate "New State" from "Transaction Delta."
2. **Global Pricing:** All product types (Motor, Fire, PA, Manual) must return a non-zero, valid premium via the `/quote` endpoint.
3. **Robust Input:** The `/quote` endpoint must not crash when receiving formatted currency strings (e.g., "1,500.00") or empty placeholders.
4. **Nested Path Lookup:** The `injectWizardData` utility in the frontend must correctly resolve nested paths (e.g., `VEHICLE DETAILS.Reg. No`).

## 5. Out of Scope
- Implementation of new insurance products beyond the existing categories.
- Redesign of the frontend wizard layout.
