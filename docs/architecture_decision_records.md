# Architecture Decision Records

This document consolidates significant architectural decisions made during the project's development. Each entry should clearly state the decision, the context in which it was made, the options considered, and the rationale behind the chosen solution.

---

## Template for a New Architecture Decision Record

### Title: [Descriptive Title of the Decision]

*   **Date:** YYYY-MM-DD
*   **Status:** Proposed, Accepted, Superseded, etc.
*   **Deciders:** [List of individuals or teams involved in the decision]
*   **Context:**
    Describe the forces at play, including the problem or challenge that led to the decision, relevant background information, and any constraints.
*   **Decision:**
    State the specific architectural decision that was made. Be concise and clear.
*   **Alternatives Considered:**
    List and briefly describe any significant alternatives that were evaluated. For each alternative, mention its pros and cons relevant to the context.
*   **Rationale:**
    Explain *why* the chosen decision was made, referencing the pros of the chosen alternative and the cons of the rejected alternatives. Discuss the trade-offs and how the decision aligns with overall project goals.
*   **Consequences (Positive and Negative):**
    Enumerate the expected outcomes of this decision, both favorable and unfavorable. This helps in understanding the long-term impact.

---

### Title: Catalog Management (Insurers & Products) View Mapping and `product_details` JSON Standardization

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The need to manage insurance carriers (Insurers) and their associated products in a structured and consistent manner. This includes defining navigation paths for administrative views and standardizing the schema for product details to ensure type-safety and consistency across various system components like Risk Note rendering, Policy creation, and UI builders.
*   **Decision:**
    1.  **View Mapping (Navigation):** Use `/catalog` as the base path for business management views to differentiate them from user-level `/admin` routes. Specific routes defined for Insurers and Products include:
        *   Insurers: `/catalog/insurers`, `/catalog/insurers/new`, `/catalog/insurers/$id`
        *   Products: `/catalog/products`, `/catalog/products/new`, `/catalog/products/$id`
    2.  **Standardizing `product_details` JSON:** Define a strict TypeScript-like schema for the `product_details` array to ensure consistency and type-safety. Each field object within this array will have `key`, `label`, `field_type`, `input_type`, `section`, optional `value`, optional `pricing`, `show_in_risknote`, and `required` properties.
*   **Alternatives Considered:**
    (Not explicitly stated in the source document, will leave blank)
*   **Rationale:**
    -   **View Mapping:** Provides a clear separation between administrative views for catalog management and general user administration. The hierarchical structure allows for logical grouping and navigation.
    -   **`product_details` Standardization:** Ensures data consistency and integrity across the system, simplifies development by providing a predictable data structure, and enables robust validation. This is crucial for reliable rendering of documents and UI interactions.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Improved system maintainability, reduced bugs related to inconsistent data structures, clearer separation of concerns in the UI, and a solid foundation for future catalog management features.
    -   **Negative:** Requires adherence to the defined schema when developing new product-related features, which might initially add overhead.

---

### Title: Document System Architecture & Reorganization Strategy

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The existing document system was monolithic and lacked clear separation of concerns, leading to maintenance challenges and difficulty in managing different document types. There was a need for a more modular, contextually relevant, and structurally decoupled approach to document generation, viewing, and organization within the application.
*   **Decision:**
    1.  **Core Philosophy:**
        *   **Separation of Concerns:** Each document type (Debit Note, Certificate, Risk Note) will have its own dedicated template file.
        *   **Contextual Placement:** Documents will reside where they are most relevant (e.g., Financials under Clients, Coverage under Policies).
        *   **Granular Linking:** System-generated documents will maintain strict metadata linking them to both the Client and the specific Policy.
    2.  **Structural Decoupling:** Move from a monolithic `RiskNoteDocument.tsx` to a registry-based approach.
        *   Extract document templates into `frontend/src/components/Documents/templates/` (e.g., `DebitNoteTemplate.tsx`, `CertificateTemplate.tsx`, `RiskNoteSummaryTemplate.tsx`).
        *   Refactor `DocumentViewerModal.tsx` to dynamically resolve the correct template based on `DocumentType` and `id`.
    3.  **Contextual Reorganization (UX):** Move away from a "One-size-fits-all" Documents tab.
        *   **Policy View (`/policies/$policyId`):** Focus on coverage and risk, including historical Risk Notes, Certificates, and policy-specific documents.
        *   **Client View (`/clients/$clientId`):** Focus on financial relationship and KYC, including Invoices (Debit Notes), KYC documents, and correspondences.
    4.  **File Structure Changes:** Establish a clear file structure under `frontend/src/components/Documents/` to support the modular design, including `BaseDocument.tsx`, `DocumentRegistry.tsx`, and a `templates/` subdirectory.
