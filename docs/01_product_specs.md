# Product Specifications: Insurance Agency Management System

> **STATUS:** Authoritative Product Baseline
> **ALIGNMENT:** Synchronized with the expanded [insurance_agency_system_documentation.md](./insurance_agency_system_documentation.md) baseline.

---

## 1. Operational Background & Vision

At HealthWatch, managing client insurance portfolios historically meant managing physical paper files. If an agent needed to know what a client was charged last year, verify endorsement terms, or inspect a client's logbook and KRA PIN certificate, someone had to walk to the filing cabinets, pull the physical folder, flip through printed pages, and scan documents again.

HealthWatch MS was built to digitize this business. It translates the real, day-to-day workflow of the agency into a clean digital workspace where an agent can pull up a client's complete portfolio, active covers, payment history, and verified documents in seconds.

### Operating Principles
- **Intermediary Agency Role:** The agency acts as an agent representing insurance policies on behalf of clients and insurance carriers. The system supports agency operations: tracking renewals, managing client documents, issuing invoices, and recording payment allocations.
- **Dedicated Carrier Liaison & Certificate Flow:** HealthWatch interfaces with dedicated contact persons and account relationship managers at major underwriting partners (e.g., Old Mutual and Britam). Proposed renewal terms, policy schedules, and digital motor certificates (DMIC) are received via direct email correspondence from these carrier representatives. Staff review and upload these authoritative documents directly into the system's Document Vault without requiring direct carrier API integrations.
- **Single-Underwriter Policy Authority:** HealthWatch places 100% of risk with a single selected insurance carrier per policy container. The agency does not participate in multi-carrier co-insurance consortia or lead/follower percentage syndication.
- **Portfolio & Vehicle Scope:** Covers individual and SME accounts, including small vehicle groupings / mini-fleets (typically 2 to 6 vehicles under a client portfolio).
- **Internal Salaried Agency Model:** HealthWatch employs full-time, salaried account managers. Commission is recognized 100% at the agency entity level; there are no freelance sub-agent commission splits or third-party producer commission ledgers.
- **Carrier Terms as Authority:** The insurer's renewal notice is the authoritative source for offered renewal terms; an agent reviews this document before preparing client invitations.
- **Deterministic Premium Calculations:** The advisory premium calculator provides verified calculations using published rate schedules and statutory levies (see [docs/07_reference_catalog_and_seeding.md](./07_reference_catalog_and_seeding.md)). Contractual terms agreed with the carrier are recorded separately.
- **Internal Staff Workspace:** Designed for authenticated agency staff to coordinate operations without spreadsheet drift or lost paperwork.


---

## 2. Terminology & Usage Guide

To maintain consistency across documentation, system code, and user interface copy, use the following terms according to their defined roles:

- **Agency:** Refers to the business organization. The system is an agency management workspace designed for agency operations.
- **Agent / Account Manager:** Refers to the staff members who manage client policies and coordinate renewals on behalf of clients and carriers.
- **Client:** An individual or business whose insurance policies are managed by the agency.
- **Portfolio:** The complete collection of active and historical policies belonging to a client.
- **Policy:** The long-lived contract container identified by the carrier's policy number. Maintains enduring identity while coverage details update over time. A policy may cover one or multiple vehicles (e.g. family or corporate fleet).
- **Vehicle:** Asset details attached to a motor policy (plate registration, make, model, year, insured value, and valuation tracking metadata: `last_valuation_date`, `valuation_report_ref`, `valuer_name`). `last_valuation_date` is visible on the Policy management page in the application UI, but is strictly omitted from the printed Risk Note document.
- **Renewal:** The workflow tracking an annual expiration cycle through its business stages (awaiting carrier terms, client invitation, payment, and completion).
- **PremiumCalculation:** A persisted, deterministic calculation run capturing exact input values, published rule versions, itemized lines, and integer KES totals.
- **Risk Note:** The generated transaction overview snapshot of coverage terms, asset details, and rating calculations prepared for sharing with the carrier. Generated only for product classes that require carrier cover slips (such as motor or domestic cover). Medical policies never use a Risk Note. Multi-vehicle policies generate **one single Risk Note** consolidating all covered vehicles. Adheres to a strict **one-page A4 schedule format** (~25% label, ~75% details). Cancellations strictly never produce Risk Notes. Pricing authority resides in the versioned `PremiumCalculation` and carrier schedules.
- **Invoice:** A financial document issued when billing a client, typically post-renewal or upon agreement. Decoupled from immediate Risk Note creation.
- **Invoice Batch:** A monthly consolidation grouping all invoices for a client within a calendar month.
- **Payment Record:** Verified, cleared funds received into the agency account, recorded with date, payment method (M-Pesa, bank transfer, cheque, financing), and transaction reference.
- **Payment Allocation:** The application of a specific amount from a payment record to an outstanding invoice.
- **Proof of Payment:** Client-supplied evidence (M-Pesa confirmations, bank slips, cheque copies, IPF forms) indicating payment has been initiated. Used to record evidence without confusing it with cleared agency funds.
- **Insurer Receipt:** The formal receipt issued by the insurance carrier confirming remittance, used as the business confirmation that coverage is in force and agency commission can be recognized.
- **Statement:** An on-demand account summary showing opening balances, chronological invoice debits, payment allocation credits, and running balances.
- **Activity:** Append-only timeline entries recording calls, emails, meetings, reminders, and notes attached to clients, policies, or renewals.

