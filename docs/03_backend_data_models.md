# Backend Data Models: Insurance Agency Management System

> **STATUS:** Authoritative Data Model Specification
> **ALIGNMENT:** Synchronized with Section 4 and Section 18 of the expanded [insurance_agency_system_documentation.md](./insurance_agency_system_documentation.md).

---

## 1. Identity & Directory Entities

### `User`
Internal staff user operating the application.
- `id`: UUID (Primary Key).
- `email`: String (Unique, Indexed).
- `full_name`: String.
- `role`: Enum (`Admin`, `Underwriter`, `Cashier`, `Operations`, `Viewer`).
- `is_active`: Boolean (Default: True).
- `is_superuser`: Boolean (Default: False).
- `hashed_password`: String.

### `Client`
Individual or business customer whose insurance portfolio is managed by the agency.
- `id`: UUID (Primary Key).
- `client_type`: Enum (`individual`, `business`).
- `name`: String (Indexed).
- `kra_pin`: String (Unique, Indexed, e.g. `A001234567Z`).
- `email`: String.
- `phone`: String (Indexed).
- `postal_address`: Text | None.
- `contacts`: JSON / Relational contact cards for corporate accounts.
- `is_active`: Boolean (Soft delete / active flag).
- *Inherits:* `AuditMixin`.

### `Insurer`
Insurance underwriting carrier partnering with the agency.
- `id`: UUID (Primary Key).
- `name`: String (Unique, Indexed, e.g. "Old Mutual Kenya").
- `code`: String (Unique, e.g. "OM").
- `contact_email`: String | None.
- `contact_phone`: String | None.
- `portal_url`: String | None.
- `is_active`: Boolean (Default: True).
- *Inherits:* `AuditMixin`.

---

## 2. Policy & Risk Engine

### `Product` (Template)
Configurable product offering by an insurer.
- `id`: UUID (Primary Key).
- `insurer_id`: FK -> `Insurer.id` (Indexed).
- `name`: String (e.g. "Motor Private Comprehensive").
- `class_of_insurance`: Enum (`motor`, `health`, `property`, `life`, `other`).
- `pricing_strategy`: Enum (`bracketed_percentage`, `multi_component`, `fixed_tier`, `manual`).
- `form_schema`: JSON (Dynamic field definitions for UI wizards).
- *Inherits:* `AuditMixin`.

### `Policy` (Durable Container)
Long-lived container for a client's insurance coverage with a carrier.
- `id`: UUID (Primary Key).
- `policy_number`: String (Unique, Indexed — assigned by carrier).
- `client_id`: FK -> `Client.id` (Indexed).
- `insurer_id`: FK -> `Insurer.id` (Indexed).
- `product_id`: FK -> `Product.id` (Indexed, Nullable).
- `status`: Enum (`active`, `cancelled`). Lapsed state is derived when current end date is in the past.
- `inception_date`: Date (First inception; immutable).
- `current_start_date`: Date (Current cover period start).
- `current_end_date`: Date (Current cover period end).
- `agreed_premium`: Decimal (`Numeric(15, 2)`).
- *Inherits:* `AuditMixin`.

### `Vehicle` (Motor Policy Asset)
Asset details attached to a motor policy.
- `id`: UUID (Primary Key).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `registration_number`: String (Indexed, e.g. "KCA 123B").
- `make`: String (e.g. "Toyota").
- `model`: String (e.g. "Prado").
- `year_of_manufacture`: Integer.
- `insured_value`: Decimal (`Numeric(15, 2)`).
- `chassis_number`: String | None.
- `engine_number`: String | None.
- `last_valuation_date`: Date | None (Visible on Policy management page; strictly omitted from printed Risk Note document).
- `valuation_report_ref`: String | None (Valuation certificate or document reference).
- `valuer_name`: String | None (e.g. "Regent Valuers", "AA of Kenya").