*   **Alternatives Considered:**
    (Not explicitly stated in the source document, will leave blank)
*   **Rationale:**
    -   **Modularity and Maintainability:** Separating templates and decoupling the viewer improves code organization, reduces complexity, and makes it easier to develop, test, and maintain individual document types.
    -   **Improved User Experience:** Contextual placement and reorganization of documents within the UI (Policy View, Client View) enhance usability by presenting relevant information where and when it's needed, reducing cognitive load for users.
    -   **Scalability:** The registry-based approach allows for easy addition of new document types without modifying existing components, promoting scalability.
    -   **Data Integrity:** Granular linking ensures that documents are correctly associated with clients and policies, improving data accuracy and traceability.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Enhanced system flexibility, better user experience, simplified onboarding of new document types, and improved code quality.
    -   **Negative:** Requires significant refactoring of existing document-related components and views. Initial development effort will be higher due to the architectural changes.

---

### Title: Unified Document Management System

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
    The project requires a robust and unified system for managing various types of documents, encompassing both system-generated templates (like Invoices and Risk Notes) and external uploads (like receipts, ID scans). The existing setup likely lacked a consistent approach to storage, identification, and viewing, leading to inefficiencies and potential data inconsistencies.
*   **Decision:**
    1.  **Naming & Philosophy:** The `DocumentViewer` component will be the single UI component handling both generated templates and external uploads. The philosophy is "External-First for evidence" – prioritizing original scans for external documents and system templates for generated ones.
    2.  **Storage Architecture:** Implement a `StorageProvider` interface in the backend to abstract storage mechanisms. The immediate implementation will use local filesystem storage (`backend/storage/`). The interface allows for future-proofing to easily swap to S3 (Blob Storage) without altering database logic. File paths in the database will store relative paths.
    3.  **Document Identification:** Use `entity_type` + `entity_id` for absolute linking. `document_type` will serve as primary classification. A `metadata` JSONB field will be added to the `Document` model for searchable key-value pairs.
    4.  **Enhanced DocumentViewer Logic:** Implement smart rendering based on `document.mime_type` (PDF Viewer for PDFs, Image Lightbox for images) and render React templates for system-generated entities. A "Contextual Sidebar" will display ledger data for receipts alongside the scan.
    5.  **Search & Filtering Workflow:** Enable global search by filename or `metadata` JSONB field. Contextual filtering will be supported (e.g., filtering by `client_id` in client views). A `status` field (`Pending Review`, `Verified`, `Rejected`) will be added to Documents for tracking.
*   **Alternatives Considered:**
    (Not explicitly stated in the source document, will leave blank)
*   **Rationale:**
    -   **Consistency & Efficiency:** A unified `DocumentViewer` simplifies UI development and provides a consistent user experience for all document types.
    -   **Scalability & Flexibility:** The `StorageProvider` abstraction allows for seamless migration to cloud storage solutions, ensuring the system can scale.
    -   **Improved Data Organization & Searchability:** Clear identification, classification, and the `metadata` field enhance document management, making documents easier to find and process.
    -   **Enhanced User Experience:** Smart rendering and contextual sidebars improve the usability and utility of the document viewer.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Streamlined document workflows, reduced storage coupling, improved data governance, and a more intuitive user interface for document interaction.
    -   **Negative:** Requires changes to existing document models and viewer components, and a new backend upload endpoint. Initial effort for implementing the `StorageProvider` and `metadata` fields.

---

### Title: Model Update Strategy - Temporal & Refined Architecture

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
    The project requires an evolution of its core data models to support critical functionalities suchs history tracking, flexible pricing mechanisms, and a more robust polymorphic document storage. The existing models likely lacked the granularity or features necessary to implement these requirements efficiently and consistently across the application.
