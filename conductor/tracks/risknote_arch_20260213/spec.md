# Specification: RiskNote-First Architecture & Document Generation

## Overview
Implement a "RiskNote-First" architecture where the `Policy` acts as a lightweight container and the `RiskNote` serves as the immutable source of truth for all coverage, premium, and risk data. The system will mirror physical insurance office files, prioritizing transaction-based updates (Endorsements, Renewals) over direct edits. A key feature is the document-style rendering of RiskNotes to provide a professional, "printed" look for users.

## Functional Requirements

### 1. Data Models (SQLModel)
- **Policy**: Lightweight container storing `id`, `policy_number`, `client_id`, `product_id`, `inception_date`, and `status`. It will have NO coverage or premium data.
- **RiskNote**: Immutable transaction records.
    - Fields: `risk_note_number`, `policy_id`, `transaction_type` (New Business, Renewal, Endorsement, Cancellation).
    - `policy_snapshot` (JSON): Stores the full risk object (e.g., Vehicle Reg, Value) based on the Product's JSON Schema.
    - Financials: `net_premium`, `levies` (JSON), `commission_amount`, `total_premium`.
    - Dates: `effective_date`, `coverage_start`, `coverage_end`.
- **Product**: Stores `name`, `description`, and a `json_schema` for the dynamic risk details.

### 2. Business Logic
- **Kenya Levies Calculation**: 
    - Training Levy: 0.2% of Net Premium.
    - PHCF (Policy Holders Compensation Fund): 0.25% of Net Premium.
    - Stamp Duty: KES 40.00 (Fixed).
- **Immutability**: RiskNotes cannot be updated. Any change triggers a NEW RiskNote creation (Endorsement/Renewal).

### 3. API Integration
- `GET /policies/{id}`: Must include the `current_risk_note` embedded in the response.
- `POST /risknotes`: Create new transaction records, automatically calculating levies and net premium.

### 4. Frontend UI/UX
- **Document Rendering**: The Policy view will render the latest RiskNote in a structured table layout mirroring a physical document, including:
    - Insured details (Name, Address, KRA PIN).
    - Class of Insurance and Policy Number.
    - Cover Details (Comprehensive, Third Party, etc.).
    - Specific Risk Details (e.g., Vehicle Reg, Make, Year, Value for Motor).
    - High-End Benefits & Limits (Windscreen, Towing, etc.).
    - Excess details and Special Clauses.
    - Premium breakdown table.
- **Mutation Workflow**: Replace "Edit" with [Endorse], [Renew], and [Cancel] buttons.
- **History Sidebar**: A timeline of all RiskNotes for a policy, allowing "Time Travel" to view previous versions in read-only mode.

## Non-Functional Requirements
- **Strict Typing**: All monetary values must use `Decimal(15, 2)`.
- **Search Optimization**: Composite index on `RiskNote(policy_id, effective_date DESC)`.

## Acceptance Criteria
- Navigating to a policy immediately displays the latest RiskNote in a document-like format.
- Clicking "Endorse" pre-fills a form with the current snapshot data but creates a new record on save.
- Kenya Levies are automatically and accurately calculated upon RiskNote creation.
- The history sidebar correctly loads and displays past RiskNote snapshots.
