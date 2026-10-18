# Implementation Plan: Decouple Risk Note and Invoice Creation

## Phase 1: Backend Service Refactoring (Decoupling) [checkpoint: 77bf7ab]
- [x] Task: Write tests for `PolicyService` to verify Risk Note creation without Invoices. 55aebe2
- [x] Task: Refactor `PolicyService.create_policy` and `create_endorsement` to remove automatic invoice generation. 04ec18a
- [x] Task: Rename `create_risk_note_with_invoice` to `create_risk_note` and remove internal invoice creation logic. 04ec18a
- [x] Task: Conductor - User Manual Verification 'Backend Decoupling' (Protocol in workflow.md) 77bf7ab

## Phase 2: Data Model & Authoritative Link [checkpoint: 97b2eed]
- [x] Task: Create a database migration to remove/deprecate the `invoice_number` field from the `risknote` table. 65646b4
- [x] Task: Update the `RiskNote` SQLModel to remove the `invoice_number` field. 3fbe897
- [x] Task: Implement a backend utility or service method to fetch "un-invoiced" Risk Notes (filtering by those without `InvoiceLineItem`). 3fbe897
- [x] Task: Write tests for the "un-invoiced" detection logic. 9f50d28
- [x] Task: Conductor - User Manual Verification 'Data Model & Linking' (Protocol in workflow.md) 97b2eed

## Phase 3: Frontend & Wizard Integration [checkpoint: 7ba432c]
- [x] Task: Update the `InvoiceWizard` component to fetch and display only un-invoiced Risk Notes. 7ba432c
- [x] Task: Update the Risk Note detail view to retrieve the associated Invoice via the `invoice_line_items` relationship instead of `invoice_number`. 7ba432c
- [x] Task: Verify consolidated invoice generation works correctly with the refactored backend logic. 7ba432c
- [x] Task: Conductor - User Manual Verification 'Frontend Integration' (Protocol in workflow.md) 7ba432c