*   **Decision:**
    Implement refined data models as defined in `docs/03_backend_data_models.md` with the following key changes:
    1.  **User Model:** Add a `role` Enum (e.g., `Admin`, `Underwriter`, `Cashier`, `Viewer`).
    2.  **Client Model:** Rename `postal_address` to `physical_address` for clarity and accuracy.
    3.  **Product Model:** Introduce `pricing_strategy` (Enum), `pricing_rules` (JSON), and `form_schema` (JSON) to support flexible product pricing and dynamic form generation.
    4.  **Policy Engine Models:**
        *   **Policy:** Add `created_at` (Timestamp) for tracking.
        *   **RiskItem:** Implement temporal versioning using `version_number`, `valid_from`, `valid_to`, and `is_active` fields. This allows for historical tracking of changes to risk items.
        *   **RiskNote:** Augment with `invoice_number`, `created_by_id`, `previous_risk_note_id`, `payment_status`, and detailed financial fields (`net_premium`, `taxes`, `total_amount`), plus `items_snapshot` for data integrity.
    5.  **Financials Models:**
        *   Rename `Receipt` to `Payment`.
        *   **Payment:** Add `date`, `amount`, `unallocated_amount`, `payment_mode`, `reference`, `created_by_id`.
        *   **PaymentAllocation:** Introduce a link between `Payment` and `RiskNote`.
    6.  **Polymorphic Documents:** Consolidate all attachments into a single `Document` table with `entity_type`, `entity_id`, `document_type`, `file_path`, `mime_type`, `uploaded_at` fields for flexible and unified document storage.
*   **Alternatives Considered:**
    (Not explicitly stated in the source document, will leave blank)
*   **Rationale:**
    -   **History Tracking:** Temporal versioning for `RiskItem` provides an auditable history of changes, crucial for insurance compliance and operational transparency.
    -   **Flexible Pricing:** `pricing_strategy` and `pricing_rules` enable dynamic and configurable product pricing without requiring code changes for each new pricing model.
    -   **Dynamic Forms:** `form_schema` allows for dynamic generation of UI forms based on product definitions, improving flexibility and reducing development for new products.
    -   **Unified Document Management:** Polymorphic document storage centralizes document handling, simplifying management, search, and retrieval across different entities.
    -   **Improved Financial Granularity:** Detailed financial fields in `RiskNote` and refined `Payment`/`PaymentAllocation` models provide better financial tracking and reporting capabilities.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Enhanced system flexibility, improved auditability, support for complex business rules (pricing, history), streamlined document management, and better data integrity.
    -   **Negative:** Requires significant backend model refactoring, database migrations, and extensive updates to CRUD operations and API endpoints. Frontend components will also need substantial updates to align with the new data structures. Potential for downtime during migration if not carefully managed.

---

### Title: Risk Note Backend Data Modeling and Dual-Mode Print View

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The existing Risk Note system was too simplistic and needed to evolve from a "Simple Placeholder" to a "Real Insurance Document" capable of storing complex, variable data, and presenting it in different formats (Certificate vs. Invoice). This required modifications to the backend data model for Risk Notes and a flexible rendering strategy for printed documents.
*   **Decision:**
    1.  **Backend Data Modeling for RiskNote:**
        *   Remove simplistic `basic_premium` and `gross_premium` fields from the `RiskNote` model.
        *   Add JSON fields to the `RiskNote` model to store complex, variable data:
            *   `premium_breakdown`: For detailed financial calculations (e.g., `{ "basic": 45000, "pvt": 1125, "levies": [...], "total": 47000 }`).
            *   `benefits_snapshot`: For promises/benefits (e.g., `{ "towing": 100000, "windscreen": 50000 }`).
            *   `risk_item_snapshot`: For a snapshot of the asset covered (e.g., `"Toyota Harrier, KCA 123B"`).
    2.  **Dual-Mode Print View:** Implement a single print route (`/print/risk-notes/$id?mode=certificate|invoice`) that can render the Risk Note in two distinct modes:
        *   **Certificate Mode (`?mode=certificate`):** Focuses on the "Promise," displaying "CERTIFICATE OF INSURANCE," schedule of benefits, clauses, and only "Total Premium Paid" (hiding tax breakdown).
        *   **Invoice Mode (`?mode=invoice`):** Focuses on the "Math," displaying "DEBIT NOTE," a detailed financial breakdown table, and bank details/preparer information.
*   **Alternatives Considered:**
    -   For backend data modeling: Storing each premium component or benefit as a separate database field (rejected due to schema complexity and inflexibility for variable product structures).
    -   For print views: Creating entirely separate routes or components for certificates and invoices (rejected in favor of a single, parameter-driven route for reusability and consistency).
