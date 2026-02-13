# Specification: Client and Policy Management

## Overview
This track implements the foundational features for an insurance agency management system: managing clients and their associated insurance policies.

## User Stories
- As an agent, I want to create and manage client profiles so I have a centralized record of all my clients.
- As an agent, I want to associate multiple insurance policies with a client to track their coverage.
- As an agent, I want to view a list of all clients and search for specific ones.
- As an agent, I want to view the details of a specific client, including all their policies.

## Functional Requirements
- **Client Management:**
    - Create, Read, Update, and Delete (CRUD) operations for clients.
    - Client fields: Name, Email, Phone, Address, Date of Birth.
- **Policy Management:**
    - CRUD operations for policies associated with a client.
    - Policy fields: Policy Number, Type (e.g., Health, Life, Auto), Provider, Start Date, End Date, Premium Amount, Status (Active, Expired, Cancelled).
- **Search & Filtering:**
    - Search clients by name or email.
    - Filter policies by type or status.

## Technical Constraints
- Backend: FastAPI with SQLModel and PostgreSQL.
- Frontend: React with TanStack Router and Query.
- Styling: Tailwind CSS and shadcn/ui.
- Testing: Pytest for backend, Playwright for frontend.
