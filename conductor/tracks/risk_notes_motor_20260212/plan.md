# Implementation Plan: Insurance Risk Notes & Motor Cover Details

## Phase 1: Foundation (Client & Library Models)

- [x] Task: Update Client model with KRA PIN 31786c8
    - [x] Write unit tests for KRA PIN validation
    - [x] Implement `kra_pin` in `backend/app/models/client.py`
- [ ] Task: Implement Clause and Benefit library models
    - [ ] Implement `Clause` and `Benefit` models and CRUD
- [ ] Task: Create Alembic migrations for Client and Library models
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation' (Protocol in workflow.md)

## Phase 2: Cover Detail Schemas & Template Logic

- [ ] Task: Define Pydantic schemas for Motor Private and Motor Commercial
    - [ ] Create `backend/app/models/covers/motor.py`
- [ ] Task: Implement Template Logic (PVT/Excesses)
    - [ ] Create logic for copying library items and toggling wording (Inclusive/Exclusive)
- [ ] Task: Enhance Policy model and migrations
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Cover Detail Schemas & Template Logic' (Protocol in workflow.md)

## Phase 3: Risk Note Snapshots & Backend Integration

- [ ] Task: Implement RiskNote model and Snapshot Service
- [ ] Task: Implement Levy Calculation Logic
- [ ] Task: Implement Backend API routes for Library and Policies
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Risk Note Snapshots & Backend Integration' (Protocol in workflow.md)

## Phase 4: Frontend UI & Nested Navigation

- [ ] Task: Implement Breadcrumb Component
    - [ ] Create a reusable Breadcrumb component in `frontend/src/components/Common/`
- [ ] Task: Implement Policy Detail View with Nested Routing
    - [ ] Create route `frontend/src/routes/_layout/clients/$clientId/policies/$policyId.tsx`
    - [ ] Integrate Breadcrumbs (Home > Clients > [Client Name] > Policy [Number])
- [ ] Task: Implement Risk Note History UI
    - [ ] Create snapshot list and "View Snapshot" modal/page
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Frontend UI & Nested Navigation' (Protocol in workflow.md)
