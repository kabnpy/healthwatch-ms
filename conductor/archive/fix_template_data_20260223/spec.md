# Specification: Fix Risk Note & Invoice Template Data

## 1. Overview
This track addresses data inconsistencies found in the Risk Note and Invoice templates. Currently, financial breakdowns and premium data are not appearing correctly on these documents. We will investigate and fix the full data lifecycle—from initial calculation and persistence during policy creation to retrieval and rendering in the document templates—focusing on Motor Private policies.

## 2. Functional Requirements

### 2.1 Backend: Data Persistence Hardening
- **Audit `PolicyService`:** Ensure `create_policy` correctly captures the output from the `RatingService` and stores it in the `RiskNote.financial_breakdown` and related `Invoice` records.
- **Financial Breakdown Schema:** Standardize the JSON structure for financial snapshots to ensure it includes all required line items (Net Premium, Training Levy, PHCF, Stamp Duty, Commissions) in a format the frontend can easily consume.
- **Product Class Cleanup:** Temporarily disable/hide product classes other than "Motor Private" in the system to prevent the creation of policies using untested rating logic.

### 2.2 Frontend: Template Binding
- **`RiskNoteTemplate` & `InvoiceTemplate`:** Refactor these components to bind directly to the authoritative `financial_breakdown` object from the backend.
- **Single Source of Truth:** Ensure templates do not perform any local calculation; they must strictly display the data persisted at the time of issuance.

## 3. Non-Functional Requirements
- **Financial Precision:** Use Python `Decimal` for all backend calculations to eliminate rounding errors.
- **Auditability:** Every document must reflect the "frozen" state of the financials at the time of transaction.

## 4. Acceptance Criteria
- [ ] Risk Note and Invoice templates display accurate financial data for newly created Motor Private policies.
- [ ] The "Review" step in the wizard matches the generated document data exactly.
- [ ] Other product classes (e.g., Fire, Medical) are hidden from the New Policy Wizard.
- [ ] Mock data seeding reflects these data integrity improvements.

## 5. Out of Scope
- Visual redesign of the PDF/HTML templates.
- Implementing rating logic for non-motor product classes.
