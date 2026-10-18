# Specification: Streamline New Policy Wizard

## Overview
The current "New Policy Wizard" is cumbersome, contains confusing copy, and includes an unnecessary step for editing standard insurance terms. This track will refactor the wizard to be more efficient, professional, and aligned with actual agency workflows where policy numbers are provided by the insurer and terms are non-negotiable at the point of entry.

## Functional Requirements
1.  **Refactor Wizard Steps:**
    *   **Step 1: Product & Policy Identity:** Combine product selection with a mandatory manual "Policy Number" field.
    *   **Step 2: Asset/Risk Details:** Capture only essential motor details (Registration Number, Make, Year of Manufacture).
    *   **Step 3: Financials & Period:** Capture Sum Insured and the Period of Cover (Start/End dates).
    *   **Step 4: Review & Issue:** Final summary and submission.
2.  **Remove Terms Step:** Completely remove the "StepTerms" component from the wizard flow. The backend should continue to use standard product terms automatically.
3.  **UI/UX Copy Overhaul:**
    *   Update all labels, placeholders, and descriptions to a "Professional & Minimal" tone.
    *   Ensure instructions are direct and airy, adhering to the project's visual identity.
4.  **Data Persistence:** Ensure the manually entered Policy Number is correctly passed to the backend `PoliciesService.createPolicy` call.

## Non-Functional Requirements
1.  **Consistency:** Use existing Shadcn/UI and Tailwind CSS v4 patterns.
2.  **Type Safety:** Maintain strict TypeScript types for the wizard state.

## Acceptance Criteria
1.  A user can select a product and enter a custom policy number in the first step.
2.  The "Terms" step is no longer part of the wizard sequence.
3.  The wizard captures all "Core Fields" (Motor Details, Sum Insured, Period) successfully.
4.  The final "Issue" action creates a policy with the correct manual policy number.
5.  All UI text follows the refined "Professional & Minimal" tone.

## Out of Scope
1.  Modifying the backend `Policy` or `RiskNote` data models (beyond ensuring they accept the passed data).
2.  Implementing bulk policy uploads.
