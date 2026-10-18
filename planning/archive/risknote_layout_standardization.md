# Strategy: Risk Note Layout Standardization

## Context
The current Risk Note layout has several visual and structural inconsistencies:
1.  **Font Uniformity**: Different sections use varying font sizes and weights.
2.  **Section Nesting**: "VEHICLE DETAILS" (and potentially other structured data) are leaking into individual rows instead of being contained within their parent section.
3.  **Insurer Display**: Contains unnecessary metadata instead of just the clean Insurer Name.
4.  **Styling**: Background colors in rows and headers (e.g., `bg-slate-50`) reduce the "clean paper" look of the document.

## Goals
1.  **Standardize Fonts**: Apply a consistent `text-[11px]` or `text-xs` across all table content.
2.  **Fix Section Nesting**: Ensure structured objects in `risk_details` are rendered as sub-tables within a single section row.
3.  **Clean Insurer Row**: Strip verified badges/metadata from the Insurer section.
4.  **Minimalist Styling**: Remove all background fills from table cells and headers.

---

## Execution Steps (Atomic & Measurable)

### Step 1: Styling & Font Cleanup (Completed)
- **Target**: `RiskNoteTable.tsx` and `RiskNoteTemplate.tsx`.
- **Action**:
    - Removed `bg-slate-50` from `<th>` and `bg-white` from `<td>`.
    - Unified font sizes to `text-[11px]` for all labels and values.
    - Set consistent `font-medium` for data values.

### Step 2: Insurer Row Refinement (Completed)
- **Target**: `RiskNoteTemplate.tsx`.
- **Action**: Simplified the "INSURER" section content to only return the insurer's name string.

### Step 3: Structured Data Consolidation (Vehicle Details) (Completed)
- **Target**: `RiskNoteTemplate.tsx` (Data Consolidation Logic).
- **Action**:
    - Refined the logic that merges `template` and `instance` data.
    - Ensured that if a key in `risk_details` exists in the `template`, it updates the template's value.
    - Verified "VEHICLE DETAILS" section is correctly identified and populated.

### Step 4: Recursive Rendering Fix (Completed)
- **Target**: `RiskNoteTable.tsx`.
- **Action**: Ensured that structured objects are rendered as sub-tables *inside* the main section row, maintaining the 2-column master layout.

---

## Verification Plan
1.  **Visual Check**: Open a Risk Note. All text should be the same size. No grey background in the left column.
2.  **Structural Check**: "VEHICLE DETAILS" should be a single row on the left, with Reg No, Make, etc. grouped on the right.
3.  **Insurer Check**: Only the name should be visible.
