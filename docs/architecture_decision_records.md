# Architecture Decision Records (ADR)

This document is the historical register of architectural decisions made throughout the project's development. In accordance with architecture governance best practices, records are preserved to provide institutional memory, but their statuses are explicitly maintained to prevent architectural drift.

---

## Architecture Decision Records Index

| ADR ID | Decision Title | Status | Date | Scope & Supersession Notes |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Catalog Management & `product_details` JSON | **Accepted** | 2026-02-15 | Active product template & `/catalog` navigation standard. |
| **ADR-002** | Document System Architecture & Reorganization | **Accepted** | 2026-02-20 | Dedicated template files & contextual document placement. |
| **ADR-003** | Unified Document Management System | **Accepted** | 2026-03-01 | StorageProvider abstraction & `entity_type`/`entity_id` linking. |
| **ADR-004** | Model Update Strategy - Temporal RiskItems | **Superseded** | 2026-03-10 | **Superseded by ADR-012 & ADR-014.** `RiskItem` temporal versioning deprecated for Atomic Snapshots. |
| **ADR-005** | Risk Note Modeling & Dual-Mode Print View | **Amended** | 2026-03-15 | **Amended by ADR-014.** Print concepts active; financial invoicing decoupled into `Invoice`. |
| **ADR-006** | Refined Semantic Document Rendering | **Accepted** | 2026-03-20 | Standard semantic tables (`<th scope="row">`) across document templates. |
| **ADR-007** | Navigation Architecture Upgrade & Breadcrumbs | **Accepted** | 2026-03-25 | True nested routes for Client/Policy tabs with Shadcn breadcrumbs. |
| **ADR-008** | Document & Payment System Strategy | **Superseded** | 2026-03-28 | **Superseded by ADR-014.** Replaced by `PaymentRecord` ledger & distinct `insurer_receipt`. |
| **ADR-009** | Risk Note Refinement & Dynamic Layouts | **Amended** | 2026-04-02 | **Amended by ADR-014.** Raw `items_snapshot` replaced with structured `cover_snapshot`. |
| **ADR-010** | Risk Note Composable Layout Strategy | **Accepted** | 2026-04-10 | Composable atomic row/section rendering driven by product schema. |
| **ADR-011** | Semantic & Flexible Document Layouts | **Accepted** | 2026-04-15 | Semantic HTML tables (`<table>`) prioritized over CSS Grid for print consistency. |
| **ADR-012** | Simplified Insurance Models Strategy | **Amended** | 2026-10-10 | **Amended by ADR-014.** `RiskItem` deleted; `Policy` kept as container, cover stored in `cover_snapshot`. |
| **ADR-013** | Unified Document Upload & Management | **Accepted** | 2026-10-15 | Active UI standard: `UnifiedDocumentManager.tsx` with lightbox viewer. |
| **ADR-014** | Consolidated Agency Architecture & Ledger | **Accepted** | 2026-10-18 | **Current Master Baseline.** Codifies Atomic Snapshots, PaymentRecord ledger, and Renewal FSM. |

---

### ADR-001: Catalog Management (Insurers & Products) View Mapping and `product_details` JSON Standardization

*   **Date:** 2026-02-15
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Context:**
    The need to manage insurance carriers (Insurers) and their associated products in a structured and consistent manner. This includes defining navigation paths for administrative views and standardizing the schema for product details to ensure type-safety and consistency across various system components like Risk Note rendering, Policy creation, and UI builders.
*   **Decision:**
    1.  **View Mapping (Navigation):** Use `/catalog` as the base path for business management views to differentiate them from user-level `/admin` routes. Specific routes defined for Insurers and Products include:
        *   Insurers: `/catalog/insurers`, `/catalog/insurers/new`, `/catalog/insurers/$id`
        *   Products: `/catalog/products`, `/catalog/products/new`, `/catalog/products/$id`
    2.  **Standardizing `product_details` JSON:** Define a strict TypeScript-like schema for the `product_details` array to ensure consistency and type-safety. Each field object within this array will have `key`, `label`, `field_type`, `input_type`, `section`, optional `value`, optional `pricing`, `show_in_risknote`, and `required` properties.
