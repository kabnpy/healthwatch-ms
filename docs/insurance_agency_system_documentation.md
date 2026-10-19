# Insurance Agency Management System

## System Specification and Implementation Baseline

**Document status:** Finalised business-rule and implementation design baseline\
**Prepared:** 18 October 2026 (Updated 19 October 2026)\
**Important:** This document defines the intended system and implementation baseline. It does not establish that any feature has already been implemented or tested. The Binding decisions section is authoritative where it defines a specific business rule.

------------------------------------------------------------------------

## 1. Executive summary

The Insurance Agency Management System is an internal web application
for HealthWatch, a Kenyan insurance agency (approximately five internal salaried agents). It
centralises client and policy records, coordinates annual renewals, records
payment evidence and cleared funds allocations, calculates deterministic premiums from validated rating rules, stores supporting
documents, and generates business documents.

The agency acts as an intermediary representing underwriters and serving client policyholders. The system does not hold or
process client funds, underwrite risk, issue policies directly, or
require direct API integrations with insurer core systems. Instead, HealthWatch interfaces with dedicated contact persons and account managers at major partner underwriters (e.g. Old Mutual and Britam). Proposed renewal terms, policy schedules, and digital motor certificates (DMIC) are received via direct email correspondence from these carrier representatives. Staff review and upload these authoritative documents directly into the system's Document Vault.

100% of policy risk is placed with a single selected underwriting carrier per policy container; the agency does not participate in multi-carrier co-insurance consortia. The system accommodates individual and SME portfolios, including small vehicle groupings / mini-fleets (typically 2 to 6 vehicles under one client portfolio).

The insurer's incoming renewal offer is preserved as the source record for what the insurer originally proposed,
but it is not automatically the final price or agreed terms. The agency
uses its validated calculator and selected transaction terms to prepare
the client-facing invitation, which an agent reviews before communicating.

The documented architecture uses a browser frontend, a FastAPI backend,
PostgreSQL, object storage, and a background worker for PDF generation.
The specification names TanStack Query and describes a React UI in the
runtime architecture. Deployment is planned for Railway, with Cloudflare
R2 for document storage.

The system includes a dashboard (Broker Command Deck), global search (Cmd+K),
a first-class activity timeline, flexible document categorisation,
immutable generated-document snapshots, and a single agency
configuration record.

## 2. Goals, scope and boundaries

### 2.1 Goals

-   Maintain centralised client, insurer, policy and vehicle records.
-   Track each renewal through explicit business states.
-   Preserve renewal history without treating a policy as a disposable
    record.
-   Record receipts and partial payments without processing payments.
-   Calculate reproducible premiums from validated, versioned insurer rating rules, applicable benefits, negotiated adjustments and taxes.
-   Generate risk notes, renewal invitations, invoices, invoice batches
    and statements.
-   Store KYC, carrier and supporting documents securely.
-   Preserve an activity timeline of calls, emails, meetings, reminders
    and notes.
-   Give agents a dashboard that highlights work requiring attention.
-   Allow agents to find clients and related records through global
    search.
-   Protect financial and identity records, prevent silent concurrent
    updates, and make background failures recoverable.

### 2.2 In scope

-   Client and policy record keeping.
-   Insurer and vehicle records.
-   Renewal pipeline management.
-   Manual recording of payment receipts.
-   Versioned premium calculation and recording of final agreed terms.
-   Document uploads and secure downloads.
-   Generated business documents.
-   Client statements and invoice batches.
-   Activity history.
-   Dashboard and global search.
-   Authentication and session management.
-   Deployment, background processing and recovery design.

### 2.3 Explicitly out of scope for the initial release

-   Client-facing portal or public registration.
-   Payment collection/processing or bank/M-Pesa integrations. Manual payment recording and allocation across invoices are in scope; these are not payment integrations.
-   Direct insurer-system integrations. Agents manually record insurer instructions, incoming offers and insurer receipts.
-   Automated renewal invitations without agent review.
-   Endorsement lifecycle and approval workflows.
-   Automatic parsing of M-Pesa confirmation messages.
-   Email delivery of generated documents, unless separately designed.
-   Multi-tenancy.

## 3. Users and operating assumptions

The primary users are brokerage agents and an administrator who
provisions accounts. The operating assumption is roughly five
agents and a small set of insurers.

All authenticated agents have the same permissions in the initial
design. The system relies on authentication rather than role-based
access control. This is a deliberate simplicity choice, but it should be
revisited if staff responsibilities diverge or if stronger separation of
duties becomes necessary.

Business rules assume that agents review carrier documents, manually
record receipts, and decide when to communicate with clients. The
application supports and records these decisions rather than replacing
them.

## 4. Core domain model

### 4.1 Client

Represents an individual or business whose insurance is managed by the
brokerage.

Key fields: - ID (UUID) - Type: `individual` or `business` - Name,
email, phone and address - KRA PIN (unique in the database schema) -
Creation timestamp

A client may have multiple policies, documents and activities.

### 4.2 Client documents

Stores KYC documents such as national ID, logbook and KRA PIN
certificates. Each record references an object-storage key, a document
type, a human-readable label and upload timestamp.

The design uses flexible document categories or tags
so that supporting documents---such as valuation reports, inspection
reports, proposal forms, insurer correspondence and payment proofs---can
be attached to clients, policies or renewals without a schema change for
every new category.

### 4.3 Insurer

Represents an insurance carrier used by the brokerage. The expected
number is small (approximately ten). Fields include ID, name and contact
information.

### 4.4 Policy

A long-lived record of a client's cover with an insurer. Renewal history
is represented by linked Renewal records; the Policy is updated with the
current cover dates when a renewal is completed.

Key fields: - Client and insurer references - Type: `motor`, `health`,
`property`, `life` or `other` - Status: `active` or `cancelled` - Start
and end dates - Agreed premium in KES - Creation timestamp

A policy is considered lapsed by derived logic when its end date is in
the past and no renewal has completed. `lapsed` is not stored as a
policy status in this specification.

### 4.5 Vehicle

Motor policy asset particulars linked to a policy. A single policy may cover one or multiple vehicles (e.g., family or fleet motor policies):

- **Key Fields:** `policy_id`, `registration_number`, `make`, `model`, `year_of_manufacture`, `insured_value` (in KES), `chassis_number`, `engine_number`.
- **Valuation Tracking:** `last_valuation_date`, `valuation_report_ref` (document/certificate reference), and `valuer_name` (e.g., Regent Valuers, AA of Kenya).
- **UI vs. Document Visibility Rule:** The `last_valuation_date` and valuation status must be displayed prominently on the **Policy Page** in the application interface so agents can immediately identify whether a re-valuation is due. However, **`last_valuation_date` is strictly NOT printed on the generated Risk Note document itself** (the risk note strictly details asset identity, current agreed sum insured, limits, excesses, and premiums).
- **Renewal Valuation Cadence & Agency Disclaimers:** Agencies bear the responsibility of checking carrier valuation requirements and advising clients during renewal:
  - **Standard Carriers (Jubilee, Britam, APA, CIC, etc.):** Valuation is mandatory annually. The client renewal invitation includes: *"Please note: Valuation is mandatory for this renewal. An insurer-approved valuation report is required prior to binding cover."*
  - **Old Mutual Exception:** Valuation is valid for up to **two years** following a certified valuation. If within the 2-year window, the client renewal invitation includes: *"Please note: Valuation is not mandatory for up to two years following your last valuation (dated [Date]). You may elect to have your vehicle revalued, but you will bear the valuation cost."*

### 4.6 Renewal

Represents one renewal cycle and owns the workflow state, renewal
period, previous and proposed premiums, proof-of-payment and insurer-confirmation events, selected terms and relevant
document references.

Statuses: 1. `awaiting_carrier` --- awaiting the insurer's incoming renewal offer. 2. `carrier_received` --- the insurer offer document is recorded and a valid pricing baseline is available. 3. `client_invited` --- the client-facing invitation has been prepared and communicated by the agent. 4. `changes_requested` --- the client has requested amendments. 5. `payment_evidence_received` --- the agent has reviewed and recorded client proof of payment, which the brokerage accepts as sufficient to instruct the insurer to renew; this status does not mean funds have cleared at the insurer or that the insurer receipt exists. 6. `renewal_requested` --- the brokerage has instructed the insurer to renew cover. 7. `completed` --- the insurer's receipt/cover confirmation has been recorded and the policy's current cover details and completion documents have been updated.

The documented happy path is:

`awaiting_carrier → carrier_received → client_invited → payment_evidence_received → renewal_requested → completed`

A client may request changes after invitation. The agent records the conversation and returns the renewal to `client_invited` once revised terms are ready. Activities record communications and contextual notes; they do not themselves create workflow statuses. The insurer receipt remains a distinct event and should be recorded against the renewal. If insurer processing or receipt is delayed, the renewal remains visibly awaiting insurer confirmation rather than being falsely marked complete.

Important renewal fields include: policy reference and status; new cover start/end dates; previous premium; incoming insurer offer document/baseline reference; selected PremiumCalculation; proposed and agreed terms snapshots; client invitation reference; proof-of-payment records and review timestamp; renewal-instruction timestamp and communication details; insurer receipt/cover-confirmation reference and timestamp; completion timestamp; notes, version number and creating agent. Deferred-payment fields and a formal deferred-payment workflow are out of scope for the initial release.

Only one active renewal should exist per policy. A partial unique index
is proposed to enforce this rule.

An agent creates a renewal manually when the policy enters the renewal preparation window, targeting approximately 30 days before expiry. The application may surface upcoming renewals, but must not autonomously initiate insurer communication. Enforce one active renewal per policy.

### 4.7 Insurer receipts and proof of payment

These are two separate document types and must not be represented by a single generic receipt record or status.

**Insurer receipt**

An insurer receipt is issued by the insurance company and confirms that the insurer has received the premium/payment. In the brokerage workflow, receipt from the insurer is the business confirmation that the cover is active and that the brokerage can recognise the policy as eligible for commission, subject to the applicable insurer and brokerage terms. This is distinct from a client's payment evidence and from an invoice or statement. Store the insurer receipt as a carrier-issued document linked to the client, policy and, where applicable, renewal. Capture available receipt number/reference, issue/received date, amount and currency, insurer, file key, notes, recording agent and timestamp. The presence of the receipt should be visible in policy and renewal workflows and usable as a signal for cover-active/commission-eligibility tracking. It must not be confused with proof that the client sent money to the brokerage.

**Proof of payment**

Proof of payment is supporting evidence supplied by or obtained from the client that indicates the client has made or initiated a payment. Examples include an M-Pesa message/confirmation, bank-transfer confirmation, cheque-related documentation and an Insurance Premium Financing (IPF) form. It does not itself confirm that the insurer has received the money, that the insurer has issued a receipt, or that the cover is active. Link it to the client and relevant policy, and to the renewal where applicable. Store the evidence category, payment method, reference where available, amount in KES where known, payment date where known, notes, evidence-file key, recording agent and timestamp. Multiple proof-of-payment records may be associated with a policy or renewal, including instalments or partial payments. Agents record the evidence manually; payment-provider integrations and automatic message parsing are out of scope.

The system must distinguish (a) client proof of payment, (b) the brokerage's operational decision to accept that evidence and instruct the insurer to renew, (c) the insurer's receipt confirming funds received and serving as the brokerage's cover-active workflow signal, and (d) invoice balances and recorded payment allocations. After an agent reviews and records proof of payment, the brokerage treats the client as having met the operational precondition to instruct the insurer; the system must not claim that funds have cleared at the insurer. Proof of payment must not create an insurer receipt or by itself mark every invoice covered by a multi-policy payment fully settled. Financial balances are maintained from explicit recorded payment allocations and credits, not from the existence of a file alone.

### 4.8 Risk note

A risk note is a generated snapshot of risk/cover and premium information prepared for sharing with the insurer. It must link to a policy and should link to the relevant renewal or cover-change event when one exists. It is not universally required for every policy type or every transaction. A risk note is a document generated from a selected, persisted premium calculation and the relevant agreed cover terms; it is not the calculation authority that determines the premium, nor does its existence make the risk note mandatory.

#### Operational Workflow & Inception Lifecycle
1. **Acquisition Form & Preliminary Insurer Instructions:** For general business lines such as Motor, policy onboarding begins with an Acquisition Form capturing customer KYC, vehicle particulars (registration, make, model, year of manufacture), and preliminary or purchase values. Crucially, instructions to the insurer (e.g., requesting a 1-month temporary cover note while awaiting valuation, or requesting annual cover) are captured directly as an integral part of the **Acquisition Form** itself, rather than existing as a separate document.
2. **Transfer / Takeover Business:** For policies transferring to HealthWatch from another intermediary or directly from a client ("placed under HealthWatch"), a formal appointment/transfer letter is addressed to the insurer and archived as a supporting `Document` in the client/policy file.
3. **Valuation & Sum Insured Authority:** The agency does not programmatically calculate vehicle depreciation. Vehicle valuation is strictly an external, certified professional appraisal. Valuation is conducted annually, subject to specific carrier exceptions (notably Old Mutual, which permits valuation every two years). Once the certified valuer issues the valuation report (or agreed carrier value is established), the final sum insured is locked in.
4. **Inception Risk Note Generation:** With the final sum insured decided, the agent runs the definitive `PremiumCalculation`, produces the Inception Risk Note (`new_business`), and submits it to the insurer to bind the 12-month policy schedule.

#### Multi-Vehicle Policy Handling (One Policy, One Risk Note)
When a client covers multiple vehicles under a single motor policy (e.g., family fleet or corporate motor commercial policies):
- The policy container links multiple `Vehicle` records (`policy.vehicles`).
- The system generates **one single Risk Note** for the entire policy.
- The Risk Note presents an aggregated schedule listing all covered vehicles (Registration, Make & Model, Year of Manufacture, Sum Insured) and provides a consolidated financial summary summing net premiums, levies, and total payable across all covered assets.