*   **Rationale:**
    -   **Backend Data Modeling:** Using JSON fields provides flexibility to store heterogeneous and evolving premium breakdowns, benefits, and risk item details without frequent database schema migrations. This allows the Risk Note to accurately represent the complex reality of an insurance policy at any point in time.
    -   **Dual-Mode Print View:** Consolidating print logic into a single route with a `mode` parameter simplifies maintenance, ensures consistency in branding (if applicable), and allows for dynamic presentation tailored to different user needs (client-facing certificate vs. financial audit invoice).
*   **Consequences (Positive and Negative):**
    -   **Positive:** Increased flexibility in defining and storing complex policy details, streamlined print functionality, improved user experience by providing relevant document views, and reduced backend schema churn.
    -   **Negative:** Querying and reporting on data stored within JSON fields can be more complex than with normalized relational fields. Frontend rendering logic needs to be robust enough to handle the JSON structures dynamically.

---

### Title: Refined Semantic Document Rendering

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    There was a need to improve the visual consistency and semantic structure of all document tables and ensure that both static product information (benefits, clauses) and captured instance data (`risk_details`) are rendered together. The existing rendering approach might have lacked uniformity and a clear method for combining these two types of data effectively.
*   **Decision:**
    1.  **Architectural Refinements:**
        *   **Semantic Headers:** Convert label columns from `<td>` to `<th scope="row">` for improved semantic structure and accessibility.
        *   **Data Aggregation:** The Risk Note rendering process will explicitly aggregate data from two sources:
            *   **Template Data:** Static content defined in `policy.product.product_details` (e.g., standard Benefits, Exclusions).
            *   **Instance Data:** Captured fields specific to the policy instance from `policy_snapshot.risk_details` (e.g., Registration Number, Sum Insured).
            *   A helper logic will be used to merge these data sets, intelligently combining inner key-value pairs if sections overlap.
        *   **Uniform Styling:** Apply a consistent "Clean Bordered" look across all document tables (Header, Risk, Financials, Insurer) to ensure visual cohesion.
*   **Alternatives Considered:**
    (Not explicitly stated in the source document, will leave blank)
*   **Rationale:**
    -   **Visual Consistency & Readability:** Standardizing table structures and styling improves the readability and professional appearance of all generated documents.
    -   **Semantic Correctness:** Using semantic `<th>` tags enhances document structure and can aid in accessibility.
    -   **Comprehensive Data Presentation:** Aggregating both template-defined and instance-specific data ensures that the rendered documents provide a complete and accurate picture of the policy without redundancy or missing information. This approach is crucial for documents like Risk Notes which combine static product definitions with dynamic policy details.
    -   **Consequences (Positive and Negative):**
    -   **Positive:** Improved user experience with professionally rendered documents, reduced errors due to incomplete data presentation, and a more maintainable rendering codebase due to standardized components.
    -   **Negative:** Requires refactoring of existing document rendering components and logic to implement the data aggregation and semantic structuring. Initial development effort to ensure all existing document types conform to the new standard.

---

### Title: Navigation Architecture Upgrade and Breadcrumb Implementation

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The application's navigation architecture, particularly for deeply nested views (e.g., specific policies within client profiles), was causing users to lose context. There was a need to implement a clear and consistent navigation aid like breadcrumbs to improve user experience and provide better contextual awareness within the application.
*   **Decision:**
    1.  **Component Installation:** Install the Shadcn Breadcrumb component (`npx shadcn@latest add breadcrumb`).
    2.  **Architectural Refactor for Navigation:**
        *   **Extract Header:** Create a dedicated `frontend/src/components/layout/Header.tsx` component to centralize header logic.
        *   **Route Definition Refactor:** Refactor Client View tabs (Overview, Policies, Documents, Invoices) to be **true nested routes** (e.g., `/clients/123/invoices`) instead of simple state-switched tabs. This ensures that the URL accurately reflects the current view, which is crucial for breadcrumb generation.
    3.  **Breadcrumb Implementation Logic:** Create a utility hook or function (e.g., `useBreadcrumbs`) that:
        *   Parses the current location path.
        *   Splits the path into segments.
        *   Maps dynamic IDs (e.g., `123`) to readable names where possible, falling back to the ID otherwise.
        *   Returns an array of objects `{ label: string, href: string }`.
        *   Handles special prefixes like `/admin` gracefully.
    4.  **UI Integration:** Integrate the generated breadcrumbs into `frontend/src/components/layout/Header.tsx`.
*   **Alternatives Considered:**
    -   Maintaining state-switched tabs with programmatic breadcrumb updates (rejected because true nested routes provide a more robust and URL-friendly solution, aligning better with standard web navigation patterns).
    -   Manual breadcrumb generation per page (rejected due to maintenance overhead and potential for inconsistencies).
