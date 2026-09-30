# Search Strategy & Document Pattern Refinement

## 1. Search Strategy
As the volume of data grows, "browse-only" navigation is insufficient.

### Tier 1: Global Discovery (Command Palette)
- **Component:** `frontend/src/components/Common/CommandMenu.tsx` (using Shadcn `Command` component).
- **Triggers:** `Ctrl + K` or a search button in the `Header`.
- **Sources:**
    - **Clients:** Search by Name or KRA PIN.
    - **Policies:** Search by Policy Number.
- **Navigation:** Selecting a result jumps directly to the Hub (`/clients/$id/overview` or `/policies/$id`).

### Tier 2: In-Context Filtering (Data Tables)
- **Component:** Enhance `frontend/src/components/Common/DataTable.tsx`.
- **Feature:** Add a standard text filter in the header of every table.
- **Scope:** Client List, Policy List, Invoice List.

## 2. Document Pattern Refinement
Ensuring "Risk Notes" and "Invoices" follow the established UI standards.

### Table Standardization
- **Action:** Refactor `frontend/src/components/RiskNotes/columns.tsx`.
- **Change:**
    - Make `Risk Note #` a clickable link (triggers the viewer).
    - Remove "View" button.
    - Add "Three-dot" menu for "Download PDF", "Copy ID", "Email to Client".

### Template Visuals
- **Action:** Ensure `DebitNoteTemplate.tsx` and `CertificateTemplate.tsx` use consistent typography and spacing defined in `BaseDocument.tsx`.
- **Action:** Evaluate using `SummaryCard` style blocks within the document for "Key Totals" to bridge the gap between "Web UI" and "Professional PDF".

## 3. Stepwise Implementation Plan

### Phase 1: Clean Tables (The Polish)
- [x] Refactor `RiskNotes/columns.tsx` to established "Clean Table" pattern.
- [x] Ensure "Invoices" view in Client Hub uses this standardized column definition.

### Phase 2: DataTable Search
- [x] Add search input to `DataTable.tsx` using TanStack Table's global filtering or column filtering.

### Phase 3: Global Command Palette
- [x] Install Shadcn `Command` component.
- [x] Implement `CommandMenu.tsx`.
- [x] Register in `Header.tsx`.

## 4. Progress Tracking
- **[2026-01-28]:** Strategy created and fully implemented.