---

## 3. Core Workflows

### 3.1 New Business Workflow
1. **Acquisition & Proposal:** Agent captures customer KYC and vehicle details (registration, make, model, year, preliminary/purchase value) on the **Acquisition Form**. Crucially, the Acquisition Form captures operational instructions to the insurer (e.g., requesting a 1-month temporary cover note / binder while awaiting certified valuation, or requesting immediate annual cover for a new car).
2. **Transfer / Takeover Placement:** For policies transferring to HealthWatch from another broker or directly from a client ("placed under HealthWatch"), a formal appointment/transfer letter is addressed to the carrier and filed under policy `Document` records.
3. **Certified Valuation:** For motor policies, external certified valuation is completed (typically annual; biennial for Old Mutual), fixing the agreed sum insured.
4. **Policy Inception & Rating:** Agent creates the `Policy` container, logs the vehicle asset(s), and executes the definitive `PremiumCalculation`.
5. **Issuance:** Agent produces the Inception `RiskNote` (`new_business`) and transmits it to the insurer to bind the 12-month policy schedule. Invoices are generated post-renewal / when billing the client.

### 3.2 Annual Renewal Lifecycle
Renewals follow calendar-month periods (e.g. renewals expiring in November are initiated in late September/October). The workflow transitions through explicit business states:

```
┌────────────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│  awaiting_carrier  │ ──► │   carrier_received  │ ──► │   client_invited   │
└────────────────────┘     └─────────────────────┘     └─────────┬──────────┘
                                                                 │
                                                       (Client requests edits)
                                                                 ▼
                                                       ┌────────────────────┐
                                                       │ changes_requested  │
                                                       └─────────┬──────────┘
                                                                 │ (Re-agreed)
                                                                 ▼
┌────────────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│     completed      │ ◄── │        paid         │ ◄───┤   client_invited   │
└────────────────────┘     └─────────────────────┘     └────────────────────┘
```

1. **Initiation (`awaiting_carrier`):** Agent initiates renewal ~30 days prior to expiry. The system enforces **at most one active renewal per policy**.
2. **Carrier Document Review (`carrier_received`):** Agent reviews the insurer's renewal notice against the expiring **previous Risk Note** (historical benchmark) to detect rate hikes or carrier loading fees, negotiating unjustified penalties away with the underwriter.
3. **Invitation Preparation (`client_invited`):** Agent selects a valid `PremiumCalculation` representing agreed terms and generates the client invitation. For motor policies, the invitation dynamically incorporates the carrier-specific valuation disclaimer (annual valuation required vs. Old Mutual 2-year validity). Medical invitations are kept separate from general policies.
4. **Negotiation (`changes_requested`):** If client requests term adjustments, the conversation is logged in the Activity Timeline, a new calculation is run, and the renewal returns to `client_invited`.
5. **Payment Evidence & Recording (`paid`):** Agent logs client proof of payment and creates a `PaymentRecord`. A renewal moves to `paid` once payment evidence/record is established.
6. **Completion (`completed`):**
   - **Immediate Terms:** Completed once payment conditions are satisfied.
   - **Deferred Payment:** In the initial release, deferred payments do not introduce a separate formal workflow state (§19.3). Exceptional instructions are recorded as an internal Activity with author, timestamp, and context.
   - **Post-Completion:** Updates policy current cover dates and generates completion artifacts: the Renewal `RiskNote` (populated from the settled agency invitation and sent to the carrier) and client `Invoice` (issued post-renewal when billing the client account).

### 3.2.1 Rating Paradigms: Asset-Based Valuation vs. Defined-Benefit Medical Tiers

Insurance rating in the agency divides into two distinct operational paradigms:

#### 1. Asset / Sum-Insured Valuation (General Insurance: Motor, Domestic, Fire)
- **Principle of Indemnity:** The client insures a tangible physical asset to restore it to its financial condition immediately prior to a loss.
- **Rating Base:** The policy premium is calculated as a percentage of the declared asset value (**Sum Insured**):
  $$\text{Base Premium} = \max(\text{Sum Insured} \times \text{Rate \%}, \text{Minimum Premium})$$
- **Product Classes:**
  - **Motor Comprehensive & Mini-Fleets:** Bounded value brackets (e.g., up to KES 1.5M, 1.5M–3M, above 3M) with escalating minimum premiums, plus optional add-on riders (Excess Protector, Political Violence & Terrorism/PVT, Courtesy Car, Road Rescue). Mini-fleets group 2 to 6 vehicles under one client portfolio.
  - **Motor Third Party Only (TPO):** Mandatory statutory cover under the Insurance (Motor Vehicles Third Party Risks) Act (Cap 405, Laws of Kenya). Provides third-party bodily injury/death indemnity and third-party property damage (standard statutory limit KES 3,000,000 up to KES 20,000,000), with zero own-damage or theft protection for the insured vehicle.
    - *Rating Base:* **Independent of vehicle market value or sum insured.** Rated as a **fixed annual tariff** based strictly on vehicle usage classification (e.g., Private Motorcars: flat KES 7,500–9,500/year; Commercial Own Goods: flat KES 10,000–15,000/year; Boda-Boda: flat KES 3,000–5,000/year; PSV/Taxi: flat base plus Passenger Legal Liability / PLL per licensed passenger seat).
    - *Levies:* Subject to standard 0.20% ITL, 0.25% PHCF, and KES 40.00 Stamp Duty.
  - **Domestic Package (Homeowners/Tenants):** Multi-component calculation evaluating Buildings (typically 0.10%–0.15%), Household Contents (0.75%–1.0%), Portable Valuables / All Risks (1.5%–2.0%), and Domestic Servant Liability / WIBA (flat fee per employee).
  - **Commercial Fire & Special Perils:** Sums insured on Buildings, Plant & Machinery, and Stock in Trade. Rated on basic fire percentage (0.125%–0.20%) plus special perils extension (earthquake, flood, riot/strike ~0.05%), subject to minimum premium (typically KES 15,000).
  - **Burglary & Theft (Commercial):** Protects business stock, fixtures, and tools against forcible, violent entry/exit. Rated on declared stock or first-loss limit (0.50%–1.00%), minimum premium (typically KES 10,000).
  - **Standalone All Risks:** Worldwide or Kenya-wide coverage for high-value portable equipment (laptops, cameras, surveying gear, jewelry). Rated as a percentage of itemized declared inventory (1.50%–2.00%), minimum premium (typically KES 5,000).

#### 2. Defined-Benefit Tiers & Demographic Census (Healthcare / Medical Insurance)
- **Principle of Defined Benefits:** Human health is not an asset with a replacement cash value. Instead, clients purchase pre-packaged limits of medical care.
- **Rating Base:** Calculated from preset actuarial rate cards based on **Cover Tiers** and a **Demographic Census** (family size and age brackets):
  - **Core Inpatient Cover:** The mandatory base tier defining the maximum annual hospitalization limit (e.g., Tier A: KES 500,000; Tier B: KES 1,000,000; Tier C: KES 2,000,000; Tier D: KES 5,000,000). The base price is determined by:
    - Principal Member age bracket (e.g., 18–30, 31–40, 41–50, 51–60, 61–65).
    - Spouse age bracket.
    - Children count (flat per-child rate or bundled family categories M+0, M+1, M+2, M+3, M+4+).
  - **Optional Outpatient Add-on:** Can only be purchased in conjunction with Inpatient cover. Features preset limits (e.g., KES 50,000, 100,000, 150,000) with fixed premiums per age/family tier.
  - **Specialist Benefit Riders:** Fixed-price optional options:
    - *Maternity Benefit:* Preset sub-limit (e.g., KES 100,000) with a standard 10–12 month waiting period.
    - *Dental & Optical:* Preset sub-limits (e.g., KES 20,000 or 30,000 each) with flat annual fees.
    - *Last Expense / Funeral Cover:* Fixed lump-sum payout upon member demise.
  - **Pre-existing & Chronic Conditions:** Either subject to a sub-limit and waiting period or accepted with an underwriter loading percentage.