#### One-Page Document Standard
Risk notes must strictly adhere to a **single A4 page constraint** (`210mm × 297mm`) for single-vehicle and 2–3 vehicle policies:
- **Print Dimensions & Margins:** Strict A4 portrait layout with `10mm` top/bottom and `12mm` side margins. Universal document templates must eliminate web padding in print mode (`print:p-0`).
- **Two-Column Schedule Grid:** Employs the canonical Kenyan insurance schedule layout with a ~25% label column on the left and a ~75% details block on the right.
- **Document Content Boundary:** The Risk Note contains policyholder particulars, class of insurance, period of cover, asset identifiers, limits of liability, deductible/excess schedules, special clauses, and statutory financial totals. **The vehicle's `last_valuation_date` is strictly NOT printed on the Risk Note document**; it is maintained in the database and visible on the agency's Policy management screen.

#### Renewal Triage & Risk Note Preparation
At policy renewal, risk notes follow an agent-driven comparative evaluation:
1. **Previous Risk Note as Historical Baseline:** When a policy enters the renewal window, the agent consults the expiring policy's previous Risk Note as the durable reference point to verify what transpired in the expiring term (prior sum insured, previous rating, applied benefits, deductibles, and special clauses).
2. **Reviewing the Insurer Renewal Invitation:** The agent reviews the incoming renewal invitation from the insurer against the previous Risk Note to detect any discrepancies, unannounced rate revisions, or carrier loading fees. The agent negotiates these changes with the carrier underwriter (for example, negotiating away unjustified loading fees).
3. **Agency Renewal Invitation:** After deciding whether to maintain previous values or adopt the insurer's revised figures, the agent prepares the agency's formal Renewal Invitation for the client, backed by a persisted `PremiumCalculation` and including the appropriate carrier-specific valuation disclaimer.
4. **Renewal Risk Note Generation:** Once renewal terms are settled, the Renewal Risk Note (`renewal`) is generated using the exact values from the agency's prepared Renewal Invitation and transmitted to the insurer alongside instructions to renew cover.

#### Cancellation Invariant
Risk notes are strictly **not** involved in policy cancellations. A Risk Note is an instrument for binding and endorsing risk. When a policy is terminated mid-term:
- The policy status transitions to `cancelled`.
- The client surrenders the physical certificate or token.
- The agency requests and records the insurer's **Cancellation Certificate** and credit note as a `Document` record.
- Under no circumstances does the system produce a "Cancellation Risk Note" or assign negative premium to a Risk Note.

The source of truth for whether a risk note is required remains the insurer's instructions for the specific product/cover and transaction. Product classes such as Medical never generate Risk Notes. The Risk Note PDF and structured snapshot are immutable once issued. If premium, benefits, or insured risk details change, create a new persisted calculation and generate a new risk note version linked to that calculation. Full endorsement lifecycle automation remains outside the initial release, but required risk notes for mid-term amendments (`endorsement`) must be recordable and traceable.

### 4.9 Payment records and allocations

The initial release provides manual payment recording and invoice allocation only. It does not initiate, collect, clear, reconcile or process payments through a bank, mobile-money provider or payment gateway.

**Minimum `PaymentRecord` fields:** `id`; `client_id` (the client account the payment is being recorded against); `amount_minor` (positive integer KES); `currency` (initially `KES`); `payment_date` (date shown by the supporting evidence, when known); `method` (controlled value such as cheque, bank transfer, mobile-money or other); `reference` (nullable); `payer_name_or_source` (nullable); `evidence_document_id` or stored evidence key (nullable); `notes` (nullable); `recorded_by_agent_id`; `recorded_at`; and an optional `reverses_payment_record_id`/correction linkage for auditable corrections. Unknown details remain null; they must not be guessed. Store the original evidence and creation audit event. A cheque covering several policies is one PaymentRecord, not one record per invoice.

**Minimum `PaymentAllocation` fields:** `id`; `payment_record_id`; `invoice_id`; `amount_minor` (positive integer KES); `allocated_at`; `allocated_by_agent_id`; and optional `reverses_allocation_id` plus a required correction reason when reversing/correcting. Each allocation applies part of one payment to one invoice. The invoice supplies the client, policy and renewal association; duplicating those foreign keys is unnecessary unless a later query-performance need is demonstrated.

**Constraints and validation:**
- Both payment and allocation amounts must be positive whole-KES amounts in the initial release; currency must match the invoice (initially KES). Reject zero, negative, malformed or unsupported-currency values.
- A payment belongs to one client account. An allocation must target an invoice belonging to that same client. Do not infer cross-client cheque allocation; if this is a real business requirement, define and approve it separately.
- The net active allocations against a payment must not exceed its amount. Compute this invariant transactionally/under a database lock so concurrent allocations cannot over-allocate the same payment. The unapplied amount is `payment amount − net active allocations` and must be visible.
- Multiple allocations from one payment and multiple payments allocated to one invoice are supported. Partial payment is supported. A payment may remain partly or wholly unallocated; do not auto-allocate the remainder.
- Allocation totals and invoice balances must be derived from the recorded events, not stored as independently editable amounts. If cached for performance, the cache must be rebuildable and reconciled against source events.
- Do not treat a proof-of-payment file as a payment amount or allocation. The agent may accept evidence and instruct the insurer before the final allocation is recorded; that operational decision does not itself alter invoice balances.

**Correction and reversal:** do not hard-delete a payment record or allocation, and do not edit an amount after allocations or statements depend on it. Record an append-only reversal/correction linked to the original record, with actor, timestamp and reason. A full payment reversal must not leave its allocations active: reverse the affected allocations explicitly, or use a transaction that creates the linked payment reversal and all required allocation reversals atomically. A partial allocation correction reverses the erroneous allocation and creates a new allocation for the corrected invoice/amount. Enforce that the net active allocation never exceeds the net valid payment amount. Preserve original records and evidence for audit; recompute current balances from the corrected event history. Previously issued statements remain historical snapshots; a later correction affects newly generated statements and must be disclosed through the normal statement period/balance calculation, not by silently rewriting an issued statement.

A proof-of-payment record, a `PaymentRecord`, an insurer receipt and a `PaymentAllocation` serve different purposes. Evidence can be recorded before an exact amount/allocation is known. The agent's acceptance of proof of payment enables the operational decision to instruct the insurer; it does not prove funds cleared at the insurer. The insurer receipt is recorded separately. Only explicit payment records and their net allocations/approved credits affect invoice balances. This bounded model supports statements, not a full general ledger, bank reconciliation or payment integration.

### 4.10 Invoice and invoice batch

An invoice is generated when billing a client for new business or following a completed/agreed renewal. While nominal statutory regulations ("cash and carry" / Section 156 Cap 487) require premium before risk attachment, commercial agency operations accommodate credit facilities, corporate check-off schemes, and Insurance Premium Financing (IPF); thus, client invoices are typically raised **after renewal** when cover terms are finalized.

Invoicing is decoupled from immediate Risk Note generation:
- The Risk Note establishes the bound cover snapshot with the carrier.
- Invoices are generated on demand or upon billing agreement, reflecting the reality that agencies do not always dispatch an external invoice for every single retail transaction upfront.
- An invoice records the relevant client, policy and, where applicable, renewal; the selected PremiumCalculation or agreed-terms snapshot from which the charge was derived; itemised amounts; invoice date/number; optional batch reference; generated timestamp; and document-storage key. The invoice's amounts are a snapshot and must not change when rate tables or policy data later change. Corrections are made through an auditable replacement, credit or adjustment process, not by silently rewriting an issued invoice.

An InvoiceBatch combines a frozen set of eligible invoices for one client and calendar month. Enforce one logical batch per `(client_id, month)` pair. Snapshot invoice IDs, versions and total when the generation request is accepted; retries use that same snapshot. A corrected or intentionally regenerated batch is a linked successor/version, not an in-place rewrite.

### 4.11 Statement

A statement is an account view of invoices and their payment status and
balances over a selected period. It shows invoice amounts, recorded
payments/credits, any remaining balance, opening and closing balances,
chronological debits and credits, and running balances. Partial payments
reduce the outstanding balance but do not erase or replace the original
invoice; the statement makes the remaining balance visible.

Statements are generated on demand. A Statement row is inserted only after the PDF has been successfully generated and uploaded. The request first creates a durable job and input snapshot, and the successful job response returns the new statement ID.

### 4.12 Invitation

A client-facing Invitation record tracks the brokerage's renewal invitation document and its storage key. Generation is triggered by an agent action and must use an explicitly selected, persisted PremiumCalculation and its proposed terms; the invitation's premium and benefit figures must not be manually typed independently of that calculation. The generated invitation stores the exact premium-calculation reference and an immutable snapshot of the terms and rendered document. If the agent changes the premium, loading/discount, benefits or other terms, the system must create and select a new calculation and generate a new invitation version; it must not rewrite an already generated invitation. Do not confuse this with the insurer's incoming renewal invitation/offer. The incoming insurer offer must be captured as a source document linked to the renewal, with its original file and received date preserved; record the quoted premium and offered benefits/cover terms available from that document in the renewal baseline snapshot. It establishes the baseline for renewal pricing; a renewal tracking record may exist before it arrives, but a client invitation must not be generated as a priced renewal invitation until the incoming offer is received and recorded and a valid calculation has been selected. The agent may negotiate permitted adjustments and add eligible benefits, and the resulting selected calculation/agreed terms determine the brokerage's proposed or final figures. Later insurer revisions are new linked source documents, not edits to the original. The system must preserve the incoming insurer document and must not silently invent or automatically send renewal terms.

### 4.13 Activity

Activity separates communication history from workflow state.

Types: - `note` - `phone_call` - `email` - `meeting` - `reminder` -
`system`

Fields include client reference, optional policy and renewal references,
type, body, creating agent and timestamp.

Activities should appear on client, policy and renewal detail screens. Logging a phone call or email must not change the renewal status automatically. Saved activity/audit history is append-only; correct a mistake with a linked follow-up/correction activity.

### 4.14 Rate tables, brackets, benefits and taxes

Rating rules are versioned data, not hard-coded insurer assumptions. A rate-table version is scoped to an insurer, product/policy type and pricing method. It has a validity interval and lifecycle (`draft`, `published`, `retired`). Draft versions may be edited; once published or used by a persisted calculation, the version and its rules are immutable. A correction creates a successor version and records the reason. Retirement does not invalidate historical calculations or documents.

Minimum data model:

- **RateTableVersion:** ID, insurer, product/policy type, pricing method, currency (KES for the initial release), version/sequence, `effective_from`, optional `effective_to`, lifecycle status, source document/reference, created/published metadata and change reason.
- **RateBracket:** parent version, lower bound, optional upper bound, percentage/rate, optional minimum premium, optional fixed premium/adjustment where the method permits it, and display label. Store numeric values as exact decimals, not binary floating-point.
- **PricingComponent:** named required input such as vehicle value, building sum insured or contents sum insured; whether required; and how it participates in the configured formula.
- **Benefit/CoverOption:** product/version, stable code and label, optional/required status, benefit limits, price method and price, eligibility conditions, and any complimentary/threshold rule. A benefit name alone is not enough to calculate a price.
- **MedicalTier:** product/version, tier code (for example A/B/C/D only where supplied by the insurer), benefit limits and premium. Tier names are identifiers, not numeric rates.
- **TaxRate/LevyRule:** applicable scope, name/code, percentage or fixed amount, effective interval, calculation basis, sequence/order and whether it applies to the base premium, benefit/adjustment lines or another permitted subtotal. These details must come from verified rules, not assumptions.
- **AdjustmentRule:** permitted adjustment type, amount or percentage, applicable base, allowed range/cap if specified by insurer/management policy, eligibility, reason requirement and effective interval.

Supported pricing methods across the agency product portfolio:

1. **Bracketed percentage with minimum premium (Motor Comprehensive & Mini-Fleets):** choose exactly one bracket from the declared vehicle value; calculate the configured percentage of the specified base; apply the configured minimum using `max(calculated percentage amount, minimum premium)` only where the insurer schedule defines that treatment. Optional add-ons (Excess Protector, PVT, Courtesy Car, Road Rescue) are calculated on their respective bases. Mini-fleets group 2 to 6 vehicles under one client portfolio.
2. **Fixed statutory tariff based on vehicle class (Motor Third Party Only / TPO):** mandatory statutory cover under the Insurance (Motor Vehicles Third Party Risks) Act (Cap 405, Laws of Kenya) providing third-party bodily injury/death indemnity and third-party property damage (standard statutory limit KES 3,000,000 up to KES 20,000,000) with zero own-damage or theft protection. Rated independent of vehicle market value as a flat fixed annual tariff based strictly on vehicle classification (e.g. Private KES 7,500/yr; Commercial Own Goods KES 12,500/yr; Boda-Boda KES 3,000–5,000/yr; PSV/Taxi base plus Passenger Legal Liability). Subject to standard statutory levies (0.20% ITL, 0.25% PHCF, KES 40.00 Stamp Duty).
3. **Multi-component sum-insured pricing (Domestic Package):** retain building, household contents, all-risks valuables, and domestic servants as separate inputs. Apply the configured formula to the required components (e.g. Buildings 0.10%–0.15%, Contents 0.75%–1.0%, All Risks 1.5%–2.0%, Servants flat KES/servant).
4. **Selectable fixed-price demographic tiers (Healthcare / Medical):** calculated from preset actuarial rate cards based on core Inpatient cover tiers (KES 500K, 1M, 2M, 5M, 10M) and demographic census (principal age bracket, spouse age bracket, children count/brackets), plus optional Outpatient, Maternity, Dental/Optical, and Last Expense riders. Strictly **no Risk Notes** are generated for medical policies; medical invitations are generated separately. Exempt from VAT and stamp duty.
5. **Declared wage-roll schedule rating (WIBA / Work Injury Benefits Act):** covers employee workplace death, injury, and disease under WIBA 2007. Rated directly against declared annual payroll schedules categorized by hazard class (Clerical ~0.50%, Artisans ~1.50%, Industrial ~3.50%), subject to minimum premium (typically KES 25,000). Clients supply wage schedules used as-is, and renewals carry current payroll values forward unless adjustments are requested.
6. **Limit-of-indemnity and packaged retail pricing (Commercial Property, Liability, PA & Golfers):**
   - *Professional Indemnity (PI) & Public Liability (PL):* Rated on declared Limit of Indemnity and practice fee turnover or commercial hazard class.
   - *Commercial Fire & Special Perils, Burglary & Theft, Standalone All Risks:* Sums insured on property, machinery, and inventory rated at statutory/insurer rates with forcible entry clauses and minimum premiums.
   - *Personal Accident (PA) & Golfers Insurance:* Fixed packaged benefits. Golfers covers golfing equipment, clubhouse personal effects, third-party liability, personal accident, and Hole-in-One bar reimbursement (flat package KES 5,000–12,000/yr).

