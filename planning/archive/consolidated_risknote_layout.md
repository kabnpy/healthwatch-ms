# Strategy: Consolidated Boxy Risk Note Layout

## Goal
Implement a strictly uniform, two-column "Boxy" layout for the Risk Note. Every section of the document will be a single row in a master table, with the section header in the left column and all data (nested tables or lists) in the right column.

## 1. Architectural Approach
- **Strict 2-Column Master Table**:
    - **Column 1 (Left)**: Semantic row header (`<th scope="row">`) containing the Section Name (e.g., INSURED, CLASS, VEHICLE DETAILS). Fixed width (~20-25%).
    - **Column 2 (Right)**: Content cell (`<td>`) containing the actual data.
- **Nested Content Rendering**:
    - If the section has sub-fields (like Vehicle Details), render them as a **borderless sub-table** inside the right cell.
    - If the section is a list (like Clauses), render as a **bulleted list**.
    - If the section is a block of text (like Cover), render as **plain text**.
- **Visual Style**: Heavy solid black borders (`border-black`) to match the legacy professional look. No internal vertical borders in the right-side sub-tables to keep it clean.

## 2. Measurable Steps

### Phase 1: Unified Row-Header Component
- [x] **Step 1.1**: Refactor `RiskNoteTable.tsx` to enforce the `<tr><th>{Name}</th><td>{Content}</td></tr>` structure.
- [x] **Step 1.2**: Implement a `NestedFieldTable` helper for the right-side cell that renders sub-key-value pairs without adding outer borders.
- [x] **Step 1.3**: Ensure labels in the left column are vertically centered and styled with `bg-slate-50`.

### Phase 2: Template Data Re-Aggregation
- [x] **Step 2.1**: Update `RiskNoteTemplate.tsx` to group all information into top-level logical blocks (INSURED, CLASS, PERIOD, COVER, etc.).
- [x] **Step 2.2**: Pass raw data objects to `RiskNoteTable` rather than JSX to avoid "Object Description" rendering bugs.

### Phase 3: Layout Refinement
- [x] **Step 3.1**: Match padding and typography precisely to `risk_note_layout.txt`.
- [x] **Step 3.2**: Implement print-safe "Zebra" striping for sub-tables to aid horizontal eye-tracking.

### Phase 4: Build & Verification
- [ ] **Step 4.1**: Fix any TypeScript regressions in `SchemaBuilder.tsx`.
- [ ] **Step 4.2**: Verify that all fields (captured vs. static) appear in the correct boxes.
- [ ] **Step 4.3**: Clean `npm run build`.

---

## 3. Visual Reference (Target)
```text
+-----------------+--------------------------------------------+
| INSURED         | Name: John Doe                             |
|                 | PIN: A1234567B                             |
+-----------------+--------------------------------------------+
| CLASS           | Motor Private [Policy No: 001/2024]        |
+-----------------+--------------------------------------------+
| VEHICLE DETAILS | Reg: KCA 123 | Make: Mazda | Year: 2020    |
+-----------------+--------------------------------------------+
```