*   **Rationale:**
    -   **Improved User Experience:** Breadcrumbs provide clear navigational context, helping users understand their current location within the application's hierarchy and easily navigate back to previous sections.
    -   **Consistent Navigation:** Centralizing header and breadcrumb logic ensures a uniform navigation experience across the application.
    -   **Enhanced Routability:** Refactoring tabs to nested routes makes URLs more meaningful and enables direct linking to specific sub-sections, which is beneficial for sharing and bookmarking.
    -   **Maintainability:** A utility-based approach for breadcrumb generation reduces duplication and simplifies future updates to the navigation structure.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Significantly improved user navigation and context awareness, more robust routing, easier sharing of specific views, and a more maintainable frontend architecture.
    -   **Negative:** Requires refactoring of existing tab implementations into nested routes, potentially impacting existing component structures and state management. Initial development effort to implement the breadcrumb logic and integrate it across all relevant views.

---

### Title: Document & Payment System Strategy (Refined)

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The existing document and payment system required a refined strategy to achieve unified viewing, decoupled logic, and accurate record-keeping. There was a need to clarify the roles of different document types (Risk Note, Invoice, Receipt) and align backend models with business flows, while ensuring a generic viewer interface.
*   **Decision:**
    1.  **Core Philosophy:**
        *   **Unified Viewing, Decoupled Logic:** A single `DocumentViewer` interface will handle all document types (Risk Note, Invoice, Receipt) without "modes."
        *   **Strict Decoupling:** Risk Notes (underwriting) and Invoices (financials) are distinct entities. A Risk Note describes a transaction; an Invoice requests payment for one or more transactions.
        *   **Record Accuracy:** Certificates are explicitly removed from the system as they are not considered official records.
    2.  **Document Definitions:**
        *   **Risk Note:** Summary of an underwriting action, residing under **Policies**.
        *   **Invoice (Debit Note):** Request for payment, residing under **Clients**, aggregating pending balances from Risk Notes.
        *   **Receipt:** Record of a payment made by a client, residing under **Financials**.
    3.  **Component Architecture:**
        *   `DocumentViewer.tsx` will be a stateless container that takes `documentType` and `data`, using a registry to render the correct `RiskNoteTemplate.tsx`, `InvoiceTemplate.tsx`, or `ReceiptTemplate.tsx`.
    4.  **Backend Model Rework:**
        *   **Flow Alignment:** The system flow will be: Policy Renewed -> `RiskNote` created -> `Invoice` created/updated with the pending amount.
        *   **`Payment` Model Refactor:** Existing `Payment` model will be renamed/refactored to `Receipt`.
        *   **Introduce `Invoice` Model:** A new `Invoice` model will be introduced to track "Money Owed," containing line items linking to `RiskNote` IDs.
*   **Alternatives Considered:**
    -   Maintaining separate viewers for different document types (rejected for lack of consistency and reusability).
    -   Keeping certificates as formal documents (rejected as they are not part of official records and can be generated from Risk Notes).
    -   Directly linking payments to risk notes without an intermediate Invoice model (rejected for lack of financial granularity and ability to group multiple risk notes for a single payment request).
*   **Rationale:**
    -   **System Simplicity & Consistency:** A unified viewer and clear document definitions simplify the frontend and backend logic.
    -   **Business Alignment:** Decoupling Risk Notes from Invoices and introducing a distinct Invoice model directly mirrors real-world insurance and financial workflows, improving auditability and financial control.
    -   **Scalability & Maintainability:** The component architecture with a registry allows for easy addition of new document types.
    -   **Data Integrity:** Clear separation of concerns in backend models ensures data accuracy for both underwriting and financial records.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Streamlined document workflows, reduced storage coupling, improved data governance, and a more intuitive user interface for document interaction.
    -   **Negative:** Requires significant refactoring of existing document viewing components, backend models, and associated CRUD operations and API endpoints. Data migration might be complex.

---