Examples are structural only, not production rates. Motor ranges discussed include approximately up to KES 1.5 million, KES 1.5–2.5 million, KES 2.5–3 million, KES 3–5 million, and above KES 5 million. The example of 5% subject to a KES 60,000 minimum is not approved as a universal rule or confirmed for a particular bracket. Exact endpoints, rates, minimums and applicable products must come from a verified insurer schedule. Domestic rating basis, medical tier limits/prices, WIBA rates, and liability schedules likewise require the applicable verified product schedule.

**Bracket boundary convention:** represent intervals consistently as lower-inclusive and upper-exclusive (`[lower, upper)`), with an omitted upper bound meaning no upper limit. This is an internal representation convention only. Before publishing a table, verify that the source schedule's boundary meaning can be represented without changing the insurer's intent. If the source schedule is ambiguous (for example, adjacent ranges both say “up to” the same value), publication is blocked pending clarification. A value equal to a boundary must select exactly one bracket, never zero or two.

**Effective-date selection:** select a published version whose interval contains the transaction's applicable rating date, with `effective_from` inclusive and `effective_to` exclusive. Persist the rating date used. Prevent overlapping published validity intervals for the same insurer/product/method where they make selection ambiguous. If no applicable version exists, or more than one qualifies, block calculation; do not silently use the latest table or a future rate. The business owner must confirm the authoritative rating date for each transaction type (for example, quote date, cover start date or renewal effective date). Until confirmed, require an explicit rating date and do not infer it.

**Taxes, benefits and adjustments:** apply only validated, effective rules applicable to the selected product and event. The calculation order must be explicit and versioned: base premium, minimum-premium treatment, benefits, negotiated adjustments, taxes/levies and rounding. Configure this sequence to match actual insurer rules; do not assume every levy uses the same subtotal or that taxes are compounded. Complimentary benefits must appear as zero-charge benefit lines with an eligibility reason. Negotiated discounts/loadings must be separate signed line items with actor, timestamp, reason, amount or percentage, and adjustment basis. Enforce caps or approval requirements once those policies are confirmed. A manual override of the final total is not allowed: an agreed difference must be represented by a permitted adjustment and recalculated.

**Precision and rounding:** use decimal arithmetic for percentages and intermediate values. Proposed initial KES software default: round each monetary charge line to the nearest whole shilling using decimal `ROUND_HALF_UP`, then sum the displayed rounded lines for the total. Store unrounded intermediates where needed for audit and each rounded line. Confirm this default against applicable insurer and tax/levy rules before production sign-off. If a verified rule differs, encode it as a versioned calculation rule rather than changing historical results.

### 4.15 Premium calculations and agreed terms

A `PremiumCalculation` is a persisted, immutable calculation run for a policy/business event, optionally linked to a renewal. Minimum fields:

- **Identity/context:** ID, policy ID, optional renewal ID, event (`new_business`, `renewal`, `cover_change`), insurer/product, rating date, creator and creation timestamp.
- **Input snapshot:** each declared value (vehicle, building, contents), selected medical tier, benefits and product-specific inputs, relevant eligibility facts, units and currency.
- **Rule provenance:** exact rate-table version and selected bracket/tier, benefit versions, tax/levy versions, adjustment-rule versions and calculation-engine version.
- **Calculation detail:** formula/base for each line, unrounded intermediate amounts where relevant, rounded line amounts, minimum-premium application, benefit/complimentary lines, negotiated adjustment lines, tax/levy lines, subtotal and final total.
- **Audit/selection:** explicit selected-calculation reference or selection marker, selection actor/time, and supersession/reason metadata without mutating the prior calculation.

The engine must be deterministic for the same persisted inputs, rule versions, rounding configuration and engine version. Persisted results must not be recalculated in place after code or rate-table changes. A new run creates a new `PremiumCalculation`; the old run remains readable and reproducible. Retain sufficient immutable rule/configuration snapshots or version references to reproduce results after later rate changes. Generated risk notes, client-facing renewal invitations and invoices reference the exact calculation and preserve their own immutable rendered-data/terms snapshots.

The calculator is the calculation authority for supported and validated methods, not merely an indicative estimator. For renewal, the incoming offer from the existing insurer is required as the baseline source record, but its premium remains distinct from the calculated premium and final selected transaction terms. Recording an offer document must not alter rate tables or calculations; calculating must not overwrite the source document or baseline snapshot. Selecting a calculation does not itself mean client acceptance, update the policy's agreed premium, issue cover, instruct the insurer or generate an invoice. The Policy may retain current agreed premium for convenience, while the selected calculation and immutable transaction terms remain the historical authority.

**Validation and failure contract:** no definitive calculation is returned when required inputs or rules are missing, ambiguous, out of range, not yet effective, expired or unverified. Return structured validation details with a stable error code, field/rule path and human-readable explanation; do not substitute defaults silently. Validate at least:

- required fields are present; monetary values are non-negative and within configured product limits; currency/units are explicit; all required sum-insured components are supplied;
- exactly one applicable published rate-table version and exactly one bracket or tier match the rating date/input;
- bracket ranges are valid and gap/overlap-free for the intended domain; ambiguous boundaries or overlapping published versions block publication/calculation;
- percentages, fixed amounts, minimum premiums, limits and adjustments are valid for their configured types; invalid negative rates, impossible ranges and unsupported formula combinations are rejected;
- selected benefits, eligibility, limits, prices and complimentary rules are valid for the product/tier;
- required tax/levy rules exist and are effective, and calculation bases/order are explicit;
- negotiated adjustments are permitted for the product/event, have an actor and reason, and satisfy configured caps/approval requirements; no unexplained total override is accepted;
- the output uses supported precision and reconciles: total equals the sum of rounded itemised lines under the selected rule version.

Proposed stable validation codes include `missing_required_input`, `invalid_amount`, `no_effective_rate_table`, `ambiguous_effective_rate_table`, `no_matching_bracket`, `multiple_matching_brackets`, `ambiguous_bracket_boundary`, `invalid_benefit_configuration`, `missing_tax_rule`, `invalid_adjustment` and `calculation_reconciliation_failed`. These are proposed contract values, not evidence that an API currently emits them.



Additional relationship rules: the Policy may retain the current agreed premium for convenience, but it is not the historical source for prior renewals. New-business and cover-change events also require a persisted calculation even when no Renewal exists. A separate `AgreedTerms` table is not required for the initial release; retain the selected calculation and immutable transaction-level terms snapshot on the Policy/Renewal. Introduce a separate model only if a demonstrated requirement for versioned negotiations or multiple-party approvals emerges.

`RiskNote` and `Invoice` records reference the selected `PremiumCalculation` where applicable and preserve their own immutable rendered-data/issued-terms snapshots. `RiskNote` requires a Policy reference and has an optional Renewal reference because new business and mid-term risk changes may not belong to a renewal. A policy may have zero, one or many risk notes over its lifetime; each risk note identifies the event/version, calculation and terms it describes. An invoice links to the relevant policy and optional renewal and preserves the calculation/terms snapshot from which its charge was derived.

### 4.16 Insurance Premium Financing (IPF) Lifecycle

In compliance with Section 156A of the Insurance Act ("Cash and Carry"), clients purchasing high-value motor or commercial policies frequently utilize tripartite financing facilities through approved commercial banks (such as NCBA, Stanbic, or Equity Bank):
- **Tripartite Facility:** Involves the Client (borrower), Financing Bank (financier), and Underwriter (insurer). The agency facilitates placement and documentation.
- **Workflow & Invariants:**
  1. **Financing Application:** Client executes an IPF contract specifying loan term (typically 4–10 months) and financier facility details.
  2. **Deposit Verification:** Client pays a mandatory initial deposit (minimum 20%) to the agency or underwriter, recorded via `PaymentRecord`.
  3. **Commitment Letter:** The financing institution issues a formal irrevocable bank commitment guarantee.
  4. **Cover Inception:** Under Section 156A, the verified bank guarantee legally satisfies the statutory requirement for risk assumption, permitting policy inception or renewal completion prior to actual disbursement of funds.
  5. **Disbursement Tracking:** Bank remits loan balance directly to the underwriter or agency, matched against the outstanding invoice balance.

### 4.17 Outward Carrier Commission & Remittance Ledger

To eliminate double-entry in external agency spreadsheets, the system computes the agency's outward financial obligations and revenue recognition:
- **Statutory Commission Caps:** Commission rates comply with the Insurance Act (Cap 487) schedules (e.g., 10% on motor private, 15% on fire, 20% on domestic package).
- **Automated Calculation Sequence:**
  - $\text{Gross Agency Commission} = \text{Net Premium} \times \text{Commission Rate}$
  - $\text{Withholding Tax (WHT)} = \text{Gross Agency Commission} \times 0.05$ (5% statutory deduction at source)
  - $\text{Net Commission Due} = \text{Gross Agency Commission} - \text{Withholding Tax}$
  - $\text{Net Carrier Remittance} = \text{Gross Invoice Total} - \text{Net Commission Due}$
- **Remittance Summaries:** Generates exportable monthly carrier remittance statements for rapid reconciliation against insurer credit notes.

### 4.18 Claims Advocacy & Policy Lifecycle

Client retention across renewal cycles is directly influenced by the agency's advocacy during loss events:
- **Claims Registry:** Lean `Claim` entity linked to `Policy`, `Client`, and asset records.
- **Operational Lifecycle:**
  $$\text{intimated} \longrightarrow \text{documents_pending} \longrightarrow \text{adjuster_appointed} \longrightarrow \text{discharge_voucher} \longrightarrow \text{settled / declined}$$
- **Renewal Desk Integration:** Active claims and historical loss ratios are surfaced directly on the Renewals Desk. Account managers review outstanding disputes or claim frequency to negotiate appropriate terms, claim-free discounts, or underwriter loadings before preparing client renewal invitations.

## 5. Business workflows

### 5.1 New business

1.  Agent creates the client if needed.
2.  Agent creates a policy and enters the agreed policy data.
3.  The agent checks the insurer's instructions for the specific product/cover and business event, records whether a risk note is required, and the system queues/generates one only when required. If unclear, the agent confirms with the insurer; policy type alone is not the source of truth.
4.  An invoice is generated when the cover is given. Relevant KYC and supporting documents are attached.
5.  The policy becomes searchable and visible in relevant
    dashboard/search results.

Policy creation and document generation must use separate durable transactions where needed; risk-note generation failure remains visible as a failed job and must not erase the policy or its source event.

### 5.2 Renewal

1.  An agent initiates a renewal around 30 days before expiry, provided no active renewal exists.
2.  The agent obtains and uploads the insurer's incoming renewal invitation/offer. This is required to establish the initial baseline; preserve its original file, received date and available quoted terms.
3.  The agent creates a calculation from the applicable validated rating rules and the baseline offer, then records any insurer revisions, permitted negotiated loading/discount changes and eligible added benefits as explicit inputs/adjustment lines.
4.  The agent reviews the resulting premium breakdown, confirms the final agreed terms and explicitly selects the calculation that supports those terms. The insurer invitation is retained as evidence, not silently treated as the final price.
5.  The system generates the client-facing renewal invitation from the explicitly selected PremiumCalculation and its proposed terms, saves the calculation reference and immutable document snapshot, and the agent reviews it before communicating it outside the system. The invitation must not calculate or independently alter the premium.
6.  The agent logs calls, emails, client requests and contextual notes as Activities.
7.  If terms change, the agent creates a new calculation when the proposed terms change and, if the insurer has issued revised terms, uploads the revised offer as a new linked source document. The agent records the reason and explicitly selects the calculation supporting the revised terms; prior calculations and source documents remain available.
8.  The agent reviews and records client proof of payment. This is the brokerage's operational signal that it may instruct the insurer to renew; it is not confirmation that the insurer has received or cleared funds. A payment document may relate to one policy or a combined payment covering several policies.
9.  The agent records the instruction to the insurer, including date, channel/reference and relevant activity. The renewal remains awaiting insurer confirmation until the insurer-issued receipt/cover confirmation is recorded.
10. When the insurer receipt/cover confirmation is received, the agent records it against the relevant policy/renewal. The policy's current cover dates and premium snapshot are updated according to the confirmed renewal outcome. An invoice is generated when renewed cover is given; a risk note is generated only when required and uses the calculation/terms for the specific event. Document generation is processed asynchronously.
11. The agent can download documents once generation is complete.

