# HealthWatch MS

An insurance agency management workspace for Kenyan retail and SME portfolios, tracking client KYC, policy containers, deterministic premium calculations, annual renewal workflows, document generation, and bounded receivable/payment ledgers.

## Language

### Parties & Portfolio

**Agency**:
The insurance intermediary business (HealthWatch) representing insurance carriers and managing policy portfolios on behalf of clients.
_Avoid_: Insurer, carrier, underwriter, brokerage consortium

**Agent / Account Manager**:
A salaried staff member who manages client portfolios, coordinates carrier terms, and executes renewals and claims advocacy.
_Avoid_: Broker, sub-agent, freelance producer

**Client**:
An individual or corporate entity whose insurance policies are managed by the agency.
_Avoid_: Customer, buyer, account

**Portfolio**:
The complete collection of active and historical policies, assets, documents, and financial records belonging to a client.
_Avoid_: Account summary

**Insurer**:
A licensed insurance carrier (underwriter) that assumes 100% of the underwriting risk for a policy.
_Avoid_: Agency, vendor, provider

**Product**:
A specific class of insurance cover offered by an Insurer (such as Motor Private Comprehensive, Domestic Package, WIBA, or Family Medical) governed by a published rate schedule.
_Avoid_: Plan, policy

### Contracts, Rating & Lifecycle

**Policy**:
The durable contract container identified by the carrier's policy number, linking a Client and a Product across annual cycles without storing transient coverage snapshots directly on the container.
_Avoid_: Risk note, cover slip, quote

**Vehicle**:
A motor asset attached to a Policy, capturing registration number, make, model, year, insured value, and certified valuation metadata.
_Avoid_: Risk item

**Acquisition Form**:
The new-business intake record capturing client KYC, preliminary asset values, and operational placement instructions to the Insurer (such as requesting a temporary cover note pending valuation).
_Avoid_: Quote request

**RateTableVersion**:
An immutable, versioned schedule of pricing brackets, minimum premiums, benefit limits, and levy rules for a Product (`draft`, `published`, `retired`).
_Avoid_: Pricing config

**PremiumCalculation**:
A persisted, deterministic calculation run that evaluates an input snapshot against a published `RateTableVersion` and `StatutoryLevy` rules to produce itemized, fixed-point `Decimal` KES totals; the sole calculation authority in the system.
_Avoid_: Estimate, draft quote

**StatutoryLevy**:
The mandatory Kenyan insurance levies and stamp duty applied to net base premium (0.20% Insurance Training Levy, 0.25% Policyholders Compensation Fund, and KES 40.00 Stamp Duty, with Medical policies exempt from Stamp Duty).
_Avoid_: Tax estimate, fee

**Renewal**:
The 6-stage annual expiration workflow (`awaiting_carrier`, `carrier_received`, `client_invited`, `changes_requested`, `paid`, `completed`), constrained to at most one active renewal per Policy.
_Avoid_: Endorsement, policy extension

**Invitation**:
The client-facing renewal offer prepared by an Agent from a verified `PremiumCalculation` after reviewing the carrier's renewal notice.
_Avoid_: Carrier renewal notice, invoice

**Endorsement**:
A mid-term modification to an active Policy's coverage or insured assets (such as adding a vehicle or adjusting sum insured after valuation) that produces a delta calculation.
_Avoid_: Renewal

**RiskNote**:
An immutable transaction overview slip (`cover_snapshot`) prepared for the carrier on slip-based lines (Motor, Domestic) for new business, renewals, or endorsements; never generated for Medical policies or cancellations.
_Avoid_: Policy, invoice, receipt

### Financial Ledger & Evidence

**Invoice**:
A formal billing debit issued to a Client for agreed coverage, settled through `PaymentAllocation` records.
_Avoid_: Risk note, bill

**InvoiceBatch**:
A monthly consolidation grouping all Invoices issued to a Client within a calendar month.
_Avoid_: Statement

**PaymentRecord**:
Verified, cleared funds deposited into the agency's bank account or M-Pesa paybill, recorded with instrument reference and available for allocation.
_Avoid_: Proof of payment, insurer receipt, client receipt

**PaymentAllocation**:
The append-only application of a specific amount from a `PaymentRecord` against an outstanding `Invoice` under lock.
_Avoid_: Payment, receipt

**Proof of Payment**:
Unverified client-submitted payment evidence (such as an M-Pesa message screenshot, bank transfer slip, or IPF form) stored as a `Document` without altering `Invoice` balances.
_Avoid_: Payment record, insurer receipt

**Insurer Receipt**:
The formal receipt document issued by the Insurer confirming premium remittance, which confirms active policy cover and unlocks agency commission recognition.
_Avoid_: Payment record, proof of payment, client receipt

**Statement**:
An on-demand chronological account summary generated from a Client's issued Invoices and net active PaymentAllocations, displaying running balances and unapplied funds.
_Avoid_: Invoice batch, ledger export

**IPFAgreement**:
A tripartite Insurance Premium Financing arrangement under Section 156A of the Insurance Act among Client, financing bank, and Insurer, allowing cover inception upon deposit verification and bank commitment letter.
_Avoid_: Installment plan

**CommissionSchedule**:
The statutory agency commission and 5% withholding tax (WHT) calculation derived from a policy's net premium and unlocked upon `Insurer Receipt` verification.
_Avoid_: Broker fee

### Documents, Claims & Operations

**DocumentJob**:
An asynchronous background task that tracks generating and storing a PDF for a domain record (`RiskNote`, `Invoice`, `Statement`, or `PolicySchedule`) from a request-time snapshot.
_Avoid_: Sync export

**RenderedDocument**:
The immutable HTML or PDF output produced from a domain record and its frozen input snapshot.
_Avoid_: Template

**Claim**:
A loss advocacy record linked to a Policy and Client (`intimated`, `documents_pending`, `adjuster_appointed`, `discharge_voucher`, `settled`, `declined`), surfaced during renewal negotiations.
_Avoid_: Incident ticket

**Activity**:
An append-only chronological log entry (call, email, meeting, reminder, or note) attached to a Client, Policy, or Renewal that never triggers workflow state transitions.
_Avoid_: Correspondence, audit trigger

## `SpecialConditions`

Editable markdown clauses attached to a `RiskNote` and included in its `RenderedDocument`.