#### 3. Declared Wage-Roll Schedules (WIBA / Work Injury Benefits Act)
- **Principle of Statutory Workplace Indemnity:** Covers employee death, injury, and occupational disease under the Kenyan Work Injury Benefits Act 2007.
- **Rating Base:** The policy premium is calculated directly against the client's declared annual wage roll categorized by employee risk classification:
  - *Clerical / Administrative Staff:* Low hazard, baseline rate ~0.50%.
  - *Skilled / Technical / Artisans:* Moderate hazard, baseline rate ~1.50%.
  - *Hazardous / Industrial Workers:* High hazard, baseline rate ~3.50%.
  - Subject to mandatory underwriter minimum premium (typically KES 25,000).
- **HealthWatch Operational Workflow:** Clients supply schedules with employee payrolls. The agency uses those declared payroll values as-is for quote-to-bind and inception. For annual renewals, if the client does not request adjustments, current payroll values are carried directly into the renewal invitation and agreed terms without complex retrospective audit friction.

#### 4. Liability Lines: Limit of Indemnity (Professional Indemnity & Public Liability)
- **Principle of Third-Party Legal Defense & Indemnity:** Covers financial damages or legal liabilities arising from business operations or professional advisory services.
- **Rating Base:**
  - **Professional Indemnity (PI):** Rated on declared Limit of Indemnity (e.g., KES 10M, 20M, 50M) and profession/practice fee turnover. Standard protection for accountants, advocates, medical practitioners, and corporate consultants.
  - **Public Liability (PL):** Rated on Limit of Indemnity and premises/business hazard classification, covering third-party bodily injury and property damage occurring on the insured's commercial premises.

#### 5. Packaged & Defined-Benefit Retail Lines (Personal Accident & Golfers Insurance)
- **Personal Accident (PA):** Protects against accidental injury or death. Benefits include Capital Sum Insured for Accidental Death, Permanent Total Disablement (PTD), Accidental Medical Expenses reimbursement, and Last Expense. Rated as a fixed annual package based on occupational risk category (Class 1: Clerical/indoor, Class 2: Supervisory/light manual, Class 3: Hazardous/heavy manual).
- **Golfers Insurance:** A standard Kenyan specialty retail package covering:
  - *Section 1 - Golfing Equipment:* Loss, theft, or damage to clubs and golf bag.
  - *Section 2 - Personal Effects:* Personal belongings stored in the clubhouse locker.
  - *Section 3 - Third-Party Liability:* Bodily injury or property damage caused to third parties while playing or practicing golf.
  - *Section 4 - Personal Accident:* Compensation for accidental death or injury to the player while on any recognized golf course.
  - *Section 5 - Hole-in-One:* Reimburses celebratory traditional bar expenses incurred at the 19th hole upon achieving an official, certified Hole-in-One.
  - *Rating:* Flat tiered annual package fee (typically KES 5,000 to KES 12,000 per year).

#### 6. Statutory Levies & Taxes (Unified Across All Lines)
Mandated by the Insurance Regulatory Authority (IRA) of Kenya:
- **Insurance Training Levy:** 0.2% of net base premium.
- **Policyholders Compensation Fund (PHCF):** 0.25% of net base premium.
- **Stamp Duty:** Flat KES 40.00 per policy.
*(Note: Medical insurance premiums are exempt from Value Added Tax).*