*   **Rationale:**
    *   **View Mapping:** Provides a clear separation between administrative views for catalog management and general user administration.
    *   **`product_details` Standardization:** Ensures data consistency and integrity across the system and enables robust validation.
*   **Consequences:**
    *   **Positive:** Improved maintainability, reduced bugs from inconsistent structures, clearer separation of concerns in the UI.
    *   **Negative:** Requires strict adherence to the defined schema when developing new product features.

---

### ADR-002: Document System Architecture & Reorganization Strategy

*   **Date:** 2026-02-20
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Context:**
    The existing document system was monolithic and lacked clear separation of concerns, leading to maintenance challenges and difficulty in managing different document types. There was a need for a modular, contextually relevant approach to document generation and viewing.
*   **Decision:**
    1.  **Separation of Concerns:** Each document type (Debit Note, Certificate, Risk Note) will have its own dedicated template file.
    2.  **Contextual Placement:** Documents reside where they are most relevant (e.g., Financials under Clients, Coverage under Policies).
    3.  **Structural Decoupling:** Move from a monolithic `RiskNoteDocument.tsx` to a registry-based approach under `frontend/src/components/Documents/templates/`.
*   **Rationale:**
    Separating templates and decoupling the viewer improves code organization, reduces complexity, and makes it easier to develop, test, and maintain individual document types.
*   **Consequences:**
    *   **Positive:** Enhanced flexibility, better user experience, simplified onboarding of new document types.
    *   **Negative:** Required refactoring of existing document-related components.

---

### ADR-003: Unified Document Management System

*   **Date:** 2026-03-01
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Context:**
    The project requires a unified system for managing various document types, encompassing both system-generated templates and external uploads (receipts, ID scans).
*   **Decision:**
    1.  **Single UI Component:** The `DocumentViewer` component will handle both generated templates and external uploads ("External-First for evidence").
    2.  **Storage Architecture:** Implement a `StorageProvider` interface in the backend to abstract storage mechanisms (local filesystem in development, Cloudflare R2 / S3 in production).
    3.  **Document Identification:** Use `entity_type` + `entity_id` for polymorphic linking with a `metadata` JSONB field for searchable key-value pairs.
*   **Rationale:**
    A single storage abstraction and viewer component simplifies UI development and provides a future-proof foundation for cloud migration.
*   **Consequences:**
    *   **Positive:** Streamlined document workflows, reduced storage coupling, improved data governance.
    *   **Negative:** Required backend storage abstraction and upload endpoints.

---

### ADR-004: Model Update Strategy - Temporal & Refined Architecture