### Title: Risk Note Refinement & Data Seeding Strategy

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The existing Risk Note generation needed refinement to support class-specific layouts (e.g., Motor Private, Personal Accident, Domestic Package) aligning with real-world examples. This necessitated updating the data catalog (Insurers/Products) and the frontend template logic to handle varying data structures and rendering requirements.
*   **Decision:**
    1.  **Granular Data Strategy (Aggregated via Form Schema):**
        *   **Catalog Update (Seeding):** Update `backend/app/seed_mock_data.py` to include real-world product definitions. Each product's `form_schema` will now include a `category` field (e.g., `VEHICLE DETAILS`, `LOCATION`, `BENEFITS & LIMITS`, `EXCESS`, `LIABILITIES`) to allow the UI to aggregate (group) data into logical tables.
        *   **RiskItem Snapshot Structure:** The `items_snapshot` in `RiskNote` will continue to store raw key-value pairs from the form. The UI will use the `Product.form_schema` to map these keys to their respective labels and categories for rendering.
    2.  **Frontend Component Strategy - Dynamic Section Rendering:**
        *   Implement a **Dynamic Section Renderer** within `RiskNoteTemplate.tsx`.
        *   This renderer will:
            1.  Group data by `category` (from `form_schema`) for fields present in `items_snapshot`.
            2.  Render different UI components based on the category (e.g., `VEHICLE DETAILS` or `LOCATION` as a horizontal grid/table; `BENEFITS` or `EXCESS` as a vertical list/table of key-value pairs).
        *   The logic will involve an aggregation step: `product.form_schema` will be reduced to group fields into categories based on `items_snapshot`.
*   **Alternatives Considered:**
    -   Hardcoding layouts for each product class (rejected for maintainability issues and lack of scalability when adding new products).
    -   Storing rendering hints directly in `RiskNote` `items_snapshot` (rejected to keep the snapshot purely data-focused and avoid coupling backend snapshots with frontend presentation logic).
*   **Rationale:**
    -   **Flexibility & Scalability:** The dynamic section rendering based on a `form_schema` with categories provides a highly flexible and scalable way to define and render class-specific Risk Note layouts without requiring code changes for every new product or layout variation.
    -   **Separation of Concerns:** Decoupling rendering logic from raw data storage (the `items_snapshot`) ensures that the frontend can evolve its presentation layer independently of the backend data model.
    -   **Improved Data Presentation:** Aggregating fields by semantic categories (e.g., `VEHICLE DETAILS`) enhances readability and aligns with real-world document structures.
*   **Consequences (Positive and Negative):**
    -   **Positive:** More adaptable and maintainable Risk Note templates, improved consistency across diverse product offerings, easier onboarding of new products with dynamic layouts, and a cleaner separation between data and presentation.
    -   **Negative:** Requires initial development effort to build the Dynamic Section Renderer and to update existing product `form_schema` with category information. Front-end logic becomes more complex to handle dynamic rendering.

---

### Title: Risk Note Refinement Strategy - Composable & Dynamic Layouts

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The need to transform the Risk Note from a static document into a more flexible, composable, and data-driven template that can adapt to different insurance products (Motor, Personal Accident, Domestic Package, etc.). This also includes a significant workflow change: automatically generating an initial "New Business" Risk Note upon policy creation to ensure a consistent financial and contractual snapshot from its inception.
*   **Decision:**
    1.  **Composable & Data-Driven UI for Risk Notes:**
        *   Build the Risk Note using atomic "Row" and "Section" components.
        *   The layout will be dynamically driven by the `Product.form_schema`, using `form_schema` categories to group data into logical tables (e.g., "VEHICLE DETAILS", "LOCATION"). This approach ensures that business logic and document structure are decoupled.
    2.  **Automated Initial Risk Note Generation:**
        *   Every new policy will now automatically generate an initial "New Business" Risk Note upon creation.
    3.  **Lifecycle Management:** Support "Draft" risk notes that are automatically created with a policy and can be populated later.
*   **Alternatives Considered:**
    -   Hardcoded sub-templates for each product type (e.g., `MotorRiskNote.tsx`): Rejected because it leads to high maintenance, requires new frontend code for every new product, and can result in visual inconsistencies.
    -   Manual creation of initial Risk Notes: Rejected because it does not guarantee a financial and contractual snapshot from policy inception, leading to potential data gaps.
*   **Rationale:**
    -   **Reduced Maintenance & Rapid Onboarding:** A composable, data-driven approach means changes to a product's schema automatically reflect in the document. Adding a new class only requires a new `Product` entry, not new frontend code.
    -   **Consistency & Branding:** Ensures all documents share the same "HealthWatch" branding and structural consistency.
    -   **Improved Data Integrity & Auditability:** Automatically generating an initial Risk Note upon policy creation ensures that there's always a record of the policy's state at inception, which is crucial for financial and contractual accuracy.
    -   **Flexibility:** The `Product.form_schema` drives the layout, allowing for dynamic adaptation to different product requirements.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Highly flexible and scalable Risk Note templates, significant reduction in maintenance overhead for new products, improved data integrity, and a consistent user experience.
    -   **Negative:** Requires initial development effort to build the composable components and dynamic rendering logic. Backend changes needed to automate Risk Note creation and manage a `status` field for Risk Notes.

