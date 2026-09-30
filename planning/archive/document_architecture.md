# Document System Architecture & Reorganization Strategy

## 1. Core Philosophy
- **Separation of Concerns:** Each document type (Debit Note, Certificate, Risk Note) will have its own dedicated template file.
- **Contextual Placement:** Documents will live where they are most relevant (e.g., Financials under Clients, Coverage under Policies).
- **Granular Linking:** System-generated documents will maintain strict metadata linking them to both the Client and the specific Policy.

## 2. Structural Decoupling
Currently, `RiskNoteDocument.tsx` is a monolithic file handling multiple modes. We will move to a registry-based approach.

### Goals:
- **[ ] Extract Templates:** Create `frontend/src/components/Documents/templates/`
    - `DebitNoteTemplate.tsx`: Solely focused on financial billing.
    - `CertificateTemplate.tsx`: Focused on proof of coverage.
    - `RiskNoteSummaryTemplate.tsx`: Internal/Agent view of the transaction.
- **[ ] Unified Viewer:** Refactor `DocumentViewerModal.tsx` to accept a `DocumentType` and `id`, dynamically resolving the correct template.

## 3. Contextual Reorganization (UX)
We will move away from the "One-size-fits-all" Documents tab.

### Policy View (`/policies/$policyId`)
- **Focus:** Coverage and Risk.
- **Content:**
    - **Risk Notes:** Historically linked transactions for this specific policy.
    - **Certificates:** Current valid proof of insurance.
    - **Policy-Specific Docs:** E.g., Logbooks for Motor, Valuation reports.

### Client View (`/clients/$clientId`)
- **Focus:** Financial Relationship and KYC.
- **Content:**
    - **Invoices (Debit Notes):** Aggregated financial view of all amounts owed across all policies.
    - **KYC Documents:** KRA PIN, ID Scans, Incorporation certificates.
    - **Correspondences:** Letters and emails.

## 4. Implementation Roadmap

### Phase 1: Modularization (Code Level)
1. Split `RiskNoteDocument.tsx` into atomic components.
2. Create a `BaseDocument` wrapper to handle common branding (Header/Footer/Print Styles).

### Phase 2: Navigation Refinement (Route Level)
1. Add a `Financials` tab to the Client Hub.
2. Ensure the `Policies` tab in Client Hub links deeply into the specific Policy's coverage documents.

### Phase 3: Smart Linking (Data Level)
1. Implement a "Related Views" sidebar in the Document Viewer.
   - *Example:* When viewing an Invoice, show a link to the "Policy Details" and "Client Statement".

## 5. File Structure Changes
```text
frontend/src/components/Documents/
├── BaseDocument.tsx        # Common layout/branding
├── DocumentRegistry.tsx    # Maps types to templates
└── templates/
    ├── DebitNote.tsx       # Invoice structure
    ├── Certificate.tsx     # Coverage structure
    └── RiskNote.tsx        # Transaction summary
```