*   **Date:** 2026-03-10
*   **Status:** Superseded by ADR-012 and ADR-014
*   **Superseded By:** [ADR-012](#adr-012-simplified-insurance-models-strategy) and [ADR-014](#adr-014-consolidated-agency-architecture-atomic-snapshots--payment-ledger)
*   **Deciders:** Core Engineering
*   **Original Decision:**
    Introduced `RiskItem` with temporal versioning columns (`version_number`, `valid_from`, `valid_to`, `is_active`) and proposed that `PaymentAllocation` link `Payment` directly to `RiskNote`.
*   **Reason for Supersession:**
    Maintaining an active `RiskItem` table parallel to `Policy` and `RiskNote` created dual-source-of-truth bugs and complicated temporal queries. `RiskItem` was formally deprecated in ADR-012, and the system transitioned to the **Transactional Snapshot Pattern** in ADR-014 where `Policy` is a durable identity container and `RiskNote` captures transactional snapshots for covers requiring carrier cover slips (e.g., motor or domestic).

---

### ADR-005: Risk Note Backend Data Modeling and Dual-Mode Print View

*   **Date:** 2026-03-15
*   **Status:** Amended by ADR-014
*   **Amended By:** [ADR-014](#adr-014-consolidated-agency-architecture-atomic-snapshots--payment-ledger)
*   **Deciders:** Core Engineering
*   **Context:**
    Needed to evolve the Risk Note to store complex breakdown data and present it in different formats (Certificate vs. Invoice).
*   **Decision:**
    1.  Add JSON fields (`premium_breakdown`, `benefits_snapshot`, `risk_item_snapshot`) to `RiskNote`.
    2.  Implement a single print route (`/print/risk-notes/$id?mode=certificate|invoice`).
*   **Amendment Note:**
    The print view concepts and JSON breakdowns remain active. However, the premise that *"the Risk Note IS the Invoice"* was superseded: invoicing is now decoupled into distinct `Invoice`, `InvoiceBatch`, and `Statement` models per Master Baseline §4.9–§4.11.

---

### ADR-006: Refined Semantic Document Rendering

*   **Date:** 2026-03-20
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Context:**
    Visual consistency and accessibility of document tables needed standardization.
*   **Decision:**
    Convert label columns from `<td>` to `<th scope="row">` for semantic structure. Combine static product template data (`product.form_schema`) with captured instance data (`risk_details`) using uniform bordered styling.
*   **Consequences:**
    *   **Positive:** Standardized document presentation and professional print rendering.

---

### ADR-007: Navigation Architecture Upgrade and Breadcrumb Implementation

*   **Date:** 2026-03-25
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Context:**
    Deeply nested views (policies under clients) caused loss of navigational context.
*   **Decision:**
    Install Shadcn Breadcrumb component, centralize header logic in `Header.tsx`, and refactor client/policy tabs to **true nested TanStack routes** (e.g. `/clients/$clientId/policies/$policyId`).
*   **Consequences:**
    *   **Positive:** Direct deep-linking, meaningful browser history, robust context awareness.

---

### ADR-008: Document & Payment System Strategy (Refined)

*   **Date:** 2026-03-28
*   **Status:** Superseded by ADR-014
*   **Superseded By:** [ADR-014](#adr-014-consolidated-agency-architecture-atomic-snapshots--payment-ledger)
*   **Deciders:** Core Engineering
*   **Context:**
    Attempted to refine document viewing and decoupled invoicing logic.
*   **Original Decision:**
    Proposed a `Receipt` model to track client payments and linked `Invoice` by aggregating pending balances from Risk Notes.
*   **Reason for Supersession:**
    Superseded by Master Baseline §4.7, §4.9, and §18.3:
    1. Invoices are issued when cover is granted, not by aggregating pending balances.
    2. Client payments are recorded as `PaymentRecord` and allocated to invoices via `PaymentAllocation` with strict database locking invariants.
    3. Evidentiary documents (`proof_of_payment` and `insurer_receipt`) are separated from cleared cash entries.

---

### ADR-009: Risk Note Refinement & Data Seeding Strategy

*   **Date:** 2026-04-02
*   **Status:** Amended by ADR-014
*   **Amended By:** [ADR-014](#adr-014-consolidated-agency-architecture-atomic-snapshots--payment-ledger)
*   **Deciders:** Core Engineering
*   **Decision:**
    Group fields by semantic `category` in `form_schema` and render via dynamic sections.
*   **Amendment Note:**
    Dynamic categorization logic remains active. However, `items_snapshot` was superseded by the structured `cover_snapshot` and `financial_breakdown` fields, and Risk Note generation is now governed by product-specific trigger rules (§4.8).

---

### ADR-010: Risk Note Refinement Strategy - Composable & Dynamic Layouts

*   **Date:** 2026-04-10
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Decision:**
    Build Risk Notes using atomic row/section components driven by `Product.form_schema` to decouple business logic from presentation. Automatically generate initial "New Business" Risk Notes upon policy inception.

---

### ADR-011: Semantic & Flexible Document Layouts Strategy

*   **Date:** 2026-04-15
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Decision:**
    Support three section layout modes (`TABLE`, `LIST`, `BLOCK`) defined in `Product.section_configs`. Mandate HTML `<table>` elements over CSS Grid for print layout stability and PDF generation fidelity.

---

### ADR-012: Simplified Insurance Models Strategy

*   **Date:** 2026-10-10
*   **Status:** Amended by ADR-014
*   **Amended By:** [ADR-014](#adr-014-consolidated-agency-architecture-atomic-snapshots--payment-ledger)
*   **Deciders:** Core Engineering
*   **Context:**
    The `RiskItem` layer was recognized as overly complex, redundant, and error-prone.
*   **Decision:**
    Formally deprecate the `RiskItem` model and all associated relationships.
*   **Amendment Note:**
    The deprecation of `RiskItem` was accepted and stands. However, the proposal to merge cover-specific details directly into `Policy` was amended: `Policy` remains purely a durable identity container, while transactional details are captured in versioned `PremiumCalculation` runs and, where required by the product class (e.g., motor or domestic), frozen `RiskNote` cover snapshots. Medical policies do not generate Risk Notes.

---

### ADR-013: Unified Document Upload & Management Strategy

*   **Date:** 2026-10-15
*   **Status:** Accepted
*   **Deciders:** Core Engineering
*   **Decision:**
    1.  Create reusable `FileUpload` component with drag-and-drop and validation.
    2.  Implement `UnifiedDocumentManager.tsx` using `useDocuments()`, `useUploadDocument()`, and `useDeleteDocument()`.
    3.  Integrate in-app lightbox modal (`DocumentViewerModal`) for immediate previews of PDFs and images.
*   **Status in Codebase:** Active and fully implemented in `frontend/src/components/Common/UnifiedDocumentManager.tsx`.

---

### ADR-014: Consolidated Agency Architecture, Atomic Snapshots & Payment Ledger

*   **Date:** 2026-10-18
*   **Status:** Accepted (Authoritative Master Baseline)
*   **Deciders:** Core Engineering & Product Owner
*   **Cross-Reference:** [docs/insurance_agency_system_documentation.md §18](./insurance_agency_system_documentation.md)
*   **Context:**
    Following the October 2026 specification review, the system architecture required a single, unified baseline reconciling domain models, accounting rules, asynchronous job contracts, and operational invariants for a Kenyan insurance agency.
*   **Decision:**
    1.  **Policy Container & Transactional Snapshots:**
        *   `Policy` is strictly a durable identity container (`policy_number`, `client_id`, `product_id`, `status`, `inception_date`).
        *   `RiskNote` is a transactional overview document generated specifically for product lines that require carrier cover slips (such as Motor or Domestic); policies like **Medical never use a Risk Note**.
        *   When generated, `RiskNote.cover_snapshot` and `financial_breakdown` capture an immutable overview of agreed terms and calculations for that transaction event. The pricing authority remains the versioned `PremiumCalculation`.
        *   Motor vehicle assets are modeled via the relational `Vehicle` model.
    2.  **Payment & Allocation Ledger & Spreadsheet Reconciliation (§4.9, §18.3):**
        *   HealthWatch MS does not implement a full general ledger, automated bank feeds, or gateway integrations; account reconciliation was historically maintained in comprehensive agency spreadsheets.
        *   The system provides a bounded, rock-solid ledger to feed these spreadsheets:
            *   `PaymentRecord` manually captures cleared funds in positive whole-KES amounts.
            *   `PaymentAllocation` applies funds to specific invoices under database lock, enforcing:
                $$\sum \text{PaymentAllocation.amount} \le \text{PaymentRecord.amount}$$
            *   Client `proof_of_payment` (M-Pesa slips, bank receipts) is unverified evidence and does not alter invoice balances.
            *   Carrier `insurer_receipt` is a formal receipt from the insurer confirming funds remittance, signaling **active cover** and **commission eligibility**.
            *   Structured ledger and statement exports feed agency reconciliation spreadsheets without manual re-entry.
    3.  **Dedicated Renewal State Machine & Concurrency (§4.6, §18.1):**
        *   6 business states: `awaiting_carrier` ➔ `carrier_received` ➔ `client_invited` ➔ `paid` ➔ `completed` (plus `changes_requested`).
        *   Optimistic Concurrency Control using `version: int` returning `HTTP 409 Conflict`.
        *   PostgreSQL partial unique index enforcing **at most one active renewal per policy**.
    4.  **Deterministic Advisory Rating Engine (§4.14, §4.15):**
        *   `RateTableVersion` lifecycle (`draft` ➔ `published` ➔ `retired`). Published versions are frozen.
        *   Three supported pricing methods: Motor bracketed %, Domestic multi-component, Medical fixed-price tiers.
        *   `PremiumCalculation`: Persisted, immutable calculation run linked to invitations, risk notes, and invoices. Missing or ambiguous rates strictly block calculation.
    5.  **Asynchronous Document Pipeline & Snapshot-Before-Enqueue (§7, §9):**
        *   Endpoints return `202 Accepted` with durable `DocumentJob` tracking (`pending`, `processing`, `succeeded`, `failed`) and `Idempotency-Key` headers.
        *   Input snapshots are frozen in the database before the background worker is enqueued.
        *   Statements use the no-stub exception: no `Statement` row is created until PDF rendering and storage succeed.
    6.  **Strict Immutability & Deletion Policy (§18.9):**
        *   No hard deletes on financial, transactional, calculation, or audit records.
        *   Corrections are recorded as append-only reversal records, supersessions, or successor versions.
*   **Rationale:**
    Eliminates data synchronization bugs, enforces strict financial precision, prevents race conditions, and aligns software models directly with the real-world operational workflows of an insurance agency.
*   **Consequences:**
    *   **Positive:** Zero state drift, auditable financial ledgers, reproducible rating calculations, rock-solid concurrency safety, and a single source of truth across documentation, backend, and frontend.

---

### ADR-015: Motor Risk Note Operational Lifecycle, Valuation Authority & Cancellation Invariants

*   **Date:** 2026-10-19
*   **Status:** Accepted
*   **Deciders:** Core Engineering & Product Owner
*   **Cross-Reference:** [docs/insurance_agency_system_documentation.md §4.8, §18.5](./insurance_agency_system_documentation.md)
*   **Context:**
    Review of real-world Kenyan agency operations highlighted discrepancies in how motor policy inception, vehicle valuations, renewals, and cancellations were specified:
    1.  Motor onboarding begins with an **Acquisition Form** and provisional instructions to the insurer (e.g., requesting a 1-month temporary cover note while awaiting certified valuation), rather than locking in a definitive Risk Note immediately on day 1.
    2.  Agencies do **not** calculate programmatic vehicle depreciation; valuation is an external certified appraisal conducted annually (or biennially under carrier exceptions like Old Mutual).
    3.  Renewals follow an agent evaluation cycle: referencing the **previous Risk Note** as the historical baseline to review the incoming insurer renewal invitation, negotiating away carrier loading fees, preparing the **Agency Renewal Invitation**, and generating the **Renewal Risk Note** from the settled agency invitation.
    4.  Cancellations strictly **never** produce Risk Notes. Mid-term policy termination is verified and recorded via the carrier's **Cancellation Certificate** and credit note.
*   **Decision:**
    1.  **Excise `CANCELLATION` from `TransactionType`:** Risk Note transaction types are strictly `NEW_BUSINESS`, `RENEWAL`, and `ENDORSEMENT`. Mid-term policy cancellations operate at `PolicyStatus.CANCELLED` and attach the carrier's Cancellation Certificate as a `Document` record.
    2.  **Valuation Authority & UI Visibility Rule:** Prohibit internal programmatic depreciation formulas. Vehicle sum insured is updated only from certified valuation reports or agreed carrier schedules. `last_valuation_date` is tracked on the `Vehicle` model and displayed on the **Policy management page** in the UI, but is **strictly omitted from the printed Risk Note document**.
    3.  **Renewal Evaluation Sequence:** Model `previous_risk_note_id` as the historical reference benchmark used during renewal triage against the carrier's renewal notice. The Renewal Risk Note is populated directly from the agency's settled renewal invitation (which includes carrier-specific valuation disclaimers).
    4.  **Acquisition Staging:** Instructions to the insurer (1-month binder vs. annual cover) are captured directly as an integral part of the **Acquisition Form**. Transferred business ("placed under HealthWatch") is supported by carrier appointment letters filed under `Document`.
    5.  **Multi-Vehicle Policies (One Policy, One Risk Note):** Policies with multiple vehicles generate **one single Risk Note** consolidating all covered vehicles into a single schedule and aggregating statutory financial totals.
    6.  **One-Page Document Standard:** Risk Notes follow the canonical 2-column schedule format (~25% label column, ~75% details) and must strictly fit on **a single A4 page** (`210mm × 297mm`) with `10mm 12mm` margins and zero artificial print padding.
    7.  **Decoupled Post-Renewal Invoicing:** Client invoices are raised **after renewal** when cover terms are settled, decoupled from immediate Risk Note generation.
*   **Consequences:**
    *   **Positive:** Eliminates domain confusion around "Cancellation Risk Notes", accurately reflects agency valuation practices, establishes deterministic 1-page print standards, and preserves faithful audit trails of renewal negotiations and carrier cover slips.
