# Implementation Plan: Railway Deployment

This plan details the steps to deploy the HealthWatch MS full-stack application to Railway.com using separate services for the backend and frontend, and a managed PostgreSQL database.

## Phase 1: Project Setup & CLI Configuration [checkpoint: 5d9c6b7]
Initial setup and linking the local environment to Railway.

- [x] Task: Install and authenticate the Railway CLI on the development machine. (manual)
- [x] Task: Create a new Railway project using the Railway CLI. (manual)
- [x] Task: Link the local repository to the newly created Railway project. (manual)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Project Setup & CLI Configuration' (Protocol in workflow.md)

## Phase 2: Database Provisioning & Configuration [checkpoint: 03fae9b]
Setting up the persistent data layer.

- [x] Task: Provision a Managed PostgreSQL database service within the Railway project. (manual)
- [x] Task: Extract the database connection string and verify connectivity from the local environment using the Railway CLI. (manual)
- [x] Task: Synchronize database environment variables (e.g., `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) with the Railway project. (manual)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Database Provisioning & Configuration' (Protocol in workflow.md)

## Phase 3: Backend Deployment & Verification [checkpoint: 569b991]
Deploying and hardening the API service.

- [x] Task: Configure all required backend environment variables in Railway (e.g., `SECRET_KEY`, `CORS_ORIGINS`). (manual)
- [x] Task: Push configuration changes to GitHub to trigger Railway backend deployment (including explicit migration and port fix). (manual)
- [x] Task: Execute database migrations against the Railway PostgreSQL instance using the backend service. (manual)
- [x] Task: Verify the backend health check endpoint on the public Railway URL. (manual)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Backend Deployment & Verification' (Protocol in workflow.md)

## Phase 4: Frontend Deployment & Verification [checkpoint: 569b991]
Deploying and connecting the UI service.

- [x] Task: Update the `VITE_API_URL` environment variable to point to the newly deployed backend public URL. (manual)
- [x] Task: Push configuration changes to GitHub to trigger Railway frontend deployment (including dynamic port fix). (ebaebc1)
- [x] Task: Verify the frontend accessibility and successful API connection on the public Railway URL. (manual)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Frontend Deployment & Verification' (Protocol in workflow.md)

## Phase 5: Integration & Final Smoke Test [checkpoint: 569b991]
Ensuring the full system is functional in production.

- [x] Task: Perform a comprehensive smoke test of the application in the production environment (Login, Policy Creation, Invoice Generation). (manual)
- [x] Task: Document the final production URLs and any environment-specific maintenance procedures. (manual)
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Integration & Final Smoke Test' (Protocol in workflow.md)
