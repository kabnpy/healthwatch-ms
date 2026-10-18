# Document & Payment System Strategy (Refined)

## 1. Core Philosophy: Unified Viewing, Decoupled Logic
- **Generic Document Viewer:** Every document (Risk Note, Invoice, Receipt) must use the same viewer interface. The viewer should not know about "modes" like switching between a Risk Note and an Invoice.
- **Strict Decoupling:** Risk Notes (underwriting) and Invoices (financials) are separate entities. A Risk Note describes a transaction; an Invoice requests payment for one or more transactions.
- **Record Accuracy:** Certificates are removed from the system as they are not part of the official records.

## 2. Document Definitions
- **Risk Note:** A summary of an underwriting action (New Business, Renewal, Endorsement). Lives under **Policies**.
- **Invoice (Debit Note):** A request for payment. Lives under **Clients**. It aggregates pending balances from Risk Notes.
- **Receipt:** A record of a payment made by a client. lives under **Financials**.

## 3. Component Architecture
### `DocumentViewer.tsx` (formerly `RiskNoteDocument.tsx`)
- A stateless container that takes a `documentType` and `data`.
- Uses a registry to render the correct template.
- **Templates:**
    - `RiskNoteTemplate.tsx`
    - `InvoiceTemplate.tsx`
    - `ReceiptTemplate.tsx`

## 4. Backend Model Rework
We need to align the models with the actual business flow:
1. **Flow:** Policy Renewed -> `RiskNote` created -> `Invoice` created/updated with the pending amount.
2. **Current `Payment` Model:** Currently acts like a Receipt.
3. **Proposed Change:**
    - Rename/Refactor existing `Payment` to `Receipt`.
    - Introduce `Invoice` model to track "Money Owed".
    - `Invoice` contains line items linking to `RiskNote` IDs.

## 5. Implementation Roadmap

### Phase 1: Viewer Refactoring & Cleanup
- [x] Rename `RiskNoteDocument.tsx` to `DocumentViewer.tsx`.
- [x] Remove `CertificateTemplate.tsx` and all references to "Certificate" mode.
- [x] Ensure the viewer is "one-way": it displays what it is told to display, no toggles.

### Phase 2: Backend Financial Alignment
- [x] Review and refactor `backend/app/models/insurance/payment.py` to `financial.py`.
- [x] Introduce `Invoice` and `Receipt` models.
- [x] Update `RiskNote` creation logic to trigger automatic Invoice generation/update.
- [x] Sync frontend client and update hooks/components.

### Phase 3: Financials View
- [ ] Create a dedicated "Payments & Invoicing" view.
- [ ] Support archival of physical documents (Cheques, Bank Slips) via `DocumentManager`.

## 6. Progress Tracking
- **[2026-01-28]:** Strategy refined. Removing Certificates and refactoring to Universal Viewer.
