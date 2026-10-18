# Specification: Railway Deployment

## 1. Overview
Deploy the HealthWatch MS full-stack application to Railway.com. This involves setting up a managed PostgreSQL database and two separate services (frontend and backend) within a single Railway project. Deployment and environment variable management will be handled via the Railway CLI.

## 2. Functional Requirements
- **Database:** Provision a Railway Managed PostgreSQL instance.
- **Backend Service:**
    - Deploy the FastAPI application located in `backend/`.
    - Configure the service to connect to the Railway PostgreSQL instance.
    - Set up required environment variables (e.g., `SECRET_KEY`, `POSTGRES_USER`, etc.).
- **Frontend Service:**
    - Deploy the React application located in `frontend/`.
    - Configure the frontend to point to the deployed backend API URL.
    - Ensure build and start commands are optimized for a production environment on Railway.
- **CLI Integration:** Use `railway link` and `railway up` for initial deployment and `railway variables` for secret management.

## 3. Tech Stack Details
- **Infrastructure:** Railway.com
- **Build Tool:** Nixpacks (Railway's default) or custom `Dockerfile` if necessary.
- **CLI:** Railway CLI for service and variable management.

## 4. Acceptance Criteria
- **Backend:** Accessible via a Railway-provided public URL; health check endpoint returns 200.
- **Frontend:** Accessible via a Railway-provided public URL; correctly displays data fetched from the backend.
- **Database:** Persistence verified; initial data/migrations successfully applied.
- **Overall:** A user can log in and interact with the application on the production URLs.

## 5. Out of Scope
- Automated CI/CD via GitHub Actions (to be implemented in a future track).
- Custom domain configuration (using Railway default subdomains for now).
- External monitoring tools (relying on Railway's built-in logs and metrics).