### `RiskNote` (Immutable Transaction Snapshot)
Frozen representation of cover terms, asset details, and rating breakdown at issuance.
- `id`: UUID (Primary Key).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `risk_note_number`: String (Unique, Indexed).
- `transaction_type`: Enum (`new_business`, `renewal`, `endorsement`). Note: Cancellations strictly never produce Risk Notes.
- `status`: Enum (`draft`, `issued`, `replaced`).
- `calculation_id`: FK -> `PremiumCalculation.id` | None (Exact calculation provenance).
- `previous_risk_note_id`: FK -> `RiskNote.id` (Self-referential lineage for historical baselines).
- `created_by_id`: FK -> `User.id`.
- `effective_date`: Date (Indexed).
- `coverage_start`: Date.
- `coverage_end`: Date.
- `net_premium`: Decimal (`Numeric(15, 2)`).
- `commission_amount`: Decimal (`Numeric(15, 2)`).
- `total_amount`: Decimal (`Numeric(15, 2)`).
- **`cover_snapshot`**: JSON (Frozen transactional overview containing asset terms, limits of liability, deductible/excess schedules, and rating version at issuance).
- **`financial_breakdown`**: JSON (Frozen tax lines: Training Levy, PHCF, Stamp Duty, Base Premium).
- `special_clauses`: JSON / list[str].
- *Trigger & Sequence Rules:*
  - Only generated for product classes requiring carrier cover slips (such as motor or domestic cover). Medical policies never use a Risk Note.
  - Calculation authority remains the versioned `PremiumCalculation` (`calculation_id`).
  - **Inception:** Initial proposal begins with an Acquisition Form capturing vehicle details and insurer instructions (e.g., 1-month temporary cover note / binder awaiting valuation). The definitive Inception Risk Note is issued after certified valuation locks in the agreed sum insured. Takeovers from other brokers are documented via carrier appointment letters in `Document`.
  - **Multi-Vehicle Policies:** A policy covering multiple vehicles generates **one single Risk Note** consolidating all covered vehicles into a single schedule and aggregating financial totals.
  - **Document Standard (One-Page Rule):** Risk Notes follow the canonical 2-column schedule format (~25% label, ~75% details) and are designed to fit on **a single A4 page** with compact margins. `last_valuation_date` is omitted from the document.
  - **Valuation Rule:** Valuation is strictly an external appraisal (typically annual; biennial for Old Mutual); the system does not calculate programmatic depreciation. Renewal invitations include the carrier-specific valuation disclaimer.
  - **Renewal Flow:** The agent references `previous_risk_note_id` as the benchmark when reviewing the carrier's renewal invitation, negotiates loading fees, prepares the agency's renewal invitation, and generates the Renewal Risk Note from the agency invitation's settled terms.
  - **Cancellation Invariant:** Mid-term cancellations never produce Risk Notes; they are handled via `PolicyStatus.CANCELLED` and attach the carrier's Cancellation Certificate and credit note in `Document`.
- *Inherits:* `AuditMixin`.

---

## 3. Renewal Workflow Engine

