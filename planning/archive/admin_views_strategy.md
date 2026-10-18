# Strategy: Catalog Management (Insurers & Products)

## 1. Architectural & Design Decisions

### View Mapping (Navigation)
We will use `/catalog` as the base for these business management views to distinguish them from user-level `/admin`.
- **Insurers**:
  - `/catalog/insurers`: (Flat) Dashboard/List of all insurance carriers.
  - `/catalog/insurers/new`: Create a new carrier.
  - `/catalog/insurers/$id`: Detail view showing insurer info + a nested list of their products.
- **Products**:
  - `/catalog/products`: (Flat) List of all insurance products across all carriers.
  - `/catalog/products/new`: Create product wizard (Step 1: Select Insurer).
  - `/catalog/products/$id`: Unified editor for product metadata and dynamic schema.

### Standardizing `product_details` JSON
To ensure consistency and type-safety across the system (Risk Note rendering, Policy creation, UI builder), we will define a strict schema for the `product_details` array.

**Each Field Object:**
```typescript
{
  "key": string,            // Unique identifier (e.g., "reg_no")
  "label": string,          // Human readable label
  "field_type": string,     // "static" | "input" | "optional"
  "input_type": string,     // "text" | "number" | "date" | "select" | "boolean"
  "section": string,        // Visual grouping (e.g., "VEHICLE DETAILS")
  "value"?: any,            // Default or static value
  "pricing"?: {             // Optional pricing logic
    "type": "percentage" | "fixed",
    "value": number
  },
  "show_in_risknote": boolean,
  "required": boolean
}
```

---

## 2. Measurable Goals & Tasks

### Phase 1: Foundation & Backend (Branch: `feature/catalog-foundation`)
- [ ] **Task 1.1**: Define Pydantic Schema for `ProductDetailItem` to validate JSON content.
- [ ] **Task 1.2**: Update `Product` model to use the new schema for validation.
- [ ] **Task 1.3**: Implement/Verify Backend API routes for `Insurers` (CRUD).
- [ ] **Task 1.4**: Implement/Verify Backend API routes for `Products` (CRUD).
- [ ] **Verification**: Unit tests for JSON validation and CRUD operations.

### Phase 2: Carrier Management UI (Branch: `feature/catalog-insurers`)
- [x] **Task 2.1**: Create `InsurersTable` and `/catalog/insurers` route.
- [x] **Task 2.2**: Implement `InsurerForm` (Create/Edit) using Shadcn components.
- [x] **Task 2.3**: Build the Insurer Detail page with nested Product list.

### Phase 3: Product Management & Schema Builder (Branch: `feature/catalog-products`)
- [x] **Task 3.1**: Create `ProductsTable` and `/catalog/products` route.
- [x] **Task 3.2**: Implement `ProductGeneralForm` (Name, Class, Commission).
- [x] **Task 3.3**: Build the **Schema Builder**: A list-based UI to manage the `product_details` JSON fields.
- [x] **Task 3.4**: Implement Preview mode for the Schema Builder. (Integrated into unified editor)

### Phase 4: Final Polish & Migration
- [x] **Task 4.1**: Migrate existing mock products to the new standardized JSON format.
- [x] **Task 4.2**: Final UI/UX pass, linting, and formatting. (Added to sidebar and command menu)

---

## 3. Git Strategy
- **Master Branch**: `main`
- **Development Branch**: `develop`
- **Feature Branches**:
  - `feature/catalog-foundation`
  - `feature/catalog-insurers`
  - `feature/catalog-products`