#### 7. Unified Persisted Artifact: `PremiumCalculation`
Regardless of whether pricing is driven by a vehicle's market value, a family's medical census, a declared payroll schedule, a professional indemnity limit, or a fixed golfers package, the rating engine produces the exact same deterministic, immutable [`PremiumCalculation`](./03_backend_data_models.md#premiumcalculation-persisted-calculation-run) snapshot. Every line item is itemized, auditable, and rounded to integer KES.


### 3.3 Payments, Allocations & Statements
- **Payment Recording:** Agents record payment instruments (`PaymentRecord`) with amount, payment method (M-Pesa, cheque, bank transfer, IPF, cash), and reference.
- **Allocation:** Agents allocate payment amounts to outstanding invoices (`PaymentAllocation`). Multiple payments can fund one invoice; one payment can fund multiple invoices.
- **Reversals:** Committed payments or allocations cannot be edited or hard-deleted. Corrections are append-only reversal records that restore balances.
- **Statements:** Reconciled on demand from issued invoices and net active payment allocations. Unallocated payment amounts are displayed separately as unapplied funds.
- **Spreadsheet Reconciliation Alignment:** Full multi-account banking and carrier commission reconciliation was historically managed in comprehensive agency spreadsheets. The system does not attempt to automate full general ledger or bank feed reconciliation. Instead, it enforces strict transactional integrity across receivables and cleared payments, providing exportable, structured tabular ledger data that directly feeds and reconciles with agency accounting spreadsheets without manual data re-entry.

### 3.4 Insurance Premium Financing (IPF) Lifecycle
In compliance with Section 156A of the Insurance Act ("Cash and Carry"), clients purchasing high-value motor or commercial policies frequently utilize tripartite financing facilities through approved commercial banks (such as NCBA, Stanbic, or Equity Bank):
- **Tripartite Facility:** Involves the Client (borrower), Financing Bank (financier), and Underwriter (insurer). The agency facilitates placement and documentation.
- **Workflow & Invariants:**
  1. **Financing Application:** Client executes an IPF contract specifying loan term (typically 4–10 months) and financier facility details.
  2. **Deposit Verification:** Client pays a mandatory initial deposit (minimum 20%) to the agency or underwriter, recorded via `PaymentRecord`.
  3. **Commitment Letter:** The financing institution issues a formal irrevocable bank commitment guarantee.
  4. **Cover Inception:** Under Section 156A, the verified bank guarantee legally satisfies the statutory requirement for risk assumption, permitting policy inception or renewal completion prior to actual disbursement of funds.
  5. **Disbursement Tracking:** Bank remits loan balance directly to the underwriter or agency, matched against the outstanding invoice balance.

### 3.5 Outward Carrier Commission & Remittance Ledger
To eliminate double-entry in external agency spreadsheets, the system computes the agency's outward financial obligations and revenue recognition:
- **Statutory Commission Caps:** Commission rates comply with the Insurance Act (Cap 487) schedules (e.g., 10% on motor private, 15% on fire, 20% on domestic package).
- **Automated Calculation Sequence:**
  - $\text{Gross Agency Commission} = \text{Net Premium} \times \text{Commission Rate}$
  - $\text{Withholding Tax (WHT)} = \text{Gross Agency Commission} \times 0.05$ (5% statutory deduction at source)
  - $\text{Net Commission Due} = \text{Gross Agency Commission} - \text{Withholding Tax}$
  - $\text{Net Carrier Remittance} = \text{Gross Invoice Total} - \text{Net Commission Due}$
- **Remittance Summaries:** Generates exportable monthly carrier remittance statements for rapid reconciliation against insurer credit notes.

### 3.6 Claims Advocacy & Policy Lifecycle
Client retention across renewal cycles is directly influenced by the agency's advocacy during loss events:
- **Claims Registry:** Lean `Claim` entity linked to `Policy`, `Client`, and asset records.
- **Operational Lifecycle:**
  $$\text{intimated} \longrightarrow \text{documents_pending} \longrightarrow \text{adjuster_appointed} \longrightarrow \text{discharge_voucher} \longrightarrow \text{settled / declined}$$
- **Renewal Desk Integration:** Active claims and historical loss ratios are surfaced directly on the Renewals Desk. Account managers review outstanding disputes or claim frequency to negotiate appropriate terms, claim-free discounts, or underwriter loadings before preparing client renewal invitations.

---

## 4. User Interface Architecture

Adheres to the density and styling guidelines in [05_design_system.md](./05_design_system.md).

### 4.1 Dashboard (Broker Command Deck)
Default landing page after login, surfacing immediate operational queues:
- Renewals awaiting carrier documents (`awaiting_carrier`).
- Renewals awaiting client invitation/response (`carrier_received`, `client_invited`).
- Renewals awaiting payment or instruction.
- Policies expiring within 30 days without an active renewal.
- Recently completed renewals.

### 4.2 Global Search (Cmd + K)
Instant omni-search accessible from anywhere in the application:
- Searches across Clients (name, phone, KRA PIN), Policies (policy number), Renewals, Vehicles (plate registration), and Documents.
- Results grouped by entity type with direct keyboard navigation.

### 4.3 Client Hub (`/clients/$clientId`)
Context-isolated 360° portfolio view:
- **Active Policies Grid:** High-density status cards with cover type, vehicle plate, insurer, and renewal status.
- **Financial Ledger & Invoices:** Tabular breakdown of issued invoices, monthly batches, payment records, and allocations.
- **Document Vault:** Centralized document viewer using `UnifiedDocumentManager` for KYC, valuation reports, and correspondence.
- **Activity Timeline:** Chronological feed of agent calls, emails, reminders, and notes.

### 4.4 Policy Detail View (`/clients/$clientId/policies/$policyId`)
- **Header:** Policy number, insurer badge, active status, current cover dates.
- **Current Cover (Risk Note Snapshot):** Displays active coverage terms, vehicle details, and premium breakdown.
- **Renewal Workspace:** Dedicated panel when a renewal is in flight, showing current step, carrier document, and receipt logging actions.
- **History Log:** Immutable archive of historical Risk Notes and prior renewal terms.
