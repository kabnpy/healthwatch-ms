# Risk Note Refinement Strategy - Composable & Dynamic Layouts

## 1. Vision
Transform the Risk Note from a static document into a composable, data-driven template that adapts to different insurance products (Motor, Personal Accident, Domestic Package, etc.). The layout will be driven by the `Product.form_schema`, ensuring that business logic and document structure are decoupled.

**Workflow Change:** Every new policy will now automatically generate an initial "New Business" Risk Note upon creation. This ensures that a policy always has a financial and contractual "snapshot" from its inception.

## 2. Key Objectives
- **Composable UI:** Build the Risk Note using atomic "Row" and "Section" components.
- **Data-Driven:** Use `form_schema` categories to group data into logical tables (e.g., "VEHICLE DETAILS", "LOCATION").
- **Lifecycle Management:** Support "Draft" risk notes that are automatically created with a policy and can be populated later.
- **Visual Fidelity:** Match the minimalist, professional aesthetic of the sample text layouts.

...

## 5. Implementation Phases (Measurable)

### Phase 1: Foundation & Workflow (Day 1)
- [x] **Backend:** Update `create_policy` CRUD to automatically generate a "New Business" Risk Note.
- [ ] **Backend:** Add `status` field to `RiskNote` model and run migration.
- [ ] **Seeding:** Update `seed_mock_data.py` with enriched schemas for Old Mutual products.
- [ ] **Verification:** Confirm DB contains the new schema and status field.

### Phase 2: Composable Template (Day 2)
- [ ] **Component:** Create `RiskNoteRow.tsx` for consistent key-value rendering.
- [ ] **Refactor:** Update `RiskNoteTemplate.tsx` to use the aggregation logic.
- [ ] **Print View:** Sync `print/risk-notes.$id.tsx` to use the same components.

### Phase 3: Dynamic Form & Workflow (Day 3)
- [ ] **Form:** Refactor `RiskNoteForm.tsx` to use `form_schema`.
- [ ] **Workflow:** Add "Raise Risk Note" button to Policy Dashboard that opens the form.
- [ ] **Drafts:** Enable "Save as Draft" functionality.

### Phase 4: Polish & Testing (Day 4)
- [ ] **UI:** Refine table borders and spacing to match `risk_note_layout.txt`.
- [ ] **Tests:** Write E2E tests for creating and viewing Risk Notes for each of the 3 classes.

## 6. Architectural Decision: Why Composable?
We chose a composable approach over hardcoded sub-templates (e.g., `MotorRiskNote.tsx`) to:
1. **Reduce Maintenance:** Changes to a product's schema automatically reflect in the document.
2. **Support Rapid Onboarding:** Adding a new class (e.g., Travel Insurance) only requires a new `Product` entry, not new frontend code.
3. **Consistency:** Ensures all documents share the same "HealthWatch" branding and structure.
