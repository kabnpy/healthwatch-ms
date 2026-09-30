# New Planning Document Process

This document outlines the structured process for creating and managing planning documents within the project, ensuring clarity, consistency, and proper archiving.

## 1. Architectural Decisions (ADRs)

*   **What it is:** A significant design choice, constraint, or change that impacts multiple parts of the system, involves major trade-offs, and has long-term implications. Examples include core data model changes, technology stack choices, fundamental system integrations, or major structural refactorings.
*   **Where it goes:** All ADRs are consolidated into `planning/architecture_decision_records.md`.
*   **How to create:** When a new architectural decision needs to be made or documented, add a new entry to `planning/architecture_decision_records.md` using the provided template within that file. Ensure it clearly states the context, the decision made, alternatives considered, the rationale behind the chosen solution, and its positive/negative consequences.
*   **Lifecycle:** Once an ADR is accepted and its implementation is complete, its status within the `architecture_decision_records.md` document should be updated accordingly (e.g., "Accepted", "Superseded").

## 2. Feature Plans / Detailed Implementation Strategies

*   **What it is:** A detailed plan for implementing a specific feature, UI/UX refinement, or module-specific business logic. This includes granular tasks, component designs, frontend/backend integration details, or step-by-step implementation. These are typically short-to-medium term plans.
*   **Where it goes:** Create a new markdown file within a dedicated subdirectory: `planning/active_plans/your_feature_name.md`. The `active_plans` directory signifies ongoing or upcoming feature work.
*   **How to create:** Use a clear, descriptive title. Outline objectives, break down the work into measurable tasks, specify any relevant UI/UX considerations, and define verification steps.
*   **Lifecycle:** Once the feature described by the plan is fully implemented, reviewed, and its architectural implications (if any) are captured in an ADR, the `.md` file should be moved from `planning/active_plans/` to `planning/archive/`.

## 3. High-Level Project Status & Next Steps

*   **What it is:** A concise overview of the project's current state, key milestones achieved at a high level, ongoing initiatives, and immediate next actions. This document is intended for quick team alignment and should be easily digestible.
*   **Where it goes:** `planning/status.md`
*   **How to update:** Keep this document brief and high-level. Summarize completed work with key milestones. Detail immediate next steps. **Avoid granular implementation details or extensive task lists here; those belong in feature plans (`active_plans/`) or issue trackers.**

## 4. Minor Fixes / Tactical Notes / Brainstorming

*   **What it is:** Very small bug fixes, quick tactical adjustments, or initial brainstorming ideas that do not warrant a full feature plan or ADR.
*   **Where it goes:** These should ideally be captured directly in issue tracker comments, pull request descriptions, or discarded if they do not evolve into a formal plan. **Avoid creating new `.md` files directly in `planning/` for these minor items.**

## 5. Project Documentation (`docs/` directory)

*   **What it is:** Comprehensive, high-level documentation describing the product vision, overall technical architecture, detailed backend data models, and the development roadmap. These documents serve as foundational knowledge for the project.
*   **Where it goes:** `docs/` directory.
*   **Purpose:** To provide descriptive overviews and specifications of the system's design and evolution, rather than logging specific decisions or detailed implementation steps. These are living documents that may be updated as the project evolves, but they represent the current state of the system's design and plan.
*   **Distinction from ADRs:** While `docs/` may contain architectural information (e.g., `02_tech_architecture.md`), it provides a broader overview. Specific architectural *decisions* (with alternatives and rationale) are recorded in `planning/architecture_decision_records.md`.

By following this process, we aim to keep the `planning/` directory organized, relevant, and easy to navigate.
