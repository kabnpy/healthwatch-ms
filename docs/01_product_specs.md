# Product Specifications: Insurance Management System

## 1. Product Vision
An audit-grade, high-density insurance brokerage workspace designed for professional underwriters and account managers. It unifies Client Management, Policy Administration, and Financial Invoicing into a context-isolated hierarchy (see [05_design_system.md](./05_design_system.md) for authoritative design specifications).

## 2. Core Entities & Terminology
- **Client:** The customer. Identified by KRA PIN and Contact Info.
- **Insurance (Policy):** A container for a specific cover (e.g., "Motor Private - KCA 123B").
  - *Note:* While the DB table is `Policy`, the UI refers to them as "Covers" or "Insurances".
- **Risk Note:** The dual-purpose core document.
  - **Overview:** Give a summary of the policy document, it's easier to work with so it's the 'core'.
  - **Financial:** The Debit Note (Invoice).
  - **Authorship:** Must track *who* prepared the document for audit purposes.
- **Risk Item:** The asset being covered (Vehicle, Building). Supports **Temporal Versioning** (History).

## 3. Feature Specifications

### 3.1 The Client Hub (`/clients/$id`)
- **Goal:** "At a glance" portfolio view of the client's active and historical covers.
- **UI Architecture:** Structured Portfolio Grid adhering to [05_design_system.md](./05_design_system.md).
  - **Cards vs Lists:** Active covers are displayed as elevated cards with status badge, sum insured, policy period, and asset badge.
  - **Visuals:** Strict semantic status badges (Emerald for Active, Amber for Pending, Rose for Lapsed), right-aligned monospace tabular figures for premiums.
- **Logic:**
  - Clicking a card navigates to the *Insurance Dashboard*.
  - Empty state encourages "Create First Cover".

### 3.2 The Insurance Dashboard (`/insurance/$id`)
- **Goal:** Deep dive into a specific cover.
- **UI Layout:** 3-Column Dashboard with Tabbed Interface.
  - **Header:** "Motor Private (Active)" with Policy Number.
  - **Tab 1: Overview (The "Face"):** - Visual representation of the *Current* Risk Note.
    - Displays Sum Insured, Premium, and Dates clearly.
    - **Action:** "Renew" or "Endorse" (Triggers Wizards).
  - **Tab 2: History (The "Log"):** - DataTable of all previous transactions (Risk Notes).
  - **Tab 3: Documents (The "Vault"):** - List of uploaded files (Valuations, Logbooks, KYC).

### 3.3 The Transaction Engine (Risk Notes)
- **Concept:** Every change to a policy creates a NEW Risk Note.
- **Transaction Types:**
  - `New Business`: First creation.
  - `Renewal`: Extension of time.
  - `Endorsement`: Mid-term change of Asset/Value (Future Phase).
  - `Cancellation`: Early termination (Credit Note).
- **Financials:** Auto-calculation of Levies (Training Levy, PHCF, Stamp Duty) based on the Sum Insured.

### 3.4 Invoicing (Debit Notes)
- **Concept:** The Risk Note *is* the Invoice.
- **Requirement:** System must generate a printable HTML view that serves as a valid tax invoice (Debit Note).
- **Views:**
  - **Risk Note Print:** Focuses on Coverage (Dates, Clauses, Asset).
  - **Debit Note Print:** Focuses on Money (Basic + Levies = Total Due, Banking Details).

- **Authorship:** Must track *who* prepared the document for audit purposes.
- **Risk Item:** The asset being covered (Vehicle, Building). Supports **Temporal Versioning** (History).

## 3. Workflows

### 3.1 The "New Business" Flow (MVP)
1.  **Client Entry:** User adds John Doe.
2.  **Policy Creation:** User selects "Motor Private" Product. System creates a `Policy` container.
3.  **Risk Capture:** User enters Vehicle Details (`RiskItem` v1).
4.  **Transaction:** User sets Sum Insured. System calculates Premium.
5.  **Issuance:** User clicks "Generate". System creates `RiskNote` (New Business) and locks the `RiskItem`.

### 3.2 The "Endorsement" Flow (Future)
1.  **Trigger:** User views Active Policy -> Clicks "Modify Cover".
2.  **Date Selection:** User selects "Effective Date" (e.g., June 1st).
3.  **Delta Entry:** User replaces "Mazda" with "Benz".
4.  **Calculation:** System calculates Pro-Rata difference.
5.  **Issuance:** System creates `RiskNote` (Endorsement) + `RiskItem` (v2). Old `RiskItem` (v1) is expired.

### 3.3 The "Cashiering" Flow (Future)
1.  **Receipt:** Cashier receives 50k Check. Logs it in system.
2.  **Allocation:** Cashier selects "Unpaid Risk Notes" for John Doe.
3.  **Knock-off:** System links Receipt to Risk Note. Risk Note status becomes `Paid`.

## 4. User Interface Specifications

### 4.1 The Client Hub (`/clients/$id`)
- **Goal:** "At a glance" view of the client's portfolio.
- **UI Design System:** "Papermark" Grid.
  - **Cards vs Lists:** Active covers are displayed as **Cards**.
  - **Visuals:** Cards look like physical files/folders with a minimalist icon (Car/Home) and a subtle status dot.

### 4.2 The Insurance Dashboard (`/insurance/$id`)
- **Goal:** Deep dive into a specific cover.
- **UI Layout:** 3-Column Dashboard with Tabbed Interface.
  - **Tab 1: Overview:** Visual representation of the *Current* Risk Note. Action: "Renew" / "Endorse".
  - **Tab 2: History:** DataTable of all previous transactions.
  - **Tab 3: Documents:** List of uploaded files.
