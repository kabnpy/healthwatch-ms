# Implementation Plan: Client and Policy Management

This plan outlines the steps to implement the core client and policy management functionality.

## Phase 1: Backend Foundation (Models & Migrations) [checkpoint: 2c91d9a]

- [x] Task: Define SQLModel models for Client and Policy d3f7d16
    - [x] Write unit tests for model validation in `backend/app/tests/models/test_client.py` and `backend/app/tests/models/test_policy.py`
    - [x] Implement `Client` and `Policy` models in `backend/app/models/`
- [x] Task: Create and run Alembic migrations for new tables 38354f2
    - [x] Generate migration script: `docker compose watch backend exec backend alembic revision --autogenerate -m "Add Client and Policy models"`
    - [x] Apply migration: `docker compose watch backend exec backend alembic upgrade head`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend Foundation' (Protocol in workflow.md) 2c91d9a

## Phase 2: Backend API (CRUD Routes) [checkpoint: 11d60fa]

- [x] Task: Implement CRUD routes for Clients e3caaa2
    - [x] Write integration tests in `backend/app/tests/api/routes/test_clients.py`
    - [x] Implement API routes in `backend/app/api/routes/clients.py`
    - [x] Register routes in `backend/app/api/main.py`
- [x] Task: Implement CRUD routes for Policies e3caaa2
    - [x] Write integration tests in `backend/app/tests/api/routes/test_policies.py`
    - [x] Implement API routes in `backend/app/api/routes/policies.py`
    - [x] Register routes in `backend/app/api/main.py`
- [x] Task: Conductor - User Manual Verification 'Phase 2: Backend API' (Protocol in workflow.md) 11d60fa

## Phase 3: Frontend Foundation (SDK & Basic UI) [checkpoint: 554ab77]

- [x] Task: Generate updated frontend SDK f5e2111
    - [x] Run `scripts/generate-client.sh`
- [x] Task: Create basic Client listing page 35fa996
    - [x] Write Playwright tests in `frontend/tests/clients.spec.ts`
    - [x] Create route `frontend/src/routes/_layout/clients/index.tsx`
    - [x] Implement client list component with search functionality
- [x] Task: Conductor - User Manual Verification 'Phase 3: Frontend Foundation' (Protocol in workflow.md) 554ab77

## Phase 4: Full Client & Policy UI [checkpoint: 52282d2]

- [x] Task: Implement Client Detail and Policy Management UI 34e33ef
    - [x] Write Playwright tests for client details and policy CRUD
    - [x] Create route `frontend/src/routes/_layout/clients/$clientId.tsx`
    - [x] Implement components for viewing/editing client details and managing their policies
- [x] Task: Conductor - User Manual Verification 'Phase 4: Full Client & Policy UI' (Protocol in workflow.md) 52282d2