**Initial-release rule:** no formal deferred-payment workflow or deferred-payment completion exception is included. Informal management instructions may be recorded as an internal Activity/note, but do not create a separate payment status or bypass required workflow evidence. Reconsider a formal exception only after the brokerage has documented its actual approval and audit process.

### 5.3 Premium calculation

1.  For a renewal, the agent first records the incoming insurer invitation/offer as the baseline; for new business or a cover change, the agent records the applicable source terms and risk data.
2.  The agent selects the applicable insurer/product rules and enters the required risk inputs, eligible benefits, and permitted loading/discount adjustments.
3.  The system validates the applicable effective-dated rates, benefit rules and taxes, then calculates a complete itemised breakdown. Missing or ambiguous required rules block a definitive result.
4.  The system persists an immutable PremiumCalculation snapshot with the inputs, rule versions, adjustments, breakdown and total.
5.  The agent reviews the result and explicitly selects/confirms the calculation and proposed/agreed terms for the business event. For renewals, the selected calculation is also the required pricing source for generating the client-facing renewal invitation. A new calculation is created whenever relevant inputs or terms change; prior runs remain auditable.

The calculator must block when rate data is missing, invalid, overlapping/ambiguous, or does not cover the insured value. Detailed calculation behaviour and validation are specified in Section 4.14 and the Binding decisions section.

### 5.4 Invoice batch

An agent requests a batch for a client and month. The system freezes eligible invoice IDs and versions for the client/month when the request is accepted, computes the total from that snapshot, generates the PDF and stores the batch. Enforce one logical batch per client/month; any corrected/reissued batch is a linked successor and never rewrites the original.

### 5.5 Statement

An agent requests a statement for a client and date range. The system
calculates opening balance, period debits and credits, running balance
and closing balance, generates a PDF and records the generated document.

The statement must include invoices, recorded payments/credits and remaining balances for the selected period. Opening-balance treatment for incomplete historical records, and handling of overpayments, reversals, refunds and credit notes, must follow the accounting rules approved for implementation.

### 5.6 Supporting document management

Documents may be associated with clients, policies or renewals. The
system stores object-storage keys rather than local filesystem paths.
Document metadata must identify the owner, category, title, uploader and
timestamp. Access must be checked before issuing a download URL.

### 5.7 Activity timeline

Agents can record notes, calls, emails, meetings and reminders.
Activities are append-oriented history, separate from renewal state. The
design should specify whether activities can be edited/deleted and how
corrections are represented in an audit-sensitive system.

## 6. User interface requirements

### 6.1 Dashboard

The dashboard is the default landing page after login. It should
surface: - Renewals awaiting carrier documents. - Renewals awaiting
client response. - Renewals awaiting payment. - Policies expiring within
30 days. - Recently completed renewals.

Every widget should link to the underlying records. Counts and lists
should use clearly defined business predicates so that dashboard figures
match renewal lists.

### 6.2 Global search

Search is a primary navigation feature, available through a visible
search control and `Command + K`.

Searchable entities: - Clients - Policies - Renewals - Vehicles -
Documents

Search fields: - Client name - Phone number - KRA PIN - Policy number -
Vehicle registration - Insurer name - Document title

Results should be grouped by entity type. The specification should
define partial-match behaviour, case sensitivity, minimum query length,
pagination, keyboard navigation, permission filtering and search
indexing.

### 6.3 Detail screens

Client, policy and renewal views should surface linked records and
relevant Activities. Renewal detail should show current status, cover
period, premium information, payment terms, receipts, carrier document,
generated documents and version/conflict state.

### 6.4 Document states

A generated-document record with a null `storage_key` represents pending
generation, not missing data. The UI should show a generating state,
expose downloads only when ready, and show a useful error/retry state
when generation has failed.

## 7. API surface

The following is the route inventory described by the source
specification. It is a design contract, not proof that these endpoints
exist in code.

### Canonical routes for documents and transaction artifacts

The routes below are the canonical design contract for implementation. They describe intended API behaviour only; they are not evidence that the endpoints already exist. Use resource collection routes consistently. Do not implement the older alternate client-nested invoice-batch or statement routes.

#### Client records and uploaded client documents

- `POST /clients/{client_id}/documents` — upload/register a client-owned source document. Request: multipart file plus metadata such as `document_type`, `title`, optional `policy_id`, optional `renewal_id`, a category (including insurer renewal offer, insurer receipt and client proof of payment), and optional `notes`. Response: `201 Created` with document metadata and a resource `id`.
- `GET /clients/{client_id}/documents` — list client documents, with standard pagination and optional documented filters.
- `GET /clients/{client_id}/documents/{document_id}` — retrieve metadata, current version, links and status; do not return file bytes in the JSON representation.
- `PUT /clients/{client_id}/documents/{document_id}/content` — replace the uploaded source file. Require an expected current version (for example `If-Match` or `expected_version`) to prevent lost updates. Preserve the previous version and audit actor, time and reason. This route is for replaceable uploaded source documents only, not generated financial/workflow artifacts. Once a source document has been received or relied upon (including an insurer offer or insurer receipt), preserve it and upload a new linked source document for any revision rather than replacing its content.
- `GET /clients/{client_id}/documents/{document_id}/download` — authorised download. If ready, return a short-lived redirect or a JSON response containing a short-lived signed URL; choose one response style and use it consistently. Never expose the permanent storage key or local filesystem path.

A generic `DELETE` route must not be used to mean “replace.” Historical source files referenced by a workflow or audit record should be superseded/versioned, not physically erased. If an unused document may be disposed of under the retention policy, use an explicit authorised archive/disposition operation with an audit event; physical deletion is not part of this baseline.

#### Incoming insurer offer documents

The initial release does not define a separate `Offer`/`CarrierOffer` entity or dedicated offer API. The insurer's incoming renewal offer is an uploaded source document linked to the client, policy and relevant renewal using the existing document model. Categorise it as an insurer renewal offer and record the received date and available quoted premium/cover terms in the renewal's baseline snapshot. Do not require fields that the source document does not provide.

If the insurer sends a revision, upload it as a new source-document version/record linked to the same renewal and retain the earlier document and its received facts. Update the renewal's current baseline reference only through an explicit audited action; do not overwrite the earlier source file or conflate insurer-quoted terms with the brokerage's calculation or agreed terms. Multi-insurer comparison-shopping is out of scope.

#### Risk notes, renewal invitations and invoices

- `POST /policies/{policy_id}/risk-notes` — request generation of a risk note only when the agent has confirmed that insurer instructions require it for the relevant event. Request: applicable `renewal_id` or cover-change reference when relevant, selected persisted `premium_calculation_id`, and any supported event metadata. Response follows the asynchronous generation contract below.
- `GET /policies/{policy_id}/risk-notes` and `GET /risk-notes/{risk_note_id}` — list/retrieve risk-note records and their generation status/snapshot metadata.
- `GET /risk-notes/{risk_note_id}/download` — download the generated risk-note artifact when ready.
- `POST /renewals/{renewal_id}/invitations` — create a client-facing renewal invitation from an explicitly selected persisted calculation and transaction terms. The request must identify the selected calculation and any approved invitation metadata; the server snapshots the terms used. It must not treat the incoming insurer offer itself as the client invitation.
- `GET /renewals/{renewal_id}/invitations` and `GET /invitations/{invitation_id}` — list/retrieve invitation records, including version, calculation reference and generation status.
- `GET /invitations/{invitation_id}/download` — download the invitation when ready.
- `GET /invoices?client_id=&policy_id=&renewal_id=` — list invoices with pagination and filters.
- `GET /invoices/{invoice_id}` — retrieve invoice metadata, issued snapshot, calculation/terms reference and balance derived from recorded allocations/credits.
- `GET /invoices/{invoice_id}/download` — download the issued invoice when ready.

Invoice creation is triggered by the business event that new or renewed cover is given, under the relevant workflow; it is not an arbitrary side effect of selecting a calculation or generating an invitation. If invoice PDF rendering is asynchronous, the invoice business record and its immutable issued terms must be committed according to the issuance transaction, with rendering status tracked separately. An issued invoice is not replaced in place. Correct it through an explicit, auditable correction/void/credit process approved for implementation; that financial process must not be inferred from a document `PUT` route.

Generated risk notes and invitations are immutable snapshots. If terms change, create a new persisted calculation and a new generated artifact/version. A later client, policy, insurer or rate-table edit must not rewrite an already generated file or its structured snapshot.

#### Payment records and allocations

These are proposed routes, not evidence that the endpoints are implemented:

- `POST /payment-records` — manually record one payment instrument/event. Request: `client_id`, positive `amount_minor`, `currency`, `payment_date` when known, `method`, optional `reference`, `payer_name_or_source`, evidence document/key and notes. The response returns the created `payment_record` with `unallocated_amount_minor` initially equal to the recorded amount. This endpoint does not accept client proof as a substitute for a recorded amount and does not mark an insurer receipt or renewal as complete.
- `GET /payment-records?client_id=&invoice_id=&from=&to=` — list payment records with pagination and supported filters.
- `GET /payment-records/{payment_record_id}` — retrieve the immutable payment record, active allocations, reversals/corrections and derived unallocated amount.
- `POST /payment-records/{payment_record_id}/allocations` — allocate a positive amount to one invoice. Request: `invoice_id`, `amount_minor`. Validate client and currency match and enforce the net-allocation limit transactionally. Return the allocation and updated derived unallocated amount.
- `GET /payment-records/{payment_record_id}/allocations` — list allocations and their correction/reversal links.
- `POST /payment-allocations/{allocation_id}/reverse` — reverse an allocation with a required reason; do not delete or mutate the original allocation. If an allocation was entered incorrectly, create a separate replacement allocation after reversal.
- `POST /payment-records/{payment_record_id}/reverse` — record a full payment reversal with a required reason. This must atomically reverse or invalidate its active allocations so the net active allocations cannot exceed the remaining valid payment amount. A partial payment correction is represented by a linked correction/reversal and, if needed, a new PaymentRecord for the corrected amount; it is not an in-place edit.

Creation and allocation requests should accept an idempotency key so safe retries do not duplicate payment records or allocations. Repeating a key with a different payload returns `409`. The API must not expose generic `PUT` or `DELETE` operations that rewrite financial history. A correction endpoint records a new event and returns links to both original and correcting records.

#### Invoice batches and statements

- `POST /invoice-batches` — request creation of a batch for a client and accounting period. Request: `client_id`, period/month, and any explicitly supported selection criteria. Enforce the documented uniqueness rule for `(client_id, month)`; a duplicate request should return the existing batch or a stable `409 invoice_batch_already_exists`, not create duplicates silently.
- `GET /invoice-batches?client_id=&month=` — list batches.
- `GET /invoice-batches/{batch_id}` — retrieve batch metadata, included invoice IDs and generation status.
- `GET /invoice-batches/{batch_id}/download` — download the batch document when ready.
- `POST /statements` — request a statement. Request: `client_id`, required date range/period, and only those statement options explicitly supported by the accounting rules. Return a durable request/job identifier immediately.
- `GET /statements?client_id=` — list successfully created statements, with pagination and filters.
- `GET /statements/{statement_id}` — retrieve statement metadata, period and generation status where a statement resource exists.
- `GET /statements/{statement_id}/download` — download the generated statement when ready.

Do not use the conflicting `POST /clients/{id}/invoice-batch` or `POST /clients/{id}/statement` routes. Statements must calculate from issued invoices and explicit net payment allocations/approved credits; client proof-of-payment evidence alone does not alter an invoice balance, and an insurer receipt does not imply that every invoice is settled. For a statement period, show invoice debits and payment-allocation/credit entries with dates, references and amounts, plus a running and closing balance. The basic calculation is `closing balance = opening balance + period debits − period credits`; allocation entries reduce the relevant invoice/client balance only once and only to the extent allocated. Do not count the full PaymentRecord as a credit if only part of it is allocated. A payment's unallocated remainder is shown separately as unapplied funds and must not silently reduce an invoice balance. Order entries by effective transaction date and then a stable deterministic tie-breaker (for example, creation timestamp and record ID). The statement's opening-balance treatment, whether unapplied funds appear as a separate account credit, and advanced accounting cases must follow separately approved accounting rules; until then, expose unapplied funds separately and exclude them from invoice settlement calculations.

#### Asynchronous generation contract

Every endpoint that starts document generation returns `202 Accepted` with a durable `job_id`, a `status_url`, and the associated resource ID when a resource stub is created. Example:

```json
{
  "job_id": "<job-uuid>",
  "status": "pending",
  "status_url": "/document-jobs/<job-uuid>",
  "resource": { "type": "risk_note", "id": "<risk-note-uuid>" }
}
```

The placeholder IDs above illustrate shape only. The canonical job routes are `GET /document-jobs/{job_id}` for status/details and `POST /document-jobs/{job_id}/retry` for an authorised retry of a terminally failed job when the failure is retryable. Job responses use only `pending`, `processing`, `succeeded`, and `failed`. Internal worker-claim/lease details are implementation internals and are not public states. A job response includes `attempt`, `created_at`, `updated_at`, optional `resource`, and a stable error code/message on failure. It must not include stack traces or storage credentials.

For risk notes, invitations, invoice batches and generated invoice PDFs, create the relevant durable business resource/stub and job in one database transaction where the workflow permits it. A resource is downloadable only after rendering and storage succeed. A failed job remains visible with a safe error and retry action; retries must be idempotent and must not create duplicate invoices, invitations, batches or artifacts. Use an idempotency key for client retries of creation requests, scoped to the authenticated agent and operation. Repeating the same key and same payload returns the original result; reusing it with a different payload returns `409 idempotency_key_reused`.

