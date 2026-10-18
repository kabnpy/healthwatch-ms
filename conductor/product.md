# Initial Concept
A lightweight, purpose-built management system designed for a small insurance agency (up to five users). The platform centralizes client management, policy administration, and claims handling — streamlining the day-to-day operations of an agency that acts as an intermediary between clients and insurance companies.

# Product Definition: HealthWatch MS

## 1. Vision & Purpose
A single platform where the agency can:
- Manage Clients — maintain a structured client database with contact details, relationship history, and status. A single client can hold multiple active policies across different insurance classes (e.g. motor, medical, fire, etc.), each tracked independently.
- Store & Manage KYC Documents — attach and organize compliance documents per client (e.g. KRA tax certificates, logbooks, ID documents, and other relevant paperwork).
- Track Policies — record and monitor all active policies across multiple insurance companies, each with its own cover details, insurer, and renewal cycle.
- Renewal Workflow & Email Notifications — when a policy approaches expiry the team reviews the renewal notice received from the insurer, compares it against the previous cover for any changes, and confirms internally before proceeding. Once confirmed, the system generates a renewal notice email to the client detailing the amount due and payment instructions. Renewals are never fully automated — the agency always reviews before acting. we might include assignments later with agents working with particular clients.
- Manage Claims — log and track claims from submission to settlement, acting as the client's advocate with the insurer.

Out of Scope (For Now):
- Commission tracking — not a day-one requirement; can be introduced in a later phase.
- Client-facing portal — the system is entirely internal, used by agency staff only. Client communication happens via email outside the platform

## 2. Product Quality & Evolution
- **Design Philosophy:** Grounded in a "Modern and Minimal" identity, the product prioritizes professional structural patterns, such as inset layouts and layered navigation. We emphasize high-quality typography and consistent component treatments to create a focused, high-trust user experience.
- **Technical Excellence:** We prioritize **Data Integrity and Architectural Rigor**. All financial calculations are implemented with decimal precision to eliminate rounding errors. The system employs an **Atomic Snapshot** pattern where every transaction (New Business, Renewal, Endorsement) creates an immutable record of the entire cover state, ensuring a perfect audit trail without the complexity of state reconstruction.
- **Development Priority:** We utilize a **Versioned Truth** architecture. The Policy entity acts as a stable anchor, while individual Risk Notes serve as atomic snapshots of both the risk data and the financial breakdown at a specific point in time.

## 3. Core Functional Pillars
- **Client Hub:** A professional portfolio management center providing a comprehensive view of client active covers and historical data.
- **Insurance Dashboard:** A deep-dive environment for policy management, versioned history logging, and document storage.
- **Transaction Engine (Risk Notes):** Every policy change generates an immutable Risk Note snapshot. This replaces incremental deltas with full-state captures, providing instant access to past policy configurations and their corresponding financial breakdowns. This process is atomically linked to financial invoicing through a dedicated **Service Layer**.
- **Flexible Invoicing:** Risk Notes capture the financial breakdown of a transaction, which can then be explicitly converted into tax invoices. This decoupling allows for consolidated billing (one invoice for multiple risk notes) and flexible billing cycles. Access to these financial mutations is restricted via **Simplified RBAC** (Staff vs. Viewer).

## 4. Immediate Roadmap Focus
1. **System Stabilization:** Resolving any remaining edge cases in the core CRUD and transactional flows.
2. **UX Polish:** Refining the dashboard interactions, search functionality, and mobile responsiveness.
3. **Automated Testing:** Expanding E2E and integration test coverage to ensure long-term reliability.
