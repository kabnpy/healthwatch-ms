# Risk Note Refinement & Data Seeding Strategy

## 1. Objective
Refine the Risk Note generation to support class-specific layouts (Motor Private, Personal Accident, Domestic Package) based on real-world examples in `planning/risk_note_layout.txt`. This includes updating the data catalog (Insurers/Products) and the frontend template logic.

## 2. Granular Data Strategy (Aggregated via Form Schema)

### A. Catalog Update (Seeding)
We will update `backend/app/seed_mock_data.py` to include real-world products. Each product's `form_schema` will now include a `category` field to allow the UI to "aggregate" (group) data into logical tables.

**Categories to be used:**
- `VEHICLE DETAILS` (Motor)
- `LOCATION` (Domestic)
- `BENEFITS & LIMITS` (General)
- `EXCESS` (Motor/Domestic)
- `LIABILITIES` (Domestic)

### B. RiskItem Snapshot Structure
The `items_snapshot` in `RiskNote` will continue to store the raw key-value pairs from the form. The UI will use the `Product.form_schema` to map these keys to their respective labels and categories for rendering.

## 3. Frontend Component Strategy

### A. Dynamic Section Rendering
Instead of multiple hardcoded sub-templates, we will use a **Dynamic Section Renderer** within `RiskNoteTemplate.tsx`.

1. **Group Data**: Filter `form_schema` to find fields present in `items_snapshot`.
2. **Aggregate**: Group these fields by their `category`.
3. **Render**:
    - Categories like `VEHICLE DETAILS` or `LOCATION` will render as a horizontal grid/table.
    - Categories like `BENEFITS` or `EXCESS` will render as a vertical list/table of key-value pairs.

### B. Logic Flow
1. `DocumentViewer` loads `RiskNote`.
2. `RiskNoteTemplate` renders the shared Header.
3. `RiskNoteTemplate` executes the "Aggregation Logic":
   ```typescript
   const aggregated = product.form_schema.reduce((acc, field) => {
     if (snapshot[field.key]) {
       const cat = field.category || 'General';
       acc[cat] = acc[cat] || [];
       acc[cat].push({ label: field.label, value: snapshot[field.key] });
     }
     return acc;
   }, {});
   ```
4. Render each group as a styled section in the Risk Note body.

## 4. Testable Milestones

| Task | Description | Verification |
| :--- | :--- | :--- |
| **Seeding** | Update `seed_mock_data.py` with Old Mutual and the 3 new products. | Run `uv run python -m app.seed_mock_data` and check DB. |
| **PA Template** | Implement PA-specific table for benefits and exclusions. | View a PA Risk Note in browser. |
| **Motor Template** | Implement Motor-specific vehicle grid and excess table. | View a Motor Risk Note in browser. |
| **Domestic Template** | Implement Domestic-specific sections and valuation basis. | View a Domestic Risk Note in browser. |
| **Standardization** | Ensure all templates use the "Minimal Invoice" header style. | Visual consistency check. |

## 5. Data Mapping for Seeding (Examples)

### Product: Personal Accident
- **Cover:** "Payment of benefits as defined as a result of accidental death..."
- **Benefits:** `{"Accidental Death": 500000, "Hospital Cash": 1000, ...}`
- **Clauses:** `["24hour cover", "Worldwide limits", ...]`

### Product: Motor Private
- **Cover:** "Accidental loss or damage to insured motor vehicle..."
- **Excess:** `{"Own Damage": "2.5% min 15k", "Third Party": "Nil", ...}`
- **Benefits:** `{"Towing": 100000, "Medical": 100000, ...}`

## 6. Implementation Order
1. **Update Seed Script**: Provide the "Truth" in the database.
2. **Refactor RiskNoteTemplate**: Create the class-based switcher.
3. **Build Body Components**: One by one, starting with Motor (most common).