Statement generation retains the documented no-stub exception: do not create the Statement business record until its PDF has rendered and uploaded successfully. Still create a durable generation-request/job record and return its `job_id` with `202`; poll `GET /document-jobs/{job_id}` rather than polling the statement list to infer progress. On success, the job response supplies the created statement resource ID. On failure, the job remains visible even though no Statement row exists.

#### Document-generation consistency rules (authoritative design contract)

Apply these rules consistently to risk notes, renewal invitations, invoice PDFs, invoice batches and statements. They are proposed requirements, not claims of implemented behaviour.

**One public job state machine.** Every generation request has a durable job with API-visible states `pending`, `processing`, `succeeded` and `failed`. A successful job has a completed artifact/resource reference; a failed job has a stable error code, safe user-facing message, attempt count and retryability indicator. Worker leases, queued/claimed states and internal retry-wait states are not public states. A retryable job can return to `pending` through the authorised retry operation, while its attempt history remains auditable. A `succeeded` job is not rerun in place; changed source terms require a new generation request and artifact version.

**Idempotency.** All generation-request endpoints accept an `Idempotency-Key`. Scope the key to the authenticated agent and operation; persist the key, canonical request hash, job ID and resulting resource ID. A repeat with the same key and equivalent payload returns the original job/resource response; reuse with a different payload returns `409 idempotency_key_reused`. Also enforce domain uniqueness so different keys cannot create duplicates for the same logical operation: for example, one invoice per relevant cover-issuance event, one batch per documented `(client_id, month)` uniqueness rule, and one statement per identical statement request/snapshot where the business rules require uniqueness. Do not rely on the client key alone. Allocation and payment idempotency rules remain in the payment section.

**Snapshot before enqueue.** In the same database transaction that creates the job and any permitted business-resource stub, validate the source state and persist an immutable generation-input snapshot (or immutable references to versioned records sufficient to reconstruct it). The worker renders from this snapshot, never from whatever happens to be current when it eventually runs. Record the snapshot/version identifier, template version, renderer/engine version, requested-by actor and request time. If validation or snapshot creation fails, do not enqueue a job. If source terms change after enqueue, the existing job continues with its original snapshot; the user must explicitly request a new version where permitted.

- **Risk note:** snapshot the policy/cover-change or renewal event, the selected persisted `PremiumCalculation`, and the insurer-required risk-note fields. Create one only when the agent has confirmed it is required for that product and event. A missing or unselected calculation is a validation failure, not an invitation for the worker to guess.
- **Renewal invitation:** snapshot the explicitly selected calculation and proposed client-facing terms, plus the relevant renewal and insurer-offer references. An insurer offer is not itself the invitation. A changed premium or term requires a new calculation/terms version and new invitation artifact; do not mutate the prior invitation.
- **Invoice:** snapshot the agreed terms and invoice lines at the business event when new or renewed cover is given. Commit the invoice business record and its issued terms once according to the issuance transaction, independently of PDF rendering. A render failure must not create a second invoice on retry. Financial correction/void/credit rules must use the explicit audited correction workflow, not document regeneration.
- **Invoice batch:** snapshot the selected invoice IDs and their issued versions when the batch request is accepted. The worker must not silently add invoices created later. If the batch needs different membership, create a new batch/version only under an explicit business rule; preserve the original membership and output.
- **Statement:** snapshot the client, period, statement options, statement cutoff/as-of point, and the included invoice/allocation/credit entries before rendering. Preserve the documented exception: no Statement business row is created until rendering and storage succeed, but the durable job and its immutable input snapshot are created first. The cutoff and included-entry set must remain fixed across retries so a statement cannot change because new payments arrive mid-render. The precise opening-balance and unapplied-funds presentation remains subject to approved accounting rules.

**Retry policy and recovery.** Retry only transient failures such as temporary database/storage unavailability, rate limiting or worker interruption. Use bounded exponential backoff with jitter and a configurable maximum attempt count; the proposed default of three attempts is an operational starting point, not a business rule. Do not automatically retry permanent validation errors, missing required source data, unsupported templates or permission failures. After exhaustion, mark the job `failed` and expose an authorised manual retry only when the cause is retryable or has been corrected. A manual retry reuses the same snapshot and logical operation; it must not issue a new invoice, invitation, batch or statement accidentally.

Render to a temporary object or attempt-specific object key, verify upload success, then atomically persist the final storage reference and mark the job successful. Use a deterministic artifact identity derived from resource/version (and a unique attempt key for temporary uploads), so a worker crash after upload but before database commit can be reconciled without publishing duplicates. On restart, workers reclaim expired leases; a watchdog detects stale `processing` jobs and safely requeues retryable work or marks it failed according to the retry policy. Orphaned temporary objects are logged for reconciliation and cleanup; never delete an object that is referenced by a committed artifact. Do not mark a document ready until its stored artifact and database reference are both confirmed.

**UI behaviour.** After a `202 Accepted`, retain the returned `job_id` and poll `GET /document-jobs/{job_id}` with a bounded interval/backoff, or use an equivalent push mechanism if later implemented. Show `Pending`, `Generating`, `Ready` or `Failed` to users while mapping those labels to the API states. Disable download until `succeeded` and a valid artifact reference are present. On failure, show the safe error message, retain the job in the relevant record's history, and show Retry only when the API reports that retry is permitted and the user is authorised. A retry keeps the same logical record visible and refreshes the job status; it must not optimistically show a document as ready. Stop polling terminal jobs, and provide a refresh path if the browser reloads or loses connection.

#### API resource and error conventions

Use `GET` for retrieval, `POST` for creation or generation requests, and `PUT .../content` only for replacing a versioned uploaded source file. Do not use `DELETE` as a synonym for replacement. Generated artifacts, received insurer offers, issued invoices and statements are not overwritten in place; use explicit version/supersession/correction semantics appropriate to the resource.

Successful synchronous creation returns `201 Created` with the created resource. Async generation returns `202 Accepted`. Retrieval returns `200 OK`; a download returns either a short-lived redirect or the one consistently chosen signed-URL response. A missing resource returns `404`; invalid payloads return `422`; business-rule or stale-version conflicts return `409`; unauthenticated/expired sessions return `401`; unavailable dependencies return `503`. Preserve the existing error envelope:

```json
{
  "error": {
    "code": "resource_conflict",
    "message": "The requested operation conflicts with the current resource state.",
    "detail": {}
  }
}
```

The exact allowed metadata fields and the signed-URL response style should be fixed in the eventual OpenAPI schema; this document does not claim those implementation details already exist.

### Ratings and premium calculations (proposed API contract; not yet implemented)

Use immutable rate-table versions. Edit draft versions only; publishing freezes the version. Do not patch or delete brackets, benefits or taxes after publication/use by a calculation. Create a successor version with an effective interval and change reason instead.

- `POST /rate-table-versions` — create a draft version with insurer, product, pricing method, effective interval and source reference.
- `GET /rate-table-versions?insurer_id=&product_type=&rating_date=` — list versions, optionally filtered by insurer/product/date.
- `GET /rate-table-versions/{id}` — retrieve version and configured rules.
- `PATCH /rate-table-versions/{id}` — edit draft metadata/rules only; published versions return `409`.
- `POST /rate-table-versions/{id}/brackets`, `POST /rate-table-versions/{id}/benefits`, `POST /rate-table-versions/{id}/tax-rules` — add rules to a draft version.
- `POST /rate-table-versions/{id}/validate` — validate configuration and return errors/warnings without publishing.
- `POST /rate-table-versions/{id}/publish` — publish only if validation succeeds; reject ambiguous boundaries, overlaps, missing rates or incomplete tax/benefit configuration.
- `POST /rate-table-versions/{id}/retire` — make the version unavailable for new selection under its effective-date rules without changing prior calculations.
- `POST /premium-calculations` — calculate and persist an immutable run. Request identifies policy/event, explicit rating date, insurer/product, required product inputs, selected benefits/tier, permitted adjustment lines and (for renewal) renewal baseline document reference/snapshot. Response includes calculation ID, selected rule-version IDs, itemised lines, totals and engine version.
- `GET /premium-calculations/{id}` — retrieve the immutable calculation snapshot and breakdown.
- `POST /premium-calculations/{id}/select` — explicitly select for the relevant transaction; selection does not itself mean client acceptance, change the policy premium, issue cover, instruct the insurer or generate an invoice.
- An optional preview endpoint may support unpersisted UI experimentation. Any calculation used for a risk note, invitation or invoice must be persisted first.

A failed calculation returns `422` with the common error envelope and field/rule-level validation details. A conflict caused by an immutable version, concurrent update or ambiguous effective version returns `409`. Never report a successful total if mandatory rating data is missing or ambiguous.

### API response conventions

The API contract uses a consistent error envelope:

``` json
{
  "error": {
    "code": "renewal_not_completable",
    "message": "Renewal cannot be completed: no receipts logged",
    "detail": {}
  }
}
```

Proposed status meanings: - `400` --- malformed request - `401` ---
missing/invalid/expired session - `404` --- resource not found - `409`
--- business-rule conflict or stale concurrent update - `422` ---
validation error - `500` --- unhandled server error - `503` ---
unavailable dependency; retry with backoff

TanStack Query should retry transient `503` responses only, not `4xx` responses.

Large list endpoints use offset pagination: default limit 20, maximum
100, with `items`, `total`, `limit` and `offset` in the response. Small
bounded lists may return arrays.

## 8. Database and data integrity

### 8.1 General conventions

-   PostgreSQL.
-   UUID primary keys.
-   `TIMESTAMPTZ` for timestamps.
-   Foreign keys use `ON DELETE RESTRICT`.
-   Monetary amounts are integer KES.
-   Percentage values use `NUMERIC`, not binary floating-point.
-   Enum-like values are represented as text with CHECK constraints.
-   Historical records should be preserved rather than casually deleted.

### 8.2 Important constraints and indexes

-   Unique KRA PIN on clients (as currently specified).
-   Unique agent email.
-   Unique `(client_id, month)` for invoice batches.
-   Partial unique index preventing more than one active renewal per
    policy.
-   Indexes for client name, session lookup and job polling.
-   A job polling index for pending/failed jobs by status and `run_at`.
-   Foreign keys for relationships between clients, policies, insurers,
    renewals, receipts, agents and documents.

### 8.3 Renewal concurrency

Renewals include a `version` integer. Every update increments it. A
status update is conditional on both renewal ID and expected version. If
no row matches, return 409 and ask the frontend to refresh. This
prevents one agent silently overwriting another agent's change.

### 8.4 Financial consistency

The database schema and domain rules must make clear: - Which amount is
proposed, agreed, invoiced and received. - Whether receipt totals can
exceed the agreed premium. - How partial payments and deferred terms
affect completion. - Whether invoice totals are immutable after issue. -
How corrections, reversals and refunds are recorded. - How historical
rate/tax rules are preserved for a past calculation.

## 9. Document generation and background jobs

### 9.1 Document templates

The specification proposes: - Word templates via `python-docx` and
`docx2pdf`/LibreOffice for risk notes and invitations. - HTML templates
via Jinja2 and WeasyPrint for invoices, invoice batches and statements.

Templates are stored in the repository and baked into the worker image.
Updating a template requires redeployment.

### 9.2 Generation flow

For documents tied to a workflow transition, the API validates the business event and permissions, then in one database transaction persists the immutable generation-input snapshot, creates the durable job and—where the resource rules permit it—creates the document/business-resource stub. Commit the transaction before a worker can claim the job. The worker renders from the persisted snapshot and pinned template/engine versions, uploads to a temporary or deterministic artifact location, verifies the upload, then commits the final storage reference and `succeeded` state. The UI exposes download only after that commit. Never let the worker re-read mutable current policy/client/rate data as the source for an already accepted job.

For invoices, the invoice and immutable issued terms are committed at cover issuance; PDF generation is a separate asynchronous task and retry must not create a second invoice. For statements, preserve the special rule in Section 9.6: create the job and statement-input snapshot first, but create the Statement business row only after successful render and upload. The snapshot timing, idempotency, retry, recovery and UI rules in the authoritative contract above apply to all five artifact types.

### 9.3 Job lifecycle

The API-visible lifecycle is `pending → processing → succeeded`, with
`failed` when the attempt sequence has stopped. Worker claim/lease states
are internal and must not leak as separate API states. A retryable failure
may be retried with bounded backoff; when the configured retry limit is
exhausted, the job remains `failed` and is visible for inspection or an
authorised retry. A default retry limit of three attempts and a watchdog
for stale processing leases are proposed operational defaults, to be
configurable and tested. See the authoritative consistency contract in
Section 7 for idempotency, immutable snapshots, per-artifact behaviour,
error handling and UI state mapping.

### 9.4 Idempotency and storage recovery

Generation requests use a persisted idempotency key plus a domain-level
uniqueness constraint. Workers render from the same persisted snapshot on
retry, write temporary/attempt-specific objects, and publish a final
storage reference only after upload verification and a successful database
commit. A crash between upload and commit can leave an orphan temporary
object; reconciliation must identify such objects without deleting any
object referenced by a committed artifact. Daily orphan reconciliation
is proposed and may be deferred at launch, but basic deterministic naming,
logging and safe retry behaviour are required. See Section 7 for the full
contract.

### 9.5 File storage

Cloudflare R2 stores KYC files, carrier documents, receipt proofs and
generated PDFs. Storage keys follow a pattern such as:

`documents/{document_type}/{record_id}/{timestamp}.pdf`

The API creates a time-limited pre-signed URL for authorised downloads.
Storage keys, not local filesystem paths, are stored in PostgreSQL.

### 9.6 Statement generation exception