### `Renewal`
Owns the annual renewal state machine and concurrency versioning.
- `id`: UUID (Primary Key).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `status`: Enum:
  - `awaiting_carrier` (Awaiting carrier's renewal notice).
  - `carrier_received` (Carrier notice received, proposed baseline logged).
  - `client_invited` (Renewal invitation issued to client).
  - `changes_requested` (Client requested amended terms).
  - `paid` (Agency payment record/evidence logged).
  - `completed` (Cover dates extended, completion artifacts queued).
- `version`: Integer (Default: 1, increments on every update for OCC).
- `renewal_period_start`: Date.
- `renewal_period_end`: Date.
- `previous_premium`: Decimal (`Numeric(15, 2)`).
- `proposed_premium`: Decimal | None (`Numeric(15, 2)`).
- `agreed_premium`: Decimal | None (`Numeric(15, 2)`).
- `selected_calculation_id`: FK -> `PremiumCalculation.id` | None.
- `carrier_document_key`: String | None (R2 storage key of carrier notice).
- `carrier_received_at`: DateTime(timezone=True) | None.
- `invited_at`: DateTime(timezone=True) | None.
- `paid_at`: DateTime(timezone=True) | None.
- `completed_at`: DateTime(timezone=True) | None.
- `notes`: Text | None.
- *Constraint:* Unique partial index ensuring **at most one active renewal per policy**:
  `WHERE status NOT IN ('completed', 'cancelled')`.

### `Invitation`
Records generated client renewal invitations.
- `id`: UUID (Primary Key).
- `renewal_id`: FK -> `Renewal.id` (Indexed).
- `calculation_id`: FK -> `PremiumCalculation.id` (Exact calculation reference).
- `storage_key`: String (R2 storage key of invitation PDF).
- `rendered_snapshot`: JSON (Immutable snapshot of terms and rendered values).
- `generated_at`: DateTime(timezone=True).
- `created_by_id`: FK -> `User.id`.

---

## 4. Deterministic Advisory Rating Engine (§4.14, §4.15)

The rating engine unifies two distinct industry pricing paradigms into a single deterministic output:
- **Asset / Indemnity-Based Rating (`bracketed_percentage`, `multi_component`):** Used for Motor and Property. Rates are evaluated against declared asset sums insured via `RateBracket` and component rules, applying minimum premiums and value-based riders.
- **Defined-Benefit Tier Rating (`fixed_tier`):** Used for Medical / Healthcare. Rates are looked up from preset actuarial tables (`MedicalTier`) based on selected inpatient limits, family demographic census (member age brackets, dependent counts), and preset optional benefit riders (Outpatient, Dental, Optical, Maternity).

### `RateTableVersion`
Versioned, effective-dated rating schedules per insurer and cover class.
- `id`: UUID (Primary Key).
- `insurer_id`: FK -> `Insurer.id` (Indexed).
- `class_of_insurance`: String (e.g. "motor_private").
- `pricing_method`: Enum (`bracketed_percentage`, `multi_component`, `fixed_tier`).
- `currency`: String (Default: "KES").
- `version_number`: Integer (e.g. 1, 2, 3).
- `status`: Enum (`draft`, `published`, `retired`). Once published, rules are immutable.
- `effective_from`: Date.
- `effective_to`: Date | None.
- `source_reference`: String (Carrier rate circular reference).
- `change_reason`: String | None.

### `RateBracket` (Motor Pricing)
Value brackets defining rates for asset value bands (convention: `[min_value, max_value)`).
- `id`: UUID (Primary Key).
- `rate_table_version_id`: FK -> `RateTableVersion.id` (Indexed).
- `min_value`: Decimal (`Numeric(15, 2)`).
- `max_value`: Decimal | None (`Numeric(15, 2)`). Null means no upper limit.
- `rate_percent`: Decimal (`Numeric(5, 4)`).
- `minimum_premium`: Decimal (`Numeric(15, 2)`).
- `display_label`: String.

### `RateBenefit`
Optional or mandatory cover riders (e.g. Excess Protector, PVT, Courtesy Car).
- `id`: UUID (Primary Key).
- `rate_table_version_id`: FK -> `RateTableVersion.id` (Indexed).
- `code`: String (Stable code, e.g. "EXCESS_PROTECTOR").
- `name`: String.
- `calculation_type`: Enum (`percentage`, `fixed_amount`).
- `rate_value`: Decimal (`Numeric(15, 2)`).
- `is_mandatory`: Boolean.
- `is_complimentary`: Boolean (Must show as zero-charge line with reason).
- `complimentary_threshold`: Decimal | None.

### `MedicalTier`
Selectable fixed-price tier for healthcare products.
- `id`: UUID (Primary Key).
- `rate_table_version_id`: FK -> `RateTableVersion.id` (Indexed).
- `tier_code`: String (e.g. "A", "B", "C", "D").
- `benefit_limits`: JSON.
- `premium`: Decimal (`Numeric(15, 2)`).

### `TaxRateRule`
Statutory taxes and levies (e.g. Training Levy, PHCF, Stamp Duty).
- `id`: UUID (Primary Key).
- `code`: String (Unique, e.g. "TRAINING_LEVY", "PHCF", "STAMP_DUTY").
- `name`: String.
- `rate_percent`: Decimal (`Numeric(5, 4)`).
- `calculation_basis`: String (e.g. "base_premium", "subtotal").
- `sequence_order`: Integer.
- `is_active`: Boolean.

### `PremiumCalculation` (Persisted Calculation Run)
Immutable, deterministic calculation run.
- `id`: UUID (Primary Key).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `renewal_id`: FK -> `Renewal.id` | None (Indexed).
- `business_event`: Enum (`new_business`, `renewal`, `cover_change`).
- `rating_date`: Date.
- `rate_table_version_id`: FK -> `RateTableVersion.id`.
- `input_snapshot`: JSON (Declared asset values, building/contents, tier, selected riders).
- `rule_provenance`: JSON (Exact bracket, tax rates, and formula versions).
- `calculation_detail`: JSON (Itemized unrounded intermediates, rounded lines, taxes, subtotal, and total).
- `total_premium`: Decimal (`Numeric(15, 2)`).
- `is_selected`: Boolean (Default: False).
- `created_by_id`: FK -> `User.id`.
- `created_at`: DateTime(timezone=True).

---

## 5. Financial Ledger & Payments (§4.9, §4.10)

### `Invoice` (The Debt)
Issued when cover is granted for new business or completed renewal.
- `id`: UUID (Primary Key).
- `invoice_number`: String (Unique, Indexed).
- `client_id`: FK -> `Client.id` (Indexed).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `renewal_id`: FK -> `Renewal.id` | None.
- `calculation_id`: FK -> `PremiumCalculation.id` (Provenance of invoiced charges).
- `date_issued`: Date.
- `due_date`: Date.
- `total_amount`: Decimal (`Numeric(15, 2)`).
- `balance_due`: Decimal (`Numeric(15, 2)` — derived from total minus active allocations).
- `status`: Enum (`unpaid`, `partial`, `paid`, `voided`).
- `storage_key`: String | None (R2 storage key of rendered PDF).
- *Inherits:* `AuditMixin`.

### `InvoiceBatch`
Consolidates all invoices for a client within a calendar month.
- `id`: UUID (Primary Key).
- `client_id`: FK -> `Client.id` (Indexed).
- `billing_month`: String (Format: `YYYY-MM`, Indexed).
- `batch_number`: String (Unique, Indexed).
- `total_amount`: Decimal (`Numeric(15, 2)`).
- `included_invoice_ids`: JSON (Frozen list of invoice UUIDs).
- `generated_at`: DateTime(timezone=True).
- `storage_key`: String.
- *Constraint:* `UNIQUE(client_id, billing_month)`.

### `PaymentRecord` (Agency Money In)
Records payment instruments cleared into the agency account.
- `id`: UUID (Primary Key).
- `client_id`: FK -> `Client.id` (Indexed).
- `amount`: Decimal (`Numeric(15, 2)` — whole-KES positive amount).
- `unallocated_amount`: Decimal (`Numeric(15, 2)` — derived: amount minus active allocations).
- `currency`: String (Default: "KES").
- `payment_date`: Date.
- `payment_method`: Enum (`mpesa`, `cheque`, `bank_transfer`, `ipf`, `cash`).
- `reference_number`: String | None (Transaction ID / cheque number).
- `payer_name`: String | None.
- `proof_document_id`: FK -> `Document.id` | None (Optional link to client payment slip).
- `status`: Enum (`active`, `reversed`).
- `reversal_of_id`: FK -> `PaymentRecord.id` | None.
- `reversal_reason`: Text | None.
- *Inherits:* `AuditMixin`.

### `PaymentAllocation` (Ledger Credit Link)
Applies a payment amount to a specific client invoice.
- `id`: UUID (Primary Key).
- `payment_record_id`: FK -> `PaymentRecord.id` (Indexed).
- `invoice_id`: FK -> `Invoice.id` (Indexed).
- `amount`: Decimal (`Numeric(15, 2)` — positive whole-KES).
- `status`: Enum (`active`, `reversed`).
- `reversal_of_id`: FK -> `PaymentAllocation.id` | None.
- `reversal_reason`: Text | None.
- `allocated_at`: DateTime(timezone=True).
- *Invariant:* Sum of active allocations on a `PaymentRecord` $\le$ `PaymentRecord.amount` (enforced under database lock).

---

## 6. Supporting Documents, Activity & Background Jobs

### `Document` (Polymorphic Evidentiary & Carrier Records)
Stores metadata and R2 storage references for all uploaded external files.
- `id`: UUID (Primary Key).
- `entity_type`: Enum (`Client`, `Policy`, `Renewal`, `Receipt`, `Claim`).
- `entity_id`: UUID (Indexed).
- `document_type`: Enum:
  - `insurer_receipt`: Carrier-issued receipt confirming insurer received funds. Business signal for **active cover** and **commission eligibility**.
  - `proof_of_payment`: Client-supplied evidence (M-Pesa message, bank slip, IPF form). Does not prove cleared funds or alter invoice balances.
  - `carrier_renewal_notice`: Official terms offered by carrier.
  - `kyc_document`: National ID, PIN certificate, CR12.
  - `valuation_report`: Approved motor/property valuation.
  - `other`: Supporting correspondence, inspection photos.
- `human_readable_label`: String.
- `storage_key`: String (R2 object key).
- `mime_type`: String.
- `file_size_bytes`: Integer.
- *Inherits:* `AuditMixin`.

### `Activity`
Preserves an append-only timeline of operational history without altering workflow statuses.
- `id`: UUID (Primary Key).
- `client_id`: FK -> `Client.id` (Indexed).
- `policy_id`: FK -> `Policy.id` | None (Indexed).
- `renewal_id`: FK -> `Renewal.id` | None (Indexed).
- `activity_type`: Enum (`note`, `phone_call`, `email`, `meeting`, `reminder`, `system`).
- `body`: Text.
- `created_by_id`: FK -> `User.id`.
- `created_at`: DateTime(timezone=True).

### `DocumentJob` (Asynchronous Document Pipeline)
Tracks asynchronous PDF generation requests.
- `id`: UUID (Primary Key, returned as `job_id`).
- `resource_type`: Enum (`risk_note`, `invitation`, `invoice`, `invoice_batch`, `statement`).
- `resource_id`: UUID | None.
- `status`: Enum (`pending`, `processing`, `succeeded`, `failed`).
- `idempotency_key`: String (Indexed, scoped to agent and operation).
- `snapshot_data`: JSON (Immutable generation-input snapshot frozen at request time).
- `attempt_count`: Integer (Default: 0).
- `error_code`: String | None.
- `error_message`: String | None.
- `created_at`: DateTime(timezone=True).
- `updated_at`: DateTime(timezone=True).

---

## 7. Financing, Commissions & Claims Models (§3.4, §3.5, §3.6)

### `IPFAgreement` (Premium Financing Facility)
Captures tripartite bank financing agreements executed to satisfy Section 156A:
- `id`: UUID (Primary Key).
- `client_id`: FK -> `Client.id` (Indexed).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `invoice_id`: FK -> `Invoice.id` (Indexed).
- `financier_name`: String (e.g. "NCBA Bank", "Stanbic Bank", "Equity Bank").
- `agreement_reference`: String (Indexed).
- `total_financed_amount`: Decimal (`Numeric(15, 2)`).
- `deposit_amount`: Decimal (`Numeric(15, 2)` — minimum 20% deposit).
- `number_of_installments`: Integer (typically 4–10 months).
- `monthly_installment`: Decimal (`Numeric(15, 2)`).
- `commitment_letter_document_id`: FK -> `Document.id` | None (Bank guarantee enabling cover inception).
- `status`: Enum (`pending_deposit`, `guaranteed`, `disbursed`, `cancelled`).
- *Inherits:* `AuditMixin`.

### `CommissionSchedule` (Underwriter Commission Rules)
Encodes statutory and contractually agreed agency commission rates:
- `id`: UUID (Primary Key).
- `insurer_id`: FK -> `Insurer.id` (Indexed).
- `product_line`: Enum (`motor_comprehensive`, `motor_third_party`, `domestic_package`, `medical`, `wiba`, `fire`, `burglary`, `all_risks`, `personal_accident`, `golfers`, `professional_indemnity`, `public_liability`).
- `commission_rate_percent`: Decimal (`Numeric(5, 4)` — compliant with Insurance Act caps).
- `withholding_tax_percent`: Decimal (`Numeric(5, 4)` — Default: 0.0500 / 5%).
- `effective_from`: Date.
- `is_active`: Boolean (Default: True).
- *Constraint:* `UNIQUE(insurer_id, product_line, effective_from)`.

### `Claim` (Claims Advocacy & Tracking)
Tracks policy claims to inform client advocacy and renewal negotiations:
- `id`: UUID (Primary Key).
- `policy_id`: FK -> `Policy.id` (Indexed).
- `client_id`: FK -> `Client.id` (Indexed).
- `vehicle_id`: FK -> `Vehicle.id` | None (Indexed).
- `claim_number`: String (Unique, Indexed — carrier claim number or internal ref).
- `incident_date`: Date.
- `intimated_date`: Date.
- `loss_type`: String (e.g. "own_damage", "third_party_property", "windscreen", "medical_inpatient").
- `loss_description`: Text.
- `estimated_reserve`: Decimal (`Numeric(15, 2)`).
- `settled_amount`: Decimal (`Numeric(15, 2)` | None).
- `status`: Enum (`intimated`, `documents_pending`, `adjuster_appointed`, `repairs_authorized`, `discharge_voucher`, `settled`, `declined`, `closed`).
- `assigned_adjuster`: String | None.
- *Inherits:* `AuditMixin`.
