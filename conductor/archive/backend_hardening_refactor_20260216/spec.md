# Specification: Backend Hardening & Navigation Refactor

## 1. Overview
This track focuses on stabilizing the backend security layer, simplifying the internal architectural structure, and aligning the frontend navigation with a client-centric hierarchy. It also includes a "de-cluttering" phase to remove the unused `Item` module.

## 2. Objectives
- **Security & Stability:** Resolve the 401 Unauthorized errors in the Policy Wizard by auditing endpoint dependencies and hardening the backend test suite with robust auth mocking.
- **Architectural Simplification:** Move from a nested submodule structure (e.g., `crud/insurance/`) to a flat structure for `models`, `schemas`, and `crud` to improve maintainability.
- **Client-Centric Navigation:** Refactor frontend routing to nest Policy views under their respective Clients, ensuring breadcrumbs follow a logical `Home > Clients > [Name] > [Policy]` path.
- **Codebase De-cluttering:** Permanently remove the `Item` model and all its associated logic across the entire stack.

## 3. Scope
- **Backend Auth:** Audit `backend/app/api/v1/endpoints/` for correct dependency injection. Update `backend/tests/` to use a centralized authenticated client helper.
- **Backend Refactor:**
    - Flatten `backend/app/models/`, `backend/app/schemas/`, and `backend/app/crud/`.
    - Delete `Item` database model, Alembic migration references, and API routers.
- **Frontend Refactor:**
    - Move policy dashboard route from `/_layout/policies.$policyId` to `/_layout/clients.$clientId.policies.$policyId`.
    - Remove all `Item` related components, hooks, and routes.
    - Update `AppSidebar.tsx` to remove the Items link.
- **Tooling:** Run `npm run generate-client` after backend changes and resolve all TypeScript errors.

## 4. Acceptance Criteria
- Policy creation via the Wizard no longer returns 401 errors.
- Backend tests pass with 80%+ coverage using the new auth mocking strategy.
- The `Item` module is completely gone from the database schema and the UI.
- Navigating to a policy correctly displays breadcrumbs that include the parent client.
- `frontend` build (`npm run build`) completes without type errors.

## 5. Out of Scope
- Introducing new insurance classes or financial logic.
- Redesigning existing UI components (beyond layout/routing changes).
