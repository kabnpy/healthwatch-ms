# UI Refinement Strategy - Policy & Client Views

## Goal
Improve readability and consistency across the Policy and Client management modules.

## 1. Human-Readable Policy Titles
**Task:** Replace raw policy numbers with descriptive titles like "Motor Private - KDF 334K" or "MAXPAC - Personal Accident".

### Plan:
- [ ] **Backend:** Update `PolicyPublic` schema to include `product` details (name and class) and `items` (specifically the first item's identifier).
- [ ] **Backend:** Add a computed property or utility to generate the `display_name` on the Policy model/schema.
- [ ] **Frontend:** Update `PolicyTable` (`columns.tsx`) to use the new `display_name`.
- [ ] **Frontend:** Update the Policy Dashboard header to show the human-readable title.

## 2. Standardized Status Indicators
**Task:** Use the "Admin Page" style for "Active" status indicators everywhere.

### Plan:
- [ ] **Frontend:** Extract the Admin status indicator into a reusable `StatusBadge` or `ActiveIndicator` component in `frontend/src/components/Common/`.
- [ ] **Frontend:** Update `Admin` columns to use the new component.
- [ ] **Frontend:** Update `PolicyTable` columns to use the new component.
- [ ] **Frontend:** Update Policy View/Dashboard to use the new component.

## 3. Client Table Refinement
**Task:** Reconsider and improve the details shown on the client table.

### Plan:
- [ ] **Analysis:** Current columns: Name, KRA PIN, Email, Phone, Type.
- [ ] **Improvement:**
    - Add "Contact Person" column (especially for Corporate).
    - Use badges for "Individual" vs "Corporate" types.
    - (Optional) Add "Active Policies" count.
- [ ] **Implementation:** Update `frontend/src/components/Clients/columns.tsx`.

## Progress Tracking
- **Phase 1: Status Indicators** [x]
    - Created `StatusIndicator` component.
    - Updated Admin table.
    - Updated Policy table.
    - Updated Policy header.
- **Phase 2: Policy Titles** [x]
    - Updated `PolicyPublic` schema with `display_name` and relationships.
    - Updated CRUD to include `product` and `items`.
    - Regenerated frontend client.
    - Updated Policy table and header to use `display_name`.
- **Phase 3: Client Table** [x]
    - Added Contact Person column.
    - Added Badge for Client Type.
- **Phase 4: Verification** [x]
    - Backend tests passing (77 passed).
    - UI components updated and standardized.