The design does not create a pending Statement business-record stub.
The API creates a durable generation-request/job record and returns its
job ID. The worker generates and uploads the PDF, then inserts the
Statement row with its storage key. The frontend polls
`GET /document-jobs/{job_id}` for progress and obtains the statement ID
from the successful job response; it must not infer progress by polling
the statements list.

## 10. System architecture and technology

### Runtime components

-   **Browser UI:** React is named in the runtime diagram; TanStack
    Query manages server-state fetching and retries.
-   **API:** Python 3.12, FastAPI and Uvicorn.
-   **Database:** PostgreSQL.
-   **Worker:** separate process using the same codebase to generate
    documents.
-   **Object storage:** Cloudflare R2.
-   **Deployment:** Railway-managed API, worker and PostgreSQL services.

### Local development

Docker Compose is specified for local development with API, worker and
PostgreSQL services. The development environment should use a separate
R2 bucket (named `insurance-dev` in the source) to avoid mixing test
files with production data.

### Deployment flow

1.  Push to `main`.
2.  Railway builds the container image.
3.  Database migrations run as a controlled step.
4.  API and worker services deploy.
5.  The old worker should finish in-flight work before shutdown where
    practical.

Migrations must be designed for the deployment order, especially when a
new API version and old worker may temporarily run against the same
schema.

## 11. Security and privacy

### 11.1 Authentication

-   Email/username and password.
-   Password hashes use bcrypt.
-   Accounts are created by an administrator.
-   No public registration endpoint.
-   Server-side sessions are stored in PostgreSQL.
-   Session token is held in an `httpOnly` cookie.
-   Session lifetime is eight hours; logout deletes the session row.
-   Production cookies must be `Secure` and served over HTTPS.

### 11.2 Authorization

The current design grants all authenticated agents equal access.
PostgreSQL is private to the API/worker network; object-storage
credentials are environment variables, not source code.

### 11.3 Auditability

`created_by` is specified for renewals, receipts and risk notes.
Activities also record the creating agent. Generated documents are
immutable snapshots: later edits to source records do not rewrite
already-issued documents.

### 11.4 Sensitive data

The application handles national identity information, KRA PINs, contact
details, policy information and financial records. The design should
explicitly specify: - File size/type validation and malware scanning
policy. - Least-privilege object-storage credentials and private
buckets. - Short-lived download URLs and access checks. - Rate limiting
and login-abuse protection. - Session-cookie `SameSite` settings and
CSRF protection for cookie-authenticated writes. - XSS-safe rendering of
notes and document metadata. - Encryption in transit and at rest,
including backups. - Retention, correction and deletion policies. -
Security logging that does not expose passwords, session tokens or
sensitive document contents. - A response plan for data exposure or
account compromise.

## 12. Configuration

A single system configuration record stores brokerage identity
information used in generated documents: - Brokerage name - Address -
Phone number - Payment instructions

These values must not be hard-coded into templates or application code.
The design is single-brokerage, not multi-tenant.

## 13. Error handling and operational recovery

Storage and database operations
cannot always be atomic across service boundaries. The design favours
detectable and recoverable failures.

  -----------------------------------------------------------------------
  Failure                             Proposed handling
  ----------------------------------- -----------------------------------
  File uploaded but database write    Orphan file; daily reconciliation
  fails                               is proposed but deferred

  Worker crashes mid-job              Watchdog detects stale `processing` jobs and safely reclaims or fails them using lease/attempt history

  Retry limit exhausted               Mark job `failed`; retain the
                                      error/attempt history and allow
                                      authorised retry only when safe

  Two agents update same renewal      Optimistic concurrency check; HTTP
                                      409

  PostgreSQL unavailable              HTTP 503; client retries with
                                      backoff

  Object storage unavailable          Retry transient failures with bounded backoff; after exhaustion mark the job `failed`

  Invalid business transition         HTTP 409 with machine-readable code
  -----------------------------------------------------------------------

Operational readiness also requires structured logs, worker/job metrics,
alerts for terminally failed jobs, database/storage health checks, and a tested
restore procedure. These operational requirements must be completed before production.

## 14. Deployment, backups and maintenance

The specification proposes Railway-managed PostgreSQL, API and worker
services, with Cloudflare R2 for object storage. Environment variables
include: - `DATABASE_URL` - `R2_ACCOUNT_ID` - `R2_ACCESS_KEY_ID` -
`R2_SECRET_ACCESS_KEY` - `R2_BUCKET_NAME` - `SESSION_COOKIE_SECRET` -
`ENVIRONMENT`

The design recommends PostgreSQL point-in-time recovery for a financial
record system and notes that daily backups alone can imply up to 24
hours of data loss. Cloud object replication is not the same as
backup/versioning or protection against accidental deletion; object
recovery requirements should be evaluated separately.

Backups are only useful if restoration is tested. The project needs
explicit recovery-point and recovery-time objectives, a documented
restore drill, and a decision on retention of uploaded documents and
generated PDFs.

## 15. Deferred features

The source intentionally defers: - Full endorsement workflows and
approvals. - Automated renewal invitations. - Parsing M-Pesa
confirmation messages. - Email delivery of documents. - Final
invoice-number format.

These are not necessarily defects. Keeping them out of the initial
release helps constrain scope, provided the interfaces and operational
consequences are understood.

------------------------------------------------------------------------

## 16. Recommended implementation order

### Phase 0 --- Translate the final decisions into implementation contracts

-   Convert the agreed accounting and statement rules into ledger queries and reconciliation tests.
-   Implement and test the proof-of-payment acceptance and insurer-confirmation workflow.
-   Implement rate validation, rounding and effective-date selection.
-   Publish canonical API routes and response schemas.
-   Implement request-time document snapshots and append-only audit events.

### Phase 1 --- Foundations

-   Repository structure, configuration and migrations.
-   Authentication, session lifecycle and secure cookie/CSRF handling.
-   Client, insurer, policy and vehicle CRUD.
-   Document storage abstraction and metadata model.
-   Automated tests and CI checks.

### Phase 2 --- Renewal workflow

-   Renewal creation and duplicate prevention.
-   Explicit status transition service.
-   Receipt logging.
-   Optimistic concurrency.
-   Activity timeline.
-   Dashboard and search.

### Phase 3 --- Financial logic and documents

-   Rate tables, brackets, benefits and taxes.
-   Premium calculator with example-based tests.
-   Risk notes, invitations and invoices.
-   Durable background job processing.
-   Secure downloads and immutable document snapshots.

### Phase 4 --- Statements and operational hardening

-   Invoice batches and statements with approved accounting rules.
-   Job monitoring, stale-job recovery and orphan reconciliation.
-   Backup restoration drills and monitoring/alerts.
-   Security review and data-retention policy.
-   End-to-end acceptance tests and production runbook.


## 17. Definition of done for the initial release

The system should not be considered production-ready until:

-   Agents can authenticate, log out and have expired/disabled sessions
    rejected.
-   Client, policy, insurer, vehicle and document records are validated
    and searchable.
-   A policy cannot have duplicate active renewals.
-   Every allowed and disallowed renewal transition is tested.
-   Concurrent updates cannot silently overwrite one another.
-   Receipt records preserve who entered them and when.
-   Premium calculations have verified examples, boundary tests and
    documented rounding.
-   Deferred-payment workflow is excluded from the initial release and is not represented as a status or completion bypass.
-   Generated documents reflect a defined, reproducible data snapshot.
-   Background jobs survive restarts, retry safely and expose terminal
    failures.
-   Downloads are authorised and use short-lived URLs.
-   Statements reconcile to the agreed accounting model.
-   Audit events preserve material changes.
-   Database and document recovery procedures have been tested.
-   Production configuration, monitoring, alerts and a
    rollback/migration plan exist.


## 18. Binding decisions

This section records binding business and scope decisions. Where a low-risk implementation detail does not require a separate business decision, use the defaults in Section 19.

### 18.1 Renewal calendar and initiation

- Annual renewals use calendar-month periods. The renewal period is derived from the policy's current cover period and the agreed annual renewal convention; it must not drift by adding an arbitrary number of days.
- Renewals are initiated manually by an agent. The application may surface policies approaching expiry and prevent duplicate active renewal records, but it must not autonomously request or communicate renewal terms.
- The agent requests/receives the insurer's renewal invitation or offer for the upcoming renewal month. This incoming insurer document is required to initiate renewal preparation and establish the renewal pricing baseline from the source document. For example, a request made in late September may concern November renewals. Preserve the source document, received date and offer version because the insurer may revise rates or terms later.
- The insurer's incoming renewal invitation is the source document for the initial offer baseline, not an unquestionable final premium. An agent must receive and review it before preparing a client invitation. Until that incoming offer is captured, the renewal may be tracked but must not be treated as having an established pricing baseline. Preserve the quoted premium and offered terms separately from calculator results. Revised insurer offers are uploaded as new linked source documents; the agent may also enter permitted negotiated adjustments and eligible added benefits, calculate the revised premium, and record the final agreed terms.
- A client invitation is prepared only after the insurer terms have been reviewed. The agent remains responsible for checking the invitation and communicating it outside the system; automatic external delivery is out of scope.
- Invitations may be grouped by client, insurer and renewal term where that is operationally appropriate. Medical/health invitations are prepared separately rather than combined with other policy types. Insurer documents remain separate source documents and are linked to the relevant records.
- Incoming insurer offer documents and revisions must be preserved as distinct linked source documents with their associated received facts and baseline snapshots. A later document must not silently overwrite an earlier one. The source document used for the current renewal baseline and the basis for final agreed terms must remain traceable.
- Renewal communication and requests for changes are recorded in the activity timeline. Activity entries do not themselves change workflow status.

### 18.2 Renewal completion and deferred payment

- Deferred-payment authorisation and deferred-payment completion are excluded from the initial release because the brokerage's current practice is informal and has not been defined as a formal approval workflow. Do not build a dedicated deferred-payment state, authorisation model or bypass.
- If management gives an exceptional instruction to proceed, an agent may record the instruction as an internal Activity with the relevant context and author, but this note is not a substitute for the normal recorded client proof of payment and insurer workflow. This is an interim recordkeeping mechanism, not a formal deferred-payment feature.
- The workflow must distinguish client proof of payment, the brokerage's decision to instruct renewal, the instruction sent to the insurer, the insurer-issued receipt/cover confirmation, and invoice/payment-allocation balances.
- Completion updates the policy's current cover dates and queues the required completion documents. Generated documents remain immutable snapshots; a later correction requires a new document/version rather than mutating the historic artifact.
- The design does not require a separate formal `cover_in_force` status in the initial release. The insurer-issued receipt is the workflow indicator that cover is active and commission-eligible; recording the receipt must remain distinct from proof of payment and should not silently rewrite unrelated renewal workflow statuses.

### 18.3 Proof of payment, insurer receipts and balances

- Proof of payment and insurer receipts are separate document types. Proof of payment is client-side/supporting evidence (for example, an M-Pesa message, bank-transfer confirmation, cheque-related document or IPF form). Once an agent reviews and records it, it is the brokerage's operational basis for instructing the insurer to renew; it still does not establish that the insurer received the funds or activated the cover.
- An insurer receipt is issued by the insurance company and confirms that the insurer has received the money. In the agreed brokerage workflow, it is the indicator that cover is active and that the policy can be treated as commission-eligible, subject to the applicable insurer/brokerage terms. Keep the insurer receipt linked to the client, policy and relevant renewal, with available insurer, receipt reference, date, amount, file key, notes, creator and timestamp.
- Proof-of-payment records must retain the client and relevant policy association, and the renewal association where applicable, plus available amount/date/reference, evidence category, file key, notes, creator and timestamp. Missing information must be represented as unknown rather than invented.
- Do not automatically convert proof of payment into an insurer receipt or infer insurer fund clearance from the proof. Record a separate renewal-instruction event after the agent accepts the proof, and record insurer receipt/cover confirmation when it arrives. Keep both distinct from payment allocations and invoice balances.
- A single payment instrument or payment event may cover multiple invoices for the same client (for example, one cheque allocated across policies invited during a month). Record the payment once, then record explicit allocations to relevant invoices; the net active allocation total must not exceed the valid payment amount, and any unallocated remainder stays visible. Partial payments are supported. The original invoice remains intact, and balances change only through recorded allocations/approved credits. Corrections and reversals are append-only and audited. Statements show invoice debits, net allocations/credits, running and closing balances, and separately visible unapplied funds. An insurer receipt does not necessarily mean every client invoice is fully settled.
- Payment processing, bank integrations, M-Pesa integrations and automatic parsing of M-Pesa messages remain out of scope. Documents are recorded manually. The initial release may track commission eligibility indicated by the insurer receipt, while full commission calculation/accounting remains deferred unless separately approved.

### 18.4 Premium calculator and rate data

