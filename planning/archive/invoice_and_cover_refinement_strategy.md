# Strategy: Invoice Generation & Cover Display Refinement

## Context
Currently, the system automatically aggregates all new `RiskNotes` (policies) into a single "Unpaid" invoice for a client. While convenient, this lacks flexibility when a client requires separate invoices for different policies (e.g., different cost centers or internal accounts).

Additionally, the display name for covers (specifically Motor Private) is generic (e.g., "Motor Private"), making it difficult to distinguish between multiple vehicles at a glance.

## Goals
1.  **Decouple Invoice Aggregation:** Stop automatically merging new Risk Notes into existing unpaid invoices. Each new Risk Note should generate its own distinct Invoice (or Draft Invoice) by default.
2.  **Improve Cover Visibility:** specific "Motor Private" policies should display as "Motor Private - [Registration Number]" in lists and headers.

---

## Part 1: Invoice Generation Wizard

### The Problem
Automatic invoice generation (even 1:1) removes user control. Users often need to group specific policies together or split them based on internal accounting requirements.

### The Solution
Implement an **Invoice Generation Wizard**.
- Stop automatic creation of Invoices when a Risk Note is created.
- Risk Notes remain in a "Pending Invoicing" state until a user explicitly selects them for an invoice.
- The Wizard allows selecting multiple Risk Notes for a single invoice and setting an explicit "Invoice Date".
- This wizard can be repurposed to add/remove items from existing unpaid invoices.

### Implementation Plan
1.  **Backend Changes**:
    *   **Modify `create_risk_note`**: Remove the auto-invoicing logic entirely.
    *   **New CRUD/API**: Implement a "Bulk Invoice Create" endpoint that takes a list of `risk_note_ids`.
    *   **Uninvoiced Query**: Add a helper to fetch Risk Notes for a client that are not yet linked to any `InvoiceLineItem`.

2.  **Frontend Changes**:
    *   **New Component**: `InvoiceWizard.tsx`.
    *   **UI Integration**: Add a "Generate Invoice" button in the Client's Invoice tab.
    *   **Workflow**:
        1. Open Wizard -> Show list of "Pending Risk Notes".
        2. User selects one or more -> Reviews totals.
        3. User clicks "Generate" -> Backend creates Invoice + Line Items.

---

## Part 2: Cover Display Name Refinement

### The Problem
Users see a list of "Motor Private" policies and cannot distinguish them without clicking into details.

### The Solution
Update the UI (and potentially the backend response) to dynamically format the display name based on the policy content.

### Implementation Plan
1.  **Frontend Utility**:
    *   Create a helper function `getPolicyDisplayName(riskNote: RiskNotePublic): string`.
    *   Logic:
        *   If `class_of_insurance` (or `product_name`) is "Motor Private":
            *   Extract `reg_no` from `policy_snapshot` or `risk_details` (specifically looking in the "VEHICLE DETAILS" section).
            *   Return "Motor Private - [Reg No]".
        *   Else: Return the generic Product Name.

2.  **UI Updates**:
    *   **Policy List / Client Hub**: Update columns to use `getPolicyDisplayName`.
    *   **Coverage Card**: Update the card title.
    *   **Wizard / Headers**: Update top-level headers to reflect the specific asset.

3.  **Data Structure Analysis**:
    *   Target Data Path: `riskNote.policy_snapshot.risk_details["VEHICLE DETAILS"]["reg_no"]` (Based on codebase search).

---

## Execution Steps (Atomic)
1.  **Backend: Cleanup `create_risk_note`**: Remove auto-invoice logic.
2.  **Backend: Bulk Invoice API**: Create endpoint to generate an invoice from multiple Risk Note IDs.
3.  **Frontend: Display Name Helper**: Implement `getPolicyDisplayName`.
4.  **Frontend: Pending Risk Notes List**: Add a way to view uninvoiced Risk Notes.
5.  **Frontend: Invoice Wizard**: Implement the modal/wizard to select items and create invoice.
6.  **Apply Display Name**: Update UI across the app.

---

## Part 3: Unify Document Data Capture & Storage (Completed)
- Successfully integrated `injectWizardData` into `NewPolicyWizard.tsx`.
- Data is now structured according to the product blueprint before saving.
- This ensures registration numbers and other details are nested correctly (e.g., inside "VEHICLE DETAILS").

## Part 4: Rendering Fidelity & Type Safety (Completed)
- **Resolved `[object Object]` bugs**: Updated `RiskNoteTable.tsx` and `StepReview.tsx` to recursively render nested objects and handle React elements (JSX) without string conversion.
- **Improved Type Safety**:
    - Created `frontend/src/types/insurance.ts` with `EnhancedPolicy`, `EnhancedRiskNote`, and `RiskNoteSection` types.
    - Replaced generic `any` with specific interfaces in `RiskNoteTemplate`, `StepFinancials`, and `NewPolicyWizard`.
- **Robust Display Names**: Refined `getPolicyDisplayName` and backend `display_name` with a recursive search algorithm to find registration numbers regardless of nesting level.

## Future Considerations
- **Merge Invoices**: Allow users to manually combine multiple draft/unpaid invoices into one if they *do* want a single bill.
- **Other Classes**: Extend the display name logic to Property (Plot No), Medical (Member No), etc.
