# Implementation Plan: RiskNote-First Architecture & Document Generation

## Phase 1: Foundation (Backend Models & Service Layer)

- [ ] Task: Implement SQLModel classes for Product, Policy, and RiskNote
    - [ ] Write unit tests for models and relationship integrity
    - [ ] Create `Product` model with `json_schema` field
    - [ ] Create `Policy` model as a lightweight container
    - [ ] Create `RiskNote` model with `policy_snapshot` (JSON) and `Decimal` financial fields
- [ ] Task: Implement Financial Calculation Service
    - [ ] Write unit tests for `FinancialService` (Training Levy, PHCF, Stamp Duty)
    - [ ] Create `backend/app/services/financial.py` to encapsulate all levy and premium logic
- [ ] Task: Create Alembic migrations for new models
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation' (Protocol in workflow.md)

## Phase 2: Backend API & Transaction Service

- [ ] Task: Implement Product CRUD and Schema Validation
    - [ ] Write unit tests for Product API
    - [ ] Implement routes for managing Products and their JSON schemas
- [ ] Task: Implement RiskNote Transaction Service
    - [ ] Write unit tests for `RiskNoteService` (Creating New Business vs Endorsements)
    - [ ] Create `backend/app/services/risknote.py` to handle snapshot validation and transaction lifecycle
- [ ] Task: Implement Enhanced Policy Detail API
    - [ ] Write unit tests for `GET /policies/{id}` with embedded RiskNote
    - [ ] Update Policy route to fetch and embed the latest active RiskNote via `RiskNoteService`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend API & Transaction Service' (Protocol in workflow.md)

## Phase 3: Frontend Document Rendering & Dynamic Forms

- [ ] Task: Implement JSON-Schema Driven Form Builder
    - [ ] Create a reusable component to render form fields based on Product `json_schema`
    - [ ] Integrate with `shadcn/ui` components
- [ ] Task: Implement Document-Style RiskNote Component
    - [ ] Create the structured table layout mirroring the provided Motor Private example
    - [ ] Ensure professional, print-friendly styling
- [ ] Task: Implement Policy View with Embedded RiskNote
    - [ ] Create the `/policies/$policyId` route
    - [ ] Integrate the Document component as the primary view
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Document Rendering & Dynamic Forms' (Protocol in workflow.md)

## Phase 4: Transaction Workflows & History Sidebar

- [ ] Task: Implement Mutation Workflows (Endorse/Renew/Cancel)
    - [ ] Create "Endorse" action that pre-fills the form with the current snapshot
    - [ ] Create "Renew" and "Cancel" workflows using the `RiskNoteService`
- [ ] Task: Implement History Timeline Sidebar
    - [ ] Create a sidebar component listing previous RiskNotes
    - [ ] Implement "Time Travel" (clicking a past record loads a Read-Only view of that snapshot)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Transaction Workflows & History Sidebar' (Protocol in workflow.md)