- The premium calculator is the calculation authority for supported, validated rating methods; it is not merely an indicative estimator. The insurer's incoming renewal offer is required to establish the renewal baseline, but its quoted premium is a reference/proposal rather than unquestionable final truth. The calculator uses the applicable configured method: for example, value brackets with a minimum premium for motor, combined declared building/contents values for domestic cover, or selected medical tiers with limits and premiums. Agents may record permitted negotiated loadings/discounts and eligible added benefits as explicit adjustment lines. Preserve the incoming offer amount, calculated amount and selected transaction terms separately. Missing, ambiguous or unverified required data blocks a definitive calculation. Illustrative motor brackets/rates must not be treated as production rules until exact rates and boundary inclusivity are confirmed against the insurer's schedule.
- Rate tables are associated with an insurer and policy type and are effective-dated/versioned. Updating rates must preserve historical values used in earlier calculations and documents.
- If rate data is missing, invalid, ambiguous, or does not cover the insured value, calculation is blocked until the rate data is corrected. The system must not guess, extrapolate, silently use a different insurer's rate, or return a plausible-looking total based on incomplete data.
- Invalid data includes unusable effective dates, invalid percentages/amounts, malformed brackets, overlapping brackets that make selection ambiguous, or required tax/benefit data that cannot be validated. Bracket coverage must be checked for the insured value before calculation proceeds.
- A successful calculation returns the base premium, selected bracket/rate, selected benefit lines and complimentary status, explicit loading/discount/adjustment lines, subtotal, applicable tax/levy lines, and total. The inputs, all effective-dated rule versions and calculation-engine version must be traceable for reproducibility.
- Persisting a PremiumCalculation must not by itself change the policy's current agreed premium, mark terms agreed, issue cover or generate an invoice. Those are separate explicit workflow actions. Monetary amounts are represented as integer KES; percentage arithmetic uses decimal/numeric types. Rounding is applied consistently at the defined calculation boundary and tested with examples.

### 18.5 Documents, offers and historical records

- Documents may be attached to clients, policies and renewals. Categorisation must be flexible enough to support KYC, insurer renewal documents, insurer-issued receipts, client proof of payment, valuation/inspection reports, proposal forms, correspondence and future categories without requiring a database schema change for every new category.
- Insurer-issued receipts and client proof of payment are distinct document categories and must remain distinct in records and workflows. Proof of payment is linked to the relevant client/policy and, where applicable, renewal; any recorded payment amount used for balance calculations must be separately traceable. An insurer receipt confirms that the insurer received the money and serves as the workflow indicator for active cover and commission eligibility, subject to applicable terms.
- Generated invitations, risk notes, invoices, invoice batches and statements are immutable snapshots. Updating a client, policy, insurer, offer or rate table does not rewrite a previously generated artifact. A risk note links to the policy, applicable renewal/cover-change event and exact PremiumCalculation used for its figures. Risk-note generation is conditional on insurer requirements for the specific product/cover and event, confirmed by the agent against relevant instructions/source documents; the risk note itself is not a premium source of truth. Transaction types for risk notes are strictly limited to `new_business`, `renewal`, and `endorsement`. Cancellations strictly never produce a Risk Note; mid-term cancellations are verified and recorded via the carrier's Cancellation Certificate and credit note. If terms change, create a new calculation and a new document version where required.
- Preserve each incoming insurer offer document and later revision from the insurer associated with the existing policy. Comparison shopping and structured comparison of quotes from multiple insurers are out of scope for the initial release. Agents may record external quote discussions, bargaining context or correspondence as Activities/attachments, but the system does not manage a multi-insurer quote-comparison workflow. Supersession of a source document or renewal baseline must be explicit; records must not be silently overwritten or deleted as a shortcut to correction.
- Access to document metadata and file downloads must be authorised. Downloads use short-lived signed URLs or an equivalent protected mechanism.
- Endorsement lifecycle management, endorsement approvals and endorsement premium adjustment workflows remain deferred. The initial release can record an endorsement-related risk note manually. Policy cancellations do not use endorsements or risk notes; they transition policy status to cancelled and attach the insurer's cancellation certificate.

### 18.6 Workflow, dashboard and activity history

- Renewal status represents business workflow state; activities represent what happened. Phone calls, emails, meetings, reminders and notes do not create new workflow statuses and do not automatically transition a renewal.
- The dashboard is the default landing page after login and surfaces renewals awaiting insurer/carrier documents, renewals awaiting client response, renewals awaiting payment, policies expiring within 30 days and recently completed renewals. Each item links to the relevant record.
- Global search is a core navigation feature. It searches clients, policies, renewals, vehicles and documents using relevant fields such as client name, phone, KRA PIN, policy number, vehicle registration, insurer name and document title. Results are grouped by entity type, and search is available through a visible control and Command+K.
- Activity records include the client, optional policy and renewal references, type, body, creator and timestamp. Activities are visible from relevant client, policy and renewal screens.

### 18.7 API, concurrency and data integrity

- Renewal state transitions are validated by the backend, not trusted to the frontend. Updates use optimistic concurrency via the current record version; stale updates return HTTP 409 with a stable error code.
- Enforce at most one active renewal per policy in the database as well as in application logic.
- Use consistent API route conventions across the backend, frontend and tests. Invoice-batch and statement creation use the collection routes `POST /invoice-batches` and `POST /statements`; downloads use their corresponding resource routes. Do not maintain conflicting alternate route patterns.
- Document-generation endpoints must represent pending and failed jobs consistently. A request that starts asynchronous work must return a durable job/resource identifier or another defined way to check status. Statements may use the documented no-stub exception: do not create a statement record until generation and upload succeed, while still returning a request/job identifier for status tracking.
- Database foreign keys use restrictive deletion behaviour for business records. Corrections and replacements are explicit, auditable operations; preserve historical records rather than cascading deletes through financial or policy history.

### 18.8 Security, audit and operations

- The system is an internal, single-brokerage application. No public registration or multi-tenancy is required for the initial release.
- Authentication, session expiry/revocation, input validation, secure cookie/session handling, CSRF protection where applicable, access checks and rate limiting for sensitive authentication routes are implementation requirements.
- Audit material financial and workflow changes, including receipt creation/correction, renewal state changes, payment allocation/correction and renewal instruction, changes to insurer rates/taxes, and document supersession. Record actor, timestamp, entity, action and relevant before/after values without unnecessarily copying sensitive document contents into logs.
- Background document jobs must be durable, retryable and idempotent. Failed jobs must be visible and recoverable; workers must not produce duplicate invoices or other artifacts after retries.
- Use PostgreSQL, a FastAPI backend, a browser-based React frontend with TanStack Query, Cloudflare R2 for object storage and a background worker for document generation. Railway is the planned deployment platform. Docker Compose is for local development.
- Run database migrations as a controlled deployment step. Maintain backups and test restoration; use monitoring and alerts for application errors, failed jobs, storage failures and backup health. Production readiness requires a documented rollback and recovery procedure.

### 18.9 Immutability, versioning, deletion and correction rules

These rules govern all update/delete APIs and take precedence over generic CRUD conventions. They preserve the distinction between correcting a current working draft and rewriting a fact or artifact that has already influenced a calculation, transaction, communication, financial balance or audit trail.

**General rule:** ordinary `PUT`, `PATCH` or `DELETE` operations must not rewrite a record once it has been published, received as an external source, selected for a transaction, issued, allocated, relied upon by a generated artifact, or included in a statement. Use optimistic concurrency for editable drafts. For historical records, use a successor version, explicit supersession, void/correction event or compensating record appropriate to the record type. Preserve the original identifier, contents, actor, timestamps and links. Record a correction reason and who/when made the correction. A correction must not silently cascade into dependent records or generated documents.

| Record type | Editable before use | After use / correction rule | Deletion rule |
|---|---|---|---|
| Rate-table versions, brackets, benefits and tax/levy rules | Draft versions may be edited and validated. | Once published or referenced by a persisted calculation, freeze that version. Correct by creating and validating a successor version with its own effective interval and change reason. Do not alter prior calculations by changing the old version. | A draft may be discarded only if it has never been published or referenced and no audit/retention rule requires preservation. Published or referenced versions cannot be deleted; retire them prospectively. |
| Insurer renewal offer documents and renewal baseline snapshot | An uploaded draft document can be replaced/versioned before it is relied on, while retaining upload audit history. | Once received or used as a renewal baseline, preserve the source document and received facts. A revision is a new linked source document; explicitly update the renewal baseline reference/snapshot with an audit event. Do not rewrite an earlier document or make it match the brokerage's calculated or negotiated terms. | A received or referenced source document is not hard-deleted; unused uploads may be archived only under the retention policy. |
| Benefit definitions and selections | Benefit configuration is editable only within an unpublished rate/product draft. A proposed transaction's benefit selection may be changed before it is committed to an invitation or agreed terms, provided a new calculation is made. | Published benefit rules follow rate-table version rules. A changed transaction selection requires a new PremiumCalculation and, where applicable, new invitation/risk-note versions. Historical selections remain on the calculation snapshot. | Do not delete published/referenced benefit rules or selections that support historical calculations/documents. Retire or supersede them. |
| PremiumCalculation | Inputs may be revised by creating another calculation run; a transient, unpersisted form can be edited freely. A persisted calculation itself is not an editable draft. | Immutable after persistence. Recalculate into a new ID with a full input/rule/engine snapshot. Explicitly select the new run if it is to support proposed terms. Do not mutate an old result or silently replace the calculation referenced by a document. | No hard delete for persisted calculations. Unselected runs remain as historical records; if an erroneous run needs to be excluded, mark it invalid/superseded with reason while retaining it and its audit trail. |
| Invoices and invoice batches | Invoice draft fields, if a draft stage is implemented, may be edited before issuance and before any external use; batch membership may be adjusted before the batch is frozen/requested for generation. | Issued invoice amounts and terms are immutable. Correct through an explicitly approved void/reissue, credit or adjustment process, retaining links to the original and correction. Do not infer accounting treatment. A batch freezes invoice membership when its request is accepted; a changed membership requires a new batch/version. | Issued invoices, posted corrections and frozen batches are not hard-deleted. An unused draft may be abandoned if retention rules allow. |
| Insurer receipts and client proof-of-payment evidence | Metadata for an unreviewed upload may be corrected with audit history; preserve the original file and upload facts. | Once recorded/used in a renewal or payment workflow, do not overwrite its source facts or substitute proof of payment for an insurer receipt. Correct misclassification or wrong linkage with an audited correction/reclassification event and preserved original; if the insurer issues a corrected receipt, record the new receipt as a linked successor. | Evidence referenced by a workflow, allocation, statement or audit event is not hard-deleted. Unused duplicate uploads may be archived only under the retention policy, with traceable disposition. |
| PaymentRecord, PaymentAllocation and financial correction events | A draft not yet committed may be edited. | Committed records are append-only. Reverse/correct with linked events, reason, actor and timestamp. Reverse affected allocations atomically when a payment is reversed. Do not edit amount, invoice, or allocation to make a balance appear correct. | No hard delete of committed payment/allocation/correction history. |
| Risk notes, renewal invitations and other generated documents | Source inputs can be changed before the generation request is accepted; correct the inputs and validate before snapshotting. | The accepted job's snapshot and successfully generated artifact are immutable. If terms/source data change, create a new calculation and a new artifact version where appropriate; mark the prior artifact superseded but retain it and its job/audit history. Failed jobs may be retried only against the same snapshot; changed inputs require a new job/version. | Do not hard-delete generated artifacts referenced by a workflow, client communication or audit trail. A never-issued failed/unreferenced artifact may be marked abandoned under retention policy, not silently erased. |
| Activities and audit events | A working note may be corrected before it is saved, if applicable. | Saved audit events are append-only. Correct a mistake by adding a follow-up/correction activity that links to the original; never rewrite audit history. | No hard delete through ordinary CRUD. Retention/disposal must follow a separately approved policy. |

**API implications:** use `PATCH`/`PUT` only for explicitly editable draft resources, with `If-Match`/expected version and a `409` on stale writes or an attempted update of a frozen resource. Use explicit actions such as `POST .../publish`, `POST .../supersede`, `POST .../reverse`, `POST .../void` or a domain-specific correction route where appropriate; these are proposed patterns, not a claim that every route already exists. A generic delete route must not mean replace, supersede, void or correct. If deletion of an unused draft is allowed, expose it as a separately authorised operation with eligibility checks and an audit record. Return stable conflict codes that explain why the operation is forbidden and which corrective workflow is permitted.

**Dependencies and snapshots:** updating a client, policy, insurer, renewal baseline, benefit, rate table or template must not mutate a persisted PremiumCalculation, an issued invoice, a payment allocation, a statement snapshot or a generated document. Downstream records change only through an explicit business transition or newly created successor artifact. A statement already generated remains a record of its original cutoff and included entries even if a later payment correction changes the current balance; any restated output must be a new statement linked to the original.

### 18.10 Scope boundaries reaffirmed

The initial release does not include client-facing accounts, public registration, payment collection/processing, direct insurer integrations, automatic renewal invitations, automated email delivery of generated documents, M-Pesa message parsing, endorsement lifecycle management, or commission accounting. These are deferred features, not implicit requirements.

### 18.11 Single-Underwriter Placement & Dedicated Carrier Liaisons

- **Single-Carrier Placement:** 100% of policy risk is placed with a single selected underwriting carrier per policy container. The agency does not participate in multi-carrier co-insurance consortia, lead/follower syndication, or percentage risk splitting.
- **Dedicated Underwriter Liaisons & Certificate Delivery:** HealthWatch maintains direct communication with dedicated contact persons and account managers at major partner underwriters (such as Old Mutual and Britam). Renewal terms, schedules, and digital motor certificates (DMIC) are received via direct email correspondence from these carrier representatives. Staff review and upload these authoritative documents directly into the system's Document Vault without requiring direct carrier API integrations.
- **Salaried Internal Agency Structure:** HealthWatch operates with full-time salaried account managers. Commission is recognized 100% at the agency entity level; there are no freelance sub-agent commission splits or third-party producer commission ledgers.

### 18.12 Motor Third Party Only (TPO) Rating & Statutory Mandate (Cap 405)

