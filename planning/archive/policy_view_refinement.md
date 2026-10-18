# Policy View Refinement Strategy - "Digital File" Model

## Objective
Transform the Policy Overview into a digital representation of a physical "Risk Note" file, aligning with real-world underwriting workflows and removing dashboard redundancy.

## 1. The "Digital File" Concept
The Overview tab will move away from generic "Dashboard Cards" and instead present the **Latest Risk Note** as a structured, professional document.

### Information Hierarchy:
- **Document Header:** Invoice #, Dates, Transaction Type.
- **Section A:** Insured Details (Name, PIN, Address).
- **Section B:** Risk Schedule (Asset specs, Sum Insured).
- **Section C:** Limits & Benefits (Scope of cover).
- **Section D:** Financials (Premiums, Levies, Total).

## 2. Component Strategy
- **`RiskNoteTemplate`**: Refactor to be the primary view. It must look professional on-screen but remain responsive.
- **Sidebar (Secondary):** A small sidebar for non-frozen, live metrics:
    - **Live Balance:** Current outstanding amount for the policy.
    - **Expiry Tracker:** Visual countdown to policy end date.

## 3. Implementation Plan
- [ ] **Phase 1: Component Refinement**
    - Ensure `RiskNoteTemplate` is robust and handles null states gracefully.
- [ ] **Phase 2: Overview Tab Overhaul**
    - Replace the grid in `policies.$policyId.tsx`.
    - Center the "Digital Risk Note" in the main column.
    - Add the "Live Data" sidebar.
- [ ] **Phase 3: Interactivity**
    - Add quick-edit triggers within the document sections where applicable.

## Progress
- [x] Strategy updated to "Digital File" model.
- [ ] RiskNoteTemplate refactored.
- [ ] Layout updated.
