# Specification: Decouple Risk Note and Invoice Creation

## Overview
Currently, the system automatically generates an invoice whenever a Risk Note is issued. This coupling prevents flexible billing. This track will decouple these entities, ensuring they are only related via `InvoiceLineItem`, and make invoice generation an explicit action via the `InvoiceWizard`.

## Functional Requirements
1. **Refactor Backend Service**: Modify `PolicyService` to remove automatic `Invoice` and `InvoiceLineItem` creation during the risk note issuance process.
2. **Data Model Cleanup**: Remove (or stop using) the redundant `invoice_number` field on the `RiskNote` model. The authoritative link between a Risk Note and an Invoice must be the `InvoiceLineItem`.
3. **Identification of Un-invoiced Risk Notes**: Update logic to identify Risk Notes that are NOT associated with any `InvoiceLineItem`. These are the "un-invoiced" notes.
4. **Manual Invoicing Workflow**:
    - Users can select one or more "Issued" but un-invoiced Risk Notes.
    - Users trigger the `InvoiceWizard` to generate a single consolidated Invoice for the selected notes.
5. **Finalized Invoices**: Invoices generated via this workflow should be created with a 'Finalized' status (e.g., 'Unpaid' but not 'Draft' if the system supports it).

## Non-Functional Requirements
1. **Relational Integrity**: Ensure a Risk Note can only be linked to a single "Active" invoice via line items.
2. **Performance**: Efficiently query for un-invoiced Risk Notes for a client.

## Acceptance Criteria
1. Creating a new policy or endorsement results in a Risk Note but NO Invoice or InvoiceLineItem.
2. The `InvoiceWizard` displays only those Risk Notes that have no existing `InvoiceLineItem`.
3. Generating an invoice successfully creates the `Invoice` and the corresponding `InvoiceLineItem` records linking back to the Risk Notes.
4. The Risk Note detail view correctly displays its associated invoice by traversing the line items.

## Out of Scope
1. Changing the structure of `InvoiceLineItem` itself.
2. Adding automatic scheduling for invoice generation.