---

### Title: Semantic & Flexible Document Layouts Strategy

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    There was a need to enable diverse data presentation styles (Key-Value, Lists, Descriptive Blocks) within documents, particularly for the Risk Note, and transition to a more semantic table-based layout to improve professional printing and reduce cognitive load. This required a flexible mechanism to define and render different layout types.
*   **Decision:**
    1.  **Defining Section Types:** Support three primary layout modes for every section in a product:
        *   **TABLE:** 2 Columns (Label | Value) for use cases like Benefits, Excesses, Vehicle Details.
        *   **LIST:** 1 Column (Bulleted/Numbered List) for use cases like Special Clauses, Exclusions.
        *   **BLOCK:** 1 Column (Full-width text block) for descriptive narratives like Occupation.
    2.  **Technical Decisions:**
        *   **Explicit Config:** Layout types will be saved in `Product.section_configs` (JSON field) to explicitly control rendering logic from the product definition, removing ambiguity from the frontend.
        *   **Semantic HTML:** Use `<table>` HTML elements instead of `CSS Grid` for the core document rendering to improve print reliability and visual consistency, especially for complex layouts.
*   **Alternatives Considered:**
    -   Hardcoding layout logic directly into frontend components based on section names (rejected for maintainability, lack of flexibility, and difficulty in managing diverse presentation requirements).
    -   Relying solely on CSS Grid for all document layouts (rejected due to potential print inconsistencies and less robust cross-browser compatibility compared to semantic tables for document-like structures).
*   **Rationale:**
    -   **Enhanced Flexibility:** Explicitly defining section types and storing them in `section_configs` allows product managers or configurators to control the presentation of data without code changes.
    -   **Improved Maintainability:** Centralizing layout configurations in the product definition simplifies updates and reduces the risk of inconsistencies across different document types and products.
    -   **Professional Presentation:** Using semantic HTML tables ensures that documents are rendered consistently and professionally, especially for printing, which is critical for official insurance documents.
    -   **Reduced Cognitive Load:** Clearly defined and consistently rendered sections improve readability and understanding for users.
*   **Consequences (Positive and Negative):**
    -   **Positive:** More configurable and adaptable document layouts, improved print quality, better separation of concerns between product definition and UI rendering, and a more robust foundation for dynamic document generation.
    -   **Negative:** Requires backend model updates for `Product` to include `section_configs` and associated migrations. Frontend rendering components (`RiskNoteTemplate`) need significant refactoring to interpret and apply these configurations dynamically. The `SchemaBuilder` UI will need updates to allow configuring these section types.

---

### Title: Simplified Insurance Models Strategy

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The existing insurance data architecture was deemed overly complex and redundant due to the presence of a separate `RiskItem` layer, leading to potential inconsistencies and complicating data management. A simpler, more direct representation of insurance policies was required, consolidating cover-specific details directly within the `Policy` model.
*   **Decision:**
    Simplify the data architecture by removing redundant layers and merging cover-specific details directly into the `Policy` model, enforcing a "1 Policy = 1 Cover Instance" principle.
    1.  **Entity Definitions (Refined):**
        *   **Product:** Remains as the class/template defining a type of insurance.
        *   **Policy:** Becomes the central "Instance/Cover." It will now include all cover-specific details (e.g., `start_date`, `end_date`, `description`, `total_premium`, `premium_breakdown` (JSON), `risk_details` (JSON)) previously managed by `RiskItem`.
        *   **Risk Note:** Remains as a transaction/document snapshot of the Policy at a specific point in time, with `policy_snapshot` JSON field reflecting the Policy's details.
        *   **Financials (Invoices & Receipts):** Remain separate entities, with `Invoice` linking to `RiskNote` and `Receipt` for payments.
    2.  **Model Update:**
        *   Update the `Policy` model to include fields previously residing in `RiskItem`.
        *   Update the `RiskNote` model to snapshot `Policy` fields instead of `RiskItem`.
        *   **Deprecate `RiskItem` model and all associated relationships.**