- **Statutory Mandate:** Motor Third Party Only (TPO) is mandatory cover under the Insurance (Motor Vehicles Third Party Risks) Act (Cap 405, Laws of Kenya). It indemnifies the insured against third-party bodily injury/death (unlimited by law) and third-party property damage (standard statutory limit KES 3,000,000 up to KES 20,000,000), providing zero own-damage or theft protection.
- **Rating Authority:** **Independent of vehicle market value or sum insured.** TPO is rated as a **flat fixed annual tariff** based strictly on vehicle classification and usage (e.g. Private Motorcars: flat KES 7,500–9,500/year; Commercial Own Goods: flat KES 10,000–15,000/year; Boda-Boda: flat KES 3,000–5,000/year; PSV/Taxi: flat base plus Passenger Legal Liability per seat).
- **Statutory Levies:** Subject to standard 0.20% Insurance Training Levy, 0.25% Policyholders Compensation Fund levy, and KES 40.00 Stamp Duty.

### 18.13 Declared Wage-Roll Schedule Rating (WIBA)

- **Statutory Workplace Indemnity:** Work Injury Benefits Act (WIBA 2007) policies cover employee workplace accidental death, injury, and occupational disease.
- **Rating Authority:** Computed directly against declared annual payroll schedules classified by occupational risk: Clerical (~0.50%), Artisans/Technical (~1.50%), Hazardous/Industrial (~3.50%), subject to underwriter minimum premiums (typically KES 25,000).
- **Operational Workflow:** Clients submit schedules with employee payrolls. The agency uses those declared payroll figures as-is for quote-to-bind and inception. For annual renewals, if the client does not request adjustments, current payroll values are carried directly into the renewal invitation without retrospective payroll audit friction.

### 18.14 Tripartite Insurance Premium Financing (IPF) under Section 156A

- **Statutory Compliance:** Under Section 156A of the Insurance Act ("Cash and Carry"), risk assumption requires prior payment or a guaranteed credit facility. Tripartite IPF facilities (Client, Financier Bank, Carrier) satisfy this mandate.
- **Ledger Invariant:** A minimum 20% downpayment is recorded as a `PaymentRecord` (`PaymentMethod.IPF` or bank deposit), and the irrevocable bank commitment letter is uploaded as a `Document`.
- **Cover Inception:** The verified bank commitment guarantee legally confirms premium settlement, unlocking cover inception and renewal completion prior to actual loan disbursement from the bank.

### 18.15 Outward Carrier Commission & Remittance Ledger

- **Statutory Commission Caps:** System enforces Insurance Act (Cap 487) statutory commission caps (10% Motor, 15% Fire, 20% Domestic).
- **Remittance Formula:** $\text{Net Carrier Remittance} = \text{Gross Invoice Total} - (\text{Gross Commission} \times 0.95)$ (retaining 5% statutory Withholding Tax at source).
- **Reconciliation Invariant:** Provides exportable tabular remittance statements to feed and reconcile against agency accounting spreadsheets and insurer credit notes.

### 18.16 Claims Advocacy & Policy Lifecycle

- **Claims Tracking:** Lean `Claim` entity linked to `Policy`, `Client`, and `Vehicle` capturing the full advocacy lifecycle (`intimated` ➔ `documents_pending` ➔ `adjuster_appointed` ➔ `repairs_authorized` ➔ `discharge_voucher` ➔ `settled` / `declined`).
- **Renewal Triage Integration:** Active claims and loss ratios are surfaced on the Renewals Desk to empower agents in negotiating waiver of carrier loading penalties or preserving claim-free discounts.

### 18.17 Expanded Commercial & Retail Lines

The system catalog and rating engine support:
1. **Commercial Fire & Special Perils:** Sums insured on buildings, plant, machinery, and stock.
2. **Commercial Burglary & Theft:** First-loss and full-value stock cover with violent entry clauses.
3. **Standalone All Risks:** High-value portable equipment (laptops, cameras, surveying gear).
4. **Personal Accident (PA):** Tiered accidental death, PTD, and medical reimbursement packages by occupational hazard class.
5. **Golfers Insurance:** Comprehensive package covering equipment, clubhouse effects, third-party liability, personal accident, and official Hole-in-One bar reimbursement.
6. **Professional Indemnity (PI) & Public Liability (PL):** Limit of Indemnity and practice fee turnover or premises hazard class.

## 19. Implementation defaults where no separate business decision is needed

Use the following defaults to keep implementation consistent without reopening settled business questions:

1. **Renewal creation:** create a renewal record through the manual agent workflow when the policy enters the renewal preparation window (target approximately 30 days before expiry); enforce one active renewal per policy. A scheduled job may surface upcoming renewals but must not initiate insurer communication.
2. **Insurer offer documents:** store each received offer and subsequent revision from the existing insurer as a source document linked to the client, policy and renewal. Preserve the received date and the baseline snapshot used by the renewal. There is no separate offer-management subsystem; multi-insurer quote comparison is out of scope. External quote context may be recorded in Activities or attached correspondence.
3. **Deferred payment:** do not implement a dedicated deferred-payment workflow in the initial release. If management gives an exceptional informal instruction, record it as an internal Activity with author, timestamp and context; do not treat it as a new state or silently bypass the normal evidence/instruction/insurer-confirmation workflow.
4. **Rate validation:** validate according to the configured pricing method and effective date. For bracketed methods, exactly one bracket must apply; zero matches or multiple matches blocks calculation. For tiered products, require one valid selected tier with its configured limits and premium. For multi-component sum-insured methods, validate each required value component and the formula. Validate required taxes and selected benefits before computing.
5. **Calculation precision:** use decimal arithmetic for percentages and intermediate amounts; round monetary line items to integer KES using one documented rounding rule before summing the displayed total. Cover the rule with unit tests.
6. **Payment capture and allocation:** `PaymentRecord` represents one manually recorded payment instrument/event; `PaymentAllocation` applies a positive amount from it to one invoice. Store the client, amount, currency, date/method/reference when known, evidence, actor and timestamp. One payment can fund multiple invoices for the same client, and one invoice can receive multiple payments. Validate client/currency match and enforce net allocations not exceeding the valid payment amount transactionally. Expose the unallocated remainder; do not auto-allocate it. This is manual record-and-allocation, not payment processing or a bank integration.
7. **Payment correction and statements:** never hard-delete or silently edit a payment/allocation relied on by a statement. Reverse with an append-only linked event, actor, timestamp and reason; reverse affected allocations atomically when reversing a payment. Calculate invoice balances from invoices minus net active allocations and approved credits, not from proof-of-payment evidence or the full amount of a partly allocated payment. Statements show period, opening balance, debits, allocated credits, running/closing balance and unapplied funds separately. Use a deterministic entry ordering. Opening-balance and any treatment of unapplied funds as a client-level credit require an explicit accounting decision before implementation.
8. **Document jobs:** persist job state and idempotency key; use `pending`, `processing`, `succeeded` and `failed` states. Retry transient failures with bounded backoff, expose terminal failures and reconcile orphaned storage objects/records.
9. **Snapshot timing:** capture the data required for a generated document when the generation request is accepted, not when a delayed worker eventually executes. The worker renders from that snapshot.
10. **Audit and correction:** treat audit events as append-only. Correct mistakes with compensating events or superseding records rather than rewriting the audit history.
11. **API errors and pagination:** use a consistent error envelope; use 400 for malformed requests, 401 for unauthenticated requests, 404 for missing resources, 409 for business-rule/concurrency conflicts, 422 for validation failures, and 503 for temporarily unavailable dependencies. Retry only transient 503 responses. Paginate large lists with a default limit of 20 and maximum of 100.
12. **Testing:** require unit tests for renewal transitions, proof-of-payment acceptance, insurer receipt semantics, multi-invoice payment allocation, rate/pricing-method validation, tax and rounding, and snapshot immutability; integration tests for database constraints and object storage; and end-to-end tests for the main renewal path, blocked invalid calculations, failed/retried document jobs and statement reconciliation.
13. **Retention and privacy:** define retention periods and access/disposal procedures before production data is loaded. Do not hard-delete policy, payment or audit history through ordinary CRUD operations. Restrict sensitive identity and financial records to authenticated staff and log access or changes where appropriate.
14. **Operational acceptance:** production release requires a successful backup restoration drill, monitoring and alerts, a migration/rollback plan, secure signed downloads, and documented recovery steps for failed background jobs.

## 20. Final acceptance checklist

The implementation is ready for initial production use only when all of the following are demonstrated:

- [ ] Agents can authenticate, log out, and have expired or revoked sessions rejected.
- [ ] Client, policy, vehicle, insurer, source-document and renewal records can be created, found and linked correctly.
- [ ] Annual renewal dates follow the calendar-month rule and manual initiation remains under agent control.
- [ ] The incoming insurer offer and any later revisions are preserved as linked source documents; the source document and baseline snapshot are retained without a separate offer-management subsystem or multi-insurer quote-comparison feature.
- [ ] Renewal transitions distinguish proof of payment accepted, instruction sent to insurer, insurer receipt/cover confirmation and completion.
- [ ] Recording accepted proof of payment enables the agent to instruct the insurer, without falsely claiming that funds have cleared or that the insurer has issued a receipt.
- [ ] Payment instruments covering multiple policies for the same client can be recorded once and allocated to multiple invoices, with unapplied balances visible and over-allocation prevented transactionally.
- [ ] PaymentRecord and PaymentAllocation preserve minimum source, amount, client/invoice, actor, timestamp and evidence references; correction/reversal is append-only, reasoned and auditable.
- [ ] A payment reversal cannot leave active allocations greater than the valid payment amount; correcting an allocation requires reversal plus a replacement allocation rather than editing the original.
- [ ] Statements calculate invoice balances from net active allocations and approved credits, never from proof-of-payment evidence or an unallocated portion of a payment; unapplied funds are displayed separately.
- [ ] Invalid, missing, ambiguous or unverified required rating data blocks a definitive premium calculation.
- [ ] Before production, each insurer/product schedule has been verified for exact rates, motor bracket endpoints/inclusivity, minimum-premium scope, domestic component formula, medical tier premiums/limits, benefit eligibility, tax/levy applicability/order, negotiated adjustment permissions/caps and authoritative rating date.
- [ ] Published rate-table versions are immutable; draft validation/publication rejects ambiguous brackets, overlapping effective versions, missing required tax/benefit rules and unsupported formula combinations.
- [ ] Calculations record exact rule versions, input snapshot, rating date, engine version, unrounded intermediates, rounded line items and validation outcome for historical reproducibility.
- [ ] Calculation results are reproducible and use verified KES rounding, taxes, benefit and adjustment examples.
- [ ] The incoming insurer offer document and its baseline snapshot are preserved; later insurer revisions are uploaded as new linked source documents rather than overwriting the original.
- [ ] Permitted negotiated loadings/discounts and added benefits appear as explicit calculation lines and can be audited.
- [ ] Premium calculations persist immutable inputs, rating-rule versions and outputs; selecting a calculation is explicit and does not silently update the policy.
- [ ] Client-facing renewal invitations are generated from an explicitly selected persisted PremiumCalculation, retain its reference and an immutable terms/document snapshot, and cannot independently override its premium or benefits.
- [ ] Risk notes and invoices link to the calculation/terms snapshot used for their figures; later recalculations do not rewrite previously generated documents.
- [ ] Concurrent updates cannot silently overwrite newer changes.
- [ ] Generated documents render from immutable request-time snapshots; workers never substitute mutable current data after a job is accepted.
- [ ] Risk notes, renewal invitations, invoices, invoice batches and statements share the `pending` / `processing` / `succeeded` / `failed` API job states, with the documented invoice and statement resource-creation exceptions preserved.
- [ ] Generation idempotency keys are persisted and payload-bound; domain uniqueness prevents duplicate logical invoices, batches or other artifacts even when clients use different keys.
- [ ] Retry tests cover transient and permanent failures, bounded backoff, exhausted retries, authorised manual retry, worker restart, stale leases, and crashes before/after object upload. Retries must not duplicate business records or change the original snapshot.
- [ ] The UI persists the job ID, shows pending/processing/ready/failed states, disables download until the artifact is committed, displays safe failure messages, and offers retry only when permitted.
- [ ] Invoice batches preserve the invoice membership snapshot captured when requested; statements preserve their period/cutoff and included-entry snapshot across retries.
- [ ] Background jobs survive restarts, retry safely and expose terminal failures without duplicating artifacts.
- [ ] Invoices are generated when new or renewed cover is given; statements reconcile invoices, recorded payments/credits and outstanding balances, including partial payments.
- [ ] Payment evidence (M-Pesa, bank transfer, cheque documentation, IPF form or other supporting document) is linked to relevant clients/policies/renewals; accepted evidence supports the brokerage's decision to instruct renewal but is not represented as insurer-cleared funds.
- [ ] For each relevant new-business, renewal or premium/risk-change event, the agent can record whether a risk note is required based on the insurer's instructions for that product/cover and event; policy type alone does not determine the requirement, and generation occurs only when required.
- [ ] Document downloads are authorised and use short-lived URLs.
- [ ] Audit events cover material payment allocations/corrections, proof-of-payment acceptance, renewal instructions, insurer receipt recording, and rate changes.
- [ ] Draft-only edits use optimistic concurrency; attempts to mutate frozen/published/issued records return a stable conflict and direct the caller to the correct successor, reversal, void or correction workflow.
- [ ] Published or calculation-referenced rate tables, brackets, benefits and tax rules cannot be edited/deleted; successor versions preserve historical calculations.
- [ ] Received insurer offer documents, persisted premium calculations, issued invoices, payment/receipt evidence and generated artifacts preserve original contents and traceable supersession/correction links.
- [ ] Statement snapshots remain unchanged after later payment corrections; any restatement is a new version linked to the prior statement.
- [ ] Backups have been restored successfully in a test, and production monitoring, alerts and rollback procedures are documented.

---

**Document control:** This is the current system specification and implementation baseline as of 18 October 2026. It is not evidence of implementation completion, regulatory sign-off, or successful testing. Any future change to a binding rule must be recorded as a dated amendment and reflected in the acceptance tests.