*   **Alternatives Considered:**
    -   Maintaining the `RiskItem` model and refactoring its relationship with `Policy` (rejected due to the belief that a `Policy` inherently represents a single cover instance, making `RiskItem` redundant and an unnecessary layer of complexity).
    -   Further normalization of `Policy` details (rejected for adding complexity without sufficient benefit, as JSON fields provide flexibility for heterogeneous cover details).
*   **Rationale:**
    -   **Simplified Architecture:** Reduces the number of core entities, making the data model easier to understand, manage, and query.
    -   **Improved Data Cohesion:** Consolidating cover details directly into the `Policy` model ensures that all information related to a specific cover instance is in one place, improving data consistency.
    -   **Reduced Redundancy:** Eliminates the `RiskItem` model, removing a layer that often duplicated or closely mirrored information in `Policy`.
    -   **Streamlined Development:** Simplifies CRUD operations, API interactions, and wizard logic by operating on fewer, more comprehensive models.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Significant reduction in architectural complexity, improved data integrity, faster development cycles due to simpler models, and easier onboarding for new developers.
    -   **Negative:** Requires a major backend migration (data movement from `RiskItem` to `Policy`, `RiskItem` table deletion), extensive refactoring of existing CRUD operations, API endpoints, and frontend components (wizards and views) that previously interacted with `RiskItem`. Potential for data loss or inconsistency if migration is not handled carefully.

---

### Title: Unified Document Upload & Management Strategy

*   **Date:** (Estimate based on file last modified, or leave blank if unknown)
*   **Status:** Accepted
*   **Deciders:** (Unknown, leave blank)
*   **Context:**
    The project requires a consolidated and robust workflow for handling all file uploads and management, replacing fragmented or legacy approaches (e.g., "Correspondence" links) with a unified UI and underlying system. The goal is to ensure consistency, data integrity, and future-proofing for document handling.
*   **Decision:**
    Implement a unified document upload and management system built around a single, robust workflow:
    1.  **Reusable `FileUpload` Component:** Create a standalone `FileUpload` component (e.g., extracting logic from `AddReceiptForm`) with features like drag-and-drop, file type validation (PDF/Images), and preview thumbnails. This component will serve as the single source of truth for all file selection UI.
    2.  **`UnifiedDocumentManager`:** Implement a `UnifiedDocumentManager` component (`frontend/src/components/Common/UnifiedDocumentManager.tsx`). This manager will:
        *   Use `useDocuments(entityId, entityType)` to list files.
        *   Use `useUploadDocument()` for new file uploads.
        *   Use `useDeleteDocument()` for file removals.
        *   Present a clean table or grid of documents with "View" buttons that trigger the `DocumentViewer` modal.
    3.  **"Document Presets" Configuration:** Define a configuration object that maps `entity_type` to common `document_types` (e.g., for `Policy`: "Logbook", "Valuation Report"; for `Client`: "KRA PIN Certificate", "National ID / Passport"). This will populate context-aware dropdowns in the upload forms.
    4.  **Integrated "Lightbox" Viewer:** Update document list actions so that "View" buttons open the `DocumentViewer` modal (lightbox) for a seamless in-app document viewing experience, rather than external links.
    5.  **Migration & Cleanup:** Replace all instances of older, fragmented document management approaches (e.g., correspondence-based systems) with the new `UnifiedDocumentManager`.
*   **Alternatives Considered:**
    -   Maintaining separate, specialized file upload/management components for each entity type (rejected due to inconsistency, increased development/maintenance overhead, and difficulty in ensuring uniform features).
    -   Relying on external links for document viewing (rejected in favor of a seamless in-app experience provided by the lightbox viewer).
*   **Rationale:**
    -   **Consistency:** Establishes a single, coherent approach for all file handling, reducing user confusion and developer effort.
    -   **Data Integrity:** Ensures files are correctly linked to entities via UUIDs and Enums, improving traceability and reducing errors.
    -   **Future-Proofing:** An abstracted storage mechanism (e.g., `StorageProvider` in the backend) allows for easy swapping between local storage and cloud solutions (S3/Blob storage) without impacting frontend logic.
    -   **Improved User Experience:** Features like drag-and-drop, context-aware presets, and an integrated lightbox viewer enhance usability significantly.
*   **Consequences (Positive and Negative):**
    -   **Positive:** Streamlined document workflows, reduced redundancy in component development, improved data governance, enhanced user satisfaction, and a more scalable and maintainable document management infrastructure.
    -   **Negative:** Requires significant refactoring of existing document-related forms and views, and potentially some backend logic for metadata and linking. Initial development effort to build the core `FileUpload` and `UnifiedDocumentManager` components.
