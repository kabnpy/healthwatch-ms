it does not showcase the new improvement we've made1:21 PMReconsidered architectural design to elevate documentation standardsThe user is right. We discussed an important improvement where:

Policy should NOT duplicate data that's in RiskNote
RiskNote should be the single source of truth for coverage details and premiums
Policy should just be a container with computed properties that read from the latest RiskNote

This was the key insight we arrived at - that the intermediate step of updating Policy.risk_details is unnecessary when RiskNotes are transactional and show the most current data.
Let me revise the document to reflect this improved design as the recommended approach, making it clear this is the better pattern.Show moreDoneInsurance Brokerage Management System - Data Model Specification
Document Overview
Version: 2.0
Last Updated: February 2026
Purpose: Complete specification of data models and relationships for an insurance brokerage management system
Technology Stack: Python, FastAPI, SQLModel, PostgreSQL
⚠️ IMPORTANT DESIGN NOTE:
This document reflects the improved transactional pattern where RiskNotes are the single source of truth for policy state. Policy entities serve only as containers with computed properties that read from the latest RiskNote. This eliminates data duplication and synchronization issues.

1. Business Domain Context
1.1 What This System Does
This is a management system for an insurance brokerage agency (not an insurance company). The brokerage:

Acts as intermediary between clients and insurance companies
Issues Risk Notes (internal documents showing coverage and premium)
Manages policies issued by various insurers
Handles billing and payment collection
Tracks claims on behalf of clients
Earns commission on premiums

1.2 Key Business Concepts
Product: An insurance offering from a specific insurer (e.g., "Old Mutual Motor Comprehensive")
Policy: A container that identifies an insurance contract by the insurer's policy number (e.g., "010/070/1/012473/2025"). Does NOT store coverage details or premiums directly.
Risk Note: An internal transactional record that:

Shows what is covered at a specific point in time
Records the premium charged
Is created for every change (new, renewal, endorsement)
Acts as the SINGLE SOURCE OF TRUTH for policy state
Is NEVER given to clients (internal only)
Latest RiskNote = current policy state
Older RiskNotes = historical states

Invoice: A billing document sent to the client based on one or more Risk Notes
Receipt: A record of payment received from the client
Claim: A request for compensation under a policy

2. Core Architecture Pattern: Transactional RiskNotes
2.1 The Key Design Principle
SINGLE SOURCE OF TRUTH: RiskNotes contain ALL coverage data and premiums.
Policy (Container)
    ↓ has many
RiskNote (Transaction/Snapshot)
    ├─ RN #1: Aug 2024 - New Business → Value: 4.7M, Premium: 152K
    ├─ RN #2: Dec 2024 - Endorsement  → Value: 5.0M, Premium: +5K
    └─ RN #3: Aug 2025 - Renewal      → Value: 5.0M, Premium: 158K
         ↑
    LATEST = CURRENT STATE
Critical Rules:

Policy table does NOT store:

risk_details (coverage details)
current_premium
current_term_start/end


Policy table ONLY stores:

Identifiers (policy_number, client_id, product_id)
Status (Active/Lapsed/Cancelled)
Inception date
Computed properties that read from latest RiskNote


RiskNote table stores EVERYTHING:

Complete coverage details in policy_snapshot
Premium breakdown
Coverage period
Product configuration at that time


Current state = Latest RiskNote

Query: ORDER BY effective_date DESC LIMIT 1
No duplication, no sync issues


RiskNotes are IMMUTABLE:

Never UPDATE a RiskNote
Always CREATE new ones




3. Core Entity Models
3.1 User Management
User
Purpose: System users (staff members)
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifieremailString(255)Unique, Indexed, RequiredLogin emailhashed_passwordStringRequiredBcrypt hashed passwordfull_nameString(255)OptionalUser's full nameis_activeBooleanDefault: TrueAccount statusis_superuserBooleanDefault: FalseAdmin privilegesroleEnum(UserRole)RequiredUser role
Enums:
pythonUserRole:
  - ADMIN: Full system access
  - EDITOR: Can access everything else but user data;
  - VIEWER: Read-only access
Note: user roles might be unnecessary for a small team where any user can perform all actions.
Relationships:

One User → Many RiskNotes (created_by)
One User → Many Receipts (created_by)
One User → Many ClaimEvents (created_by)


3.2 Client Management
Client
Purpose: Individuals or companies buying insurance
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierclient_typeStringDefault: "Individual""Individual" or "Corporate"nameStringIndexed, RequiredFull name or company namekra_pinStringUnique, Indexed, RequiredKenya Revenue Authority PINemailStringOptionalEmail addressphoneStringRequiredPhone numberpostal_addressStringOptionalP.O. Box addresscontactsJSONRequired, Default: []Array of contact objects
JSON Structures:
contacts array contains:
json[
  {
    "name": "John Doe",
    "role": "CEO",
    "phone": "0722000000",
    "email": "john@company.com"
  }
]
Relationships:

One Client → Many Policies
One Client → Many Correspondences
One Client → Many Invoices
One Client → Many Receipts

Correspondence
Purpose: Track communications and documents related to a client
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierclient_idUUIDForeign Key → Client, RequiredRelated clientsubjectStringRequiredDocument subjectsummaryStringOptionalBrief description for searchfile_pathStringRequiredPath to stored documentdate_loggedDateTimeDefault: now()When logged
Relationships:

Many Correspondences → One Client


3.3 Insurance Catalog
Insurer
Purpose: Insurance companies that underwrite policies
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifiernameStringUnique, Indexed, RequiredInsurer nameemailStringOptionalContact emailphoneStringOptionalContact phone
Relationships:

One Insurer → Many Products

Product
Purpose: Specific insurance offerings from insurers - defines schema and pricing rules
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierinsurer_idUUIDForeign Key → Insurer, RequiredUnderwriting insurernameStringRequiredProduct nameclass_of_insuranceStringRequiredType of insuranceproduct_detailsJSONRequiredProduct configurationdefault_commission_rateDecimal(5,2)Default: 10.0Commission %
Class of Insurance Examples:

"Motor Private"
"Motor Commercial"
"Personal Accident"
"Domestic Package"
"Fire Industrial"

JSON Structures:
product_details structure:
json{
  "schema": {
    "registration": "text",
    "make": "text",
    "model": "text",
    "year": "number",
    "value": "number"
  },
  "pricing": {
    "base_rate": "0.0325",
    "min_premium": "15000"
  },
  "default_benefits": {
    "third_party_injury": "10000000",
    "third_party_property": "30000000",
    "windscreen": "100000"
  }
}
Methods (Business Logic):
pythondef validate_risk_details(self, risk_details: dict) -> dict:
    """
    Validate that risk_details conform to this product's schema.
    Returns validated/cleaned dict or raises ValidationError.
    """

def calculate_premium(self, risk_details: dict) -> Decimal:
    """
    Calculate premium based on product pricing rules and risk details.
    Returns net premium (before levies).
    """
Relationships:

Many Products → One Insurer
One Product → Many Policies


3.4 Policy Management (IMPROVED DESIGN)
Policy
Purpose: Container identifying the insurance contract - does NOT store coverage details
⚠️ CRITICAL DESIGN PRINCIPLE:
Policy is just a container. All coverage details, premiums, and terms live in RiskNotes. Current state is computed from the latest RiskNote.
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierpolicy_numberStringUnique, Indexed, RequiredInsurer's policy numberclient_idUUIDForeign Key → Client, Indexed, RequiredInsured partyproduct_idUUIDForeign Key → Product, Indexed, OptionalInsurance productstatusEnum(PolicyStatus)RequiredPolicy statusinception_dateDateRequiredWhen policy first startedcreated_atDateTimeDefault: now()Creation timestamp
Enums:
pythonPolicyStatus:
  - ACTIVE: Currently in force
  - LAPSED: Premium unpaid, coverage suspended
  - CANCELLED: Terminated before expiry
  - EXPIRED: Reached end date, not renewed
NO DATA DUPLICATION:

❌ Does NOT have risk_details
❌ Does NOT have current_premium
❌ Does NOT have current_term_start/end
❌ Does NOT have premium_breakdown

Computed Properties (read from latest RiskNote):
python@property
def current_risk_note(self) -> RiskNote | None:
    """Get the most recent risk note (current state)"""
    # SELECT * FROM risknote
    # WHERE policy_id = self.id
    # ORDER BY effective_date DESC
    # LIMIT 1
    return self.risk_notes[0] if self.risk_notes else None

@property
def current_risk_details(self) -> dict:
    """Get current coverage details from latest risk note"""
    rn = self.current_risk_note
    return rn.policy_snapshot.get("risk_details", {}) if rn else {}

@property
def current_premium(self) -> Decimal:
    """Get current total premium from latest risk note"""
    rn = self.current_risk_note
    return rn.total_premium if rn else Decimal("0")

@property
def current_term_start(self) -> date | None:
    """Get current coverage period start from latest risk note"""
    rn = self.current_risk_note
    return rn.coverage_start if rn else None

@property
def current_term_end(self) -> date | None:
    """Get current coverage period end from latest risk note"""
    rn = self.current_risk_note
    return rn.coverage_end if rn else None
Relationships:

Many Policies → One Client
Many Policies → One Product
One Policy → Many RiskNotes (ordered by effective_date DESC)
One Policy → Many Claims

Usage Example:
python# Get current state (reads from latest RiskNote)
policy = session.get(Policy, policy_id)
current_value = policy.current_risk_details["vehicle"]["value"]
current_premium = policy.current_premium

# No manual updates needed - just create new RiskNote!

RiskNote
Purpose: The SINGLE SOURCE OF TRUTH for policy state at any point in time
⚠️ CRITICAL: This is where ALL data lives
Key Characteristics:

Created for EVERY change to a policy (new, renewal, endorsement)
Immutable once issued (never UPDATE, always CREATE new)
Latest RiskNote = current policy state
Older RiskNotes = historical states
Contains complete snapshot of coverage, product, and premium
Internal document (never given to clients)
Linked to invoicing

Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierrisk_note_numberStringUnique, Indexed, RequiredInternal referencepolicy_idUUIDForeign Key → Policy, Indexed, RequiredRelated policytransaction_typeEnum(TransactionType)RequiredType of changestatusEnum(RiskNoteStatus)Default: "Draft"Risk note statusprevious_risk_note_idUUIDForeign Key → RiskNote, OptionalPrevious in chaineffective_dateDateIndexed, RequiredWhen this state became effectivecoverage_startDateRequiredCoverage period startcoverage_endDateRequiredCoverage period endpolicy_snapshotJSONRequiredCOMPLETE FROZEN STATEnet_premiumDecimal(15,2)RequiredPremium before leviesleviesJSONRequiredTax/levy breakdowncommission_amountDecimal(15,2)RequiredCommission earnedtotal_premiumDecimal(15,2)RequiredTotal chargedspecial_clausesJSONDefault: []Additional clausescreated_atDateTimeDefault: now(), IndexedCreation timestampcreated_by_idUUIDForeign Key → User, OptionalCreating userinvoice_numberStringOptionalRelated invoicepayment_statusEnum(PaymentStatus)Default: "Unpaid"Payment status
Enums:
pythonTransactionType:
  - NEW_BUSINESS: Initial policy creation
  - RENEWAL: New term for existing policy
  - ENDORSEMENT: Mid-term change
  - CANCELLATION: Policy terminated

RiskNoteStatus:
  - DRAFT: Being prepared
  - ISSUED: Finalized and in force
  - CANCELLED: Voided
  - REPLACED: Superseded by newer risk note

PaymentStatus:
  - UNPAID: No payment received
  - PARTIAL: Partially paid
  - PAID: Fully paid
JSON Structures:
policy_snapshot - THE COMPLETE STATE (this is the key improvement):
json{
  "policy_number": "010/070/1/012473/2025",
  "risk_details": {
    "vehicle": {
      "registration": "KCM 780L",
      "make": "Toyota",
      "model": "Prado",
      "year": 2016,
      "value": "4700000"
    }
  },
  "product": {
    "id": "uuid-here",
    "name": "Motor Private - Comprehensive",
    "class_of_insurance": "Motor Private",
    "commission_rate": 10.0,
    "product_details": {
      "pricing": {"base_rate": "0.0325"},
      "default_benefits": {...}
    }
  },
  "changes": {
    "description": "Increased vehicle value",
    "from": {"value": "4700000"},
    "to": {"value": "5000000"}
  }
}
levies structure:
json{
  "training_levy": "305.50",
  "phcf": "381.88",
  "stamp_duty": "40.00"
}
special_clauses example:
json[
  "Including Special Perils",
  "Riot, Strike and Civil Commotion included",
  "Territorial extension to East Africa"
]
Relationships:

Many RiskNotes → One Policy
Many RiskNotes → One User (created_by)
One RiskNote → One previous RiskNote (optional, for audit trail)
One RiskNote → Many subsequent RiskNotes
One RiskNote → Many InvoiceLineItems
One RiskNote → Many ReceiptAllocations

Business Rules:

Immutability: Once status != "Draft", NEVER update. Create new instead.
Ordering: Always query with ORDER BY effective_date DESC to get latest first.
Current State: Latest RiskNote (by effective_date) = current policy state.
Historical State: Query RiskNotes WHERE effective_date <= target_date.
Chaining: Set previous_risk_note_id to maintain audit trail.

Required Index:
sqlCREATE INDEX ix_risknote_policy_effective
  ON risknote(policy_id, effective_date DESC)
  WHERE status NOT IN ('CANCELLED', 'REPLACED');

3.5 Workflow Examples (IMPROVED PATTERN)
Creating New Policy
pythondef create_new_business(
    session: Session,
    policy_number: str,
    client_id: UUID,
    product_id: UUID,
    risk_details: dict,
    start_date: date,
    end_date: date,
    current_user: User,
) -> tuple[Policy, RiskNote]:

    # 1. Validate and price
    product = session.get(Product, product_id)
    validated_risk = product.validate_risk_details(risk_details)
    net_premium = product.calculate_premium(validated_risk)

    # 2. Create Policy (just container, NO coverage data)
    policy = Policy(
        policy_number=policy_number,
        client_id=client_id,
        product_id=product_id,
        inception_date=start_date,
        status=PolicyStatus.ACTIVE,
    )
    session.add(policy)
    session.flush()

    # 3. Create RiskNote (ALL the data goes here)
    risk_note = RiskNote(
        risk_note_number=generate_risk_note_number(),
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        effective_date=start_date,
        coverage_start=start_date,
        coverage_end=end_date,

        # Complete snapshot
        policy_snapshot={
            "policy_number": policy.policy_number,
            "risk_details": validated_risk,  # Coverage details
            "product": product.model_dump(mode="json"),
        },

        net_premium=net_premium,
        levies=calculate_levies(net_premium),
        commission_amount=calculate_commission(net_premium, product),
        total_premium=calculate_total(net_premium),
        status=RiskNoteStatus.DRAFT,
        created_by_id=current_user.id,
    )
    session.add(risk_note)
    session.commit()

    # Now policy.current_risk_details automatically returns validated_risk
    # via computed property reading from risk_note!

    return policy, risk_note
Creating Endorsement
pythondef create_endorsement(
    session: Session,
    policy_id: UUID,
    updated_risk_details: dict,
    change_description: str,
    current_user: User,
) -> RiskNote:

    policy = session.get(Policy, policy_id)
    product = policy.product

    # 1. Get CURRENT state from latest risk note
    current_rn = policy.current_risk_note
    old_risk_details = current_rn.policy_snapshot["risk_details"]

    # 2. Calculate premiums
    new_total_premium = product.calculate_premium(updated_risk_details)
    additional_premium = new_total_premium - current_rn.net_premium

    # 3. Create NEW risk note (NO policy update needed!)
    risk_note = RiskNote(
        risk_note_number=generate_risk_note_number(),
        policy_id=policy.id,
        transaction_type=TransactionType.ENDORSEMENT,
        previous_risk_note_id=current_rn.id,
        effective_date=date.today(),
        coverage_start=current_rn.coverage_start,
        coverage_end=current_rn.coverage_end,

        # NEW state snapshot
        policy_snapshot={
            "policy_number": policy.policy_number,
            "risk_details": updated_risk_details,  # NEW details
            "product": product.model_dump(mode="json"),
            "changes": {
                "description": change_description,
                "from": old_risk_details,
                "to": updated_risk_details,
            }
        },

        net_premium=additional_premium,
        levies=calculate_levies(additional_premium),
        commission_amount=calculate_commission(additional_premium, product),
        total_premium=calculate_total(additional_premium),
        special_clauses=[change_description],
        status=RiskNoteStatus.DRAFT,
        created_by_id=current_user.id,
    )
    session.add(risk_note)

    # Mark previous as replaced
    current_rn.status = RiskNoteStatus.REPLACED
    session.add(current_rn)

    session.commit()

    # Now policy.current_risk_details automatically returns updated_risk_details!
    # No manual policy update needed!

    return risk_note
Querying Current vs Historical State
python# Get current state (easy!)
policy = session.get(Policy, policy_id)
current_value = policy.current_risk_details["vehicle"]["value"]
current_premium = policy.current_premium

# Get historical state on specific date
risk_note_on_date = session.exec(
    select(RiskNote)
    .where(
        RiskNote.policy_id == policy_id,
        RiskNote.effective_date <= target_date,
        RiskNote.status.in_([RiskNoteStatus.ISSUED, RiskNoteStatus.REPLACED])
    )
    .order_by(RiskNote.effective_date.desc())
).first()

if risk_note_on_date:
    historical_value = risk_note_on_date.policy_snapshot["risk_details"]["vehicle"]["value"]
    historical_premium = risk_note_on_date.total_premium

3.6 Claims Management
Claim
Purpose: Record of loss/damage claim against a policy
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierclaim_numberStringUnique, RequiredClaim referencepolicy_idUUIDForeign Key → Policy, RequiredRelated policydate_of_lossDateRequiredWhen loss occurreddate_reportedDateDefault: today()When claim reporteddescriptionStringRequiredLoss descriptionstatusEnum(ClaimStatus)RequiredClaim statusreserve_amountDecimal(15,2)Default: 0Estimated claim amount
Enums:
pythonClaimStatus:
  - REPORTED: Initial claim report
  - UNDER_REVIEW: Being assessed
  - APPROVED: Accepted for payment
  - SETTLED: Paid out
  - REJECTED: Denied
  - WITHDRAWN: Client withdrew claim
Relationships:

Many Claims → One Policy
One Claim → Many ClaimEvents

ClaimEvent
Purpose: Track activities and updates on a claim
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierclaim_idUUIDForeign Key → Claim, RequiredRelated claimevent_typeEnum(ClaimEventType)RequiredType of eventdescriptionStringRequiredEvent detailscreated_by_idUUIDForeign Key → User, OptionalUser who logged eventcreated_atDateTimeDefault: now()Timestamp
Enums:
pythonClaimEventType:
  - NOTIFICATION: Initial report received
  - ASSESSMENT: Surveyor assessment
  - CORRESPONDENCE: Communication logged
  - PAYMENT: Settlement made
  - STATUS_CHANGE: Status updated
Relationships:

Many ClaimEvents → One Claim
Many ClaimEvents → One User (created_by)


3.7 Financial Management
Invoice
Purpose: Bill sent to client (can contain multiple risk notes)
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierinvoice_numberStringUnique, Indexed, RequiredInvoice referenceclient_idUUIDForeign Key → Client, RequiredBilled clientdate_issuedDateDefault: today()Issue datedue_dateDateOptionalPayment due datestatusEnum(InvoiceStatus)Default: "Unpaid"Invoice statustotal_amountDecimal(15,2)Default: 0Total billedbalance_dueDecimal(15,2)Default: 0Amount outstandingnotesStringOptionalAdditional notes
Enums:
pythonInvoiceStatus:
  - UNPAID: No payment received
  - PARTIAL: Partially paid
  - PAID: Fully paid
  - CANCELLED: Invoice cancelled
Relationships:

Many Invoices → One Client
One Invoice → Many InvoiceLineItems
One Invoice → Many ReceiptAllocations

InvoiceLineItem
Purpose: Link between invoice and risk notes (what's being billed)
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierinvoice_idUUIDForeign Key → Invoice, RequiredParent invoicerisk_note_idUUIDForeign Key → RiskNote, RequiredRisk note being billedamountDecimal(15,2)RequiredAmount for this linedescriptionStringOptionalLine description
Relationships:

Many InvoiceLineItems → One Invoice
Many InvoiceLineItems → One RiskNote

Receipt
Purpose: Record of payment received from client
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierreceipt_numberStringUnique, Indexed, RequiredReceipt referenceclient_idUUIDForeign Key → Client, RequiredPaying clientdate_receivedDateRequiredPayment dateamountDecimal(15,2)RequiredAmount receivedunallocated_amountDecimal(15,2)Default: amountAmount not yet allocatedmodeEnum(PaymentMode)RequiredPayment methodreferenceStringRequiredTransaction referencenotesStringOptionalAdditional notesstatusEnum(ReceiptStatus)Default: "Active"Receipt statuscreated_by_idUUIDForeign Key → User, OptionalUser who recorded
Enums:
pythonPaymentMode:
  - CASH: Cash payment
  - CHEQUE: Bank cheque
  - MPESA: Mobile money
  - BANK_TRANSFER: Direct bank transfer
  - EFT: Electronic funds transfer

ReceiptStatus:
  - ACTIVE: Valid receipt
  - VOIDED: Cancelled (refund/error)
Relationships:

Many Receipts → One Client
Many Receipts → One User (created_by)
One Receipt → Many ReceiptAllocations

ReceiptAllocation
Purpose: Allocate received payments to specific invoices/risk notes
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierreceipt_idUUIDForeign Key → Receipt, RequiredPayment sourceinvoice_idUUIDForeign Key → Invoice, RequiredInvoice being paidrisk_note_idUUIDForeign Key → RiskNote, OptionalSpecific risk noteamount_allocatedDecimal(15,2)RequiredAmount applied
Business Rules:

Total allocations for a receipt ≤ receipt.amount
Total allocations for an invoice ≤ invoice.total_amount
When allocation created:

receipt.unallocated_amount -= amount_allocated
invoice.balance_due -= amount_allocated
If invoice.balance_due = 0, set invoice.status = "Paid"
If 0 < invoice.balance_due < total_amount, set invoice.status = "Partial"



Relationships:

Many ReceiptAllocations → One Receipt
Many ReceiptAllocations → One Invoice
Many ReceiptAllocations → One RiskNote (optional)


3.8 Document Management
Document
Purpose: Store file attachments for any entity (polymorphic)
Fields:
FieldTypeConstraintsDescriptionidUUIDPrimary KeyUnique identifierentity_typeEnum(EntityType)RequiredType of parent entityentity_idUUIDRequiredParent entity IDdocument_typeStringRequiredDocument categoryfile_pathStringRequiredRelative storage pathmime_typeStringOptionalFile MIME typedoc_metadataJSONDefault: {}Additional metadatauploaded_atDateTimeDefault: now()Upload timestamp
Enums:
pythonEntityType:
  - CLIENT: Documents for a client
  - POLICY: Documents for a policy
  - CLAIM: Documents for a claim
  - RISK_NOTE: Documents for a risk note
  - USER: Documents for a user
Document Types (examples):

"Logbook": Vehicle registration
"ID": Identification document
"Valuation": Valuation report
"PoliceAbstract": Police abstract
"Receipt": Payment receipt
"PolicyDocument": Official policy document from insurer

Note: This is a polymorphic relationship - entity_id is NOT a foreign key in the database, it's just a UUID that references different tables based on entity_type.
No direct relationships (polymorphic pattern)

4. Key Design Improvements Summary
4.1 Before (Data Duplication Problem)
python# Old pattern - data in TWO places
class Policy(SQLModel, table=True):
    risk_details: dict  # ← Coverage details HERE
    current_premium: Decimal  # ← Premium HERE
    current_term_start: date  # ← Term HERE

class RiskNote(SQLModel, table=True):
    policy_snapshot: dict  # ← ALSO HERE (duplication!)
    total_premium: Decimal  # ← ALSO HERE (duplication!)

# Problem: On endorsement, must update BOTH
policy.risk_details = new_details  # Update 1
policy.current_premium = new_premium  # Update 2
risk_note.policy_snapshot = {...}  # Update 3

# What if they get out of sync?
4.2 After (Single Source of Truth)
python# New pattern - data in ONE place
class Policy(SQLModel, table=True):
    # Just metadata
    policy_number: str
    client_id: UUID
    status: PolicyStatus
    inception_date: date

    # Computed properties (read from latest RiskNote)
    @property
    def current_risk_details(self) -> dict:
        return self.current_risk_note.policy_snapshot["risk_details"]

    @property
    def current_premium(self) -> Decimal:
        return self.current_risk_note.total_premium

class RiskNote(SQLModel, table=True):
    # ALL DATA HERE (single source of truth)
    policy_snapshot: dict  # Contains risk_details
    total_premium: Decimal
    coverage_start: date
    coverage_end: date
    effective_date: date  # For ordering

# On endorsement, just CREATE new RiskNote
new_risk_note = RiskNote(
    policy_id=policy.id,
    policy_snapshot={"risk_details": new_details},
    total_premium=new_premium,
    # ...
)
# That's it! No policy updates needed
# policy.current_risk_details automatically returns new_details
```

### 4.3 Benefits

1. **No Duplication**: Data exists in exactly one place
2. **No Sync Issues**: Can't get out of sync
3. **Automatic History**: All RiskNotes form complete audit trail
4. **Simpler Mutations**: Just create new RiskNote, don't update Policy
5. **Matches Business Model**: RiskNotes ARE the business documents
6. **Event Sourcing Pattern**: Each RiskNote is an event, latest = current state

---

## 5. Relationship Summary

### 5.1 Entity Relationship Diagram (Text Format)
```
User
├─→ RiskNote (created_by)
├─→ Receipt (created_by)
└─→ ClaimEvent (created_by)

Client
├─→ Policy (many)
├─→ Correspondence (many)
├─→ Invoice (many)
└─→ Receipt (many)

Insurer
└─→ Product (many)

Product
└─→ Policy (many)

Policy (Container - no data duplication)
├─→ RiskNote (many, ordered by effective_date DESC)
│   └─ Latest RiskNote = Current State
└─→ Claim (many)

RiskNote (Single Source of Truth)
├─→ RiskNote (previous, self-referencing chain)
├─→ InvoiceLineItem (many)
└─→ ReceiptAllocation (many)

Invoice
├─→ InvoiceLineItem (many)
└─→ ReceiptAllocation (many)

Receipt
└─→ ReceiptAllocation (many)

Claim
└─→ ClaimEvent (many)

6. Database Indexes
Required Indexes for Performance:
sql-- Unique constraints
CREATE UNIQUE INDEX ix_user_email ON user(email);
CREATE UNIQUE INDEX ix_client_kra_pin ON client(kra_pin);
CREATE UNIQUE INDEX ix_insurer_name ON insurer(name);
CREATE UNIQUE INDEX ix_policy_policy_number ON policy(policy_number);
CREATE UNIQUE INDEX ix_risknote_risk_note_number ON risknote(risk_note_number);
CREATE UNIQUE INDEX ix_invoice_invoice_number ON invoice(invoice_number);
CREATE UNIQUE INDEX ix_receipt_receipt_number ON receipt(receipt_number);

-- Foreign key indexes
CREATE INDEX ix_policy_client_id ON policy(client_id);
CREATE INDEX ix_policy_product_id ON policy(product_id);
CREATE INDEX ix_risknote_policy_id ON risknote(policy_id);
CREATE INDEX ix_claim_policy_id ON claim(policy_id);
CREATE INDEX ix_invoice_client_id ON invoice(client_id);
CREATE INDEX ix_receipt_client_id ON receipt(client_id);

-- Search/filter indexes
CREATE INDEX ix_client_name ON client(name);
CREATE INDEX ix_risknote_effective_date ON risknote(effective_date);
CREATE INDEX ix_risknote_created_at ON risknote(created_at);

-- CRITICAL: Composite index for "get latest risk note" query
CREATE INDEX ix_risknote_policy_effective
  ON risknote(policy_id, effective_date DESC)
  WHERE status IN ('ISSUED', 'REPLACED');

-- This makes policy.current_risk_note very fast

7. Sample Data Examples
7.1 Motor Policy Complete Example (NEW PATTERN)
Product:
json{
  "id": "uuid-motor-product",
  "insurer_id": "uuid-old-mutual",
  "name": "Motor Private - Comprehensive",
  "class_of_insurance": "Motor Private",
  "product_details": {
    "schema": {
      "registration": "text",
      "make": "text",
      "model": "text",
      "year": "number",
      "value": "number"
    },
    "pricing": {
      "base_rate": "0.0325",
      "min_premium": "15000"
    }
  },
  "default_commission_rate": 10.0
}
Policy (just container - no coverage data):
json{
  "id": "uuid-policy-1",
  "policy_number": "010/070/1/012473/2025",
  "client_id": "uuid-client-agnes",
  "product_id": "uuid-motor-product",
  "status": "ACTIVE",
  "inception_date": "2025-08-02",
  "created_at": "2025-08-02T10:00:00Z"
}
RiskNote #1 (New Business - ALL data here):
json{
  "id": "uuid-risknote-1",
  "risk_note_number": "RN-2025-0001",
  "policy_id": "uuid-policy-1",
  "transaction_type": "NEW_BUSINESS",
  "status": "ISSUED",
  "previous_risk_note_id": null,
  "effective_date": "2025-08-02",
  "coverage_start": "2025-08-02",
  "coverage_end": "2026-08-01",

  "policy_snapshot": {
    "policy_number": "010/070/1/012473/2025",
    "risk_details": {
      "vehicle": {
        "registration": "KCM 780L",
        "make": "Toyota",
        "model": "Prado",
        "year": 2016,
        "value": "4700000"
      }
    },
    "product": {
      "name": "Motor Private - Comprehensive",
      "commission_rate": 10.0
    }
  },

  "net_premium": "152750.00",
  "levies": {
    "training_levy": "305.50",
    "phcf": "381.88",
    "stamp_duty": "40.00"
  },
  "commission_amount": "15275.00",
  "total_premium": "153437.38",
  "special_clauses": ["Including Special Perils"],
  "payment_status": "UNPAID",
  "created_at": "2025-08-02T10:05:00Z"
}
RiskNote #2 (Endorsement - value increased):
json{
  "id": "uuid-risknote-2",
  "risk_note_number": "RN-2025-0432",
  "policy_id": "uuid-policy-1",
  "transaction_type": "ENDORSEMENT",
  "status": "ISSUED",
  "previous_risk_note_id": "uuid-risknote-1",
  "effective_date": "2025-12-15",
  "coverage_start": "2025-08-02",
  "coverage_end": "2026-08-01",

  "policy_snapshot": {
    "policy_number": "010/070/1/012473/2025",
    "risk_details": {
      "vehicle": {
        "registration": "KCM 780L",
        "make": "Toyota",
        "model": "Prado",
        "year": 2016,
        "value": "5000000"
      }
    },
    "product": {
      "name": "Motor Private - Comprehensive",
      "commission_rate": 10.0
    },
    "changes": {
      "description": "Increased vehicle value",
      "from": {"value": "4700000"},
      "to": {"value": "5000000"}
    }
  },

  "net_premium": "5250.00",
  "levies": {
    "training_levy": "10.50",
    "phcf": "13.13"
  },
  "commission_amount": "525.00",
  "total_premium": "5798.63",
  "special_clauses": ["Vehicle revalued to KES 5,000,000"],
  "payment_status": "UNPAID",
  "created_at": "2025-12-15T14:30:00Z"
}
Querying Current State:
python# Get policy
policy = session.get(Policy, "uuid-policy-1")

# Current state comes from latest RiskNote automatically
current_value = policy.current_risk_details["vehicle"]["value"]
# Returns: "5000000" (from RiskNote #2)

current_premium = policy.current_premium
# Returns: Decimal("5798.63") (from RiskNote #2)

# Historical state
risk_note_1 = session.get(RiskNote, "uuid-risknote-1")
original_value = risk_note_1.policy_snapshot["risk_details"]["vehicle"]["value"]
# Returns: "4700000"

8. Critical Business Rules
8.1 RiskNote Rules (IMPROVED)

Single Source of Truth: ALL coverage data and premiums ONLY in RiskNote.policy_snapshot
Immutability: Once status = "ISSUED", NEVER update. Create new RiskNote instead.
Ordering: Latest RiskNote (by effective_date DESC) = current policy state
Chaining: Set previous_risk_note_id to maintain audit trail
Financial Accuracy:

total_premium = net_premium + sum(all values in levies)
commission_amount = net_premium × (commission_rate / 100)


Transaction Types:

NEW_BUSINESS: First risk note, previous_risk_note_id = NULL
RENEWAL: New coverage period, new effective_date
ENDORSEMENT: Same coverage period, updated risk_details
CANCELLATION: May have negative premium (refund)



8.2 No Policy Updates on Transactions
Critical Rule: When creating RiskNotes (endorsements, renewals), do NOT update Policy fields. Just create the new RiskNote. The Policy.current_* properties will automatically reflect the new state.
python# ❌ OLD WAY (don't do this)
policy.risk_details = new_details
policy.current_premium = new_premium
risk_note = RiskNote(policy_snapshot=new_details, ...)

# ✅ NEW WAY (correct)
risk_note = RiskNote(
    policy_id=policy.id,
    policy_snapshot={"risk_details": new_details},
    total_premium=new_premium,
    # ...
)
# Done! policy.current_risk_details now returns new_details automatically
```

### 8.3 Invoice & Payment Rules

(Same as before - no changes needed for financials)

### 8.4 Commission Calculation

Kenya insurance levies (as of 2025):
- Training Levy: 0.2% of net premium
- PHCF (Policyholders Compensation Fund): 0.25% of net premium
- Stamp Duty: KES 40 (fixed)

Example calculation:
```
Net Premium: 152,750.00
Training Levy (0.2%): 305.50
PHCF (0.25%): 381.88
Stamp Duty: 40.00
─────────────────────────
Total Premium: 153,477.38

Commission (10%): 15,275.00 (on net premium only)
8.5 Data Type Requirements
CRITICAL: All monetary values MUST use Decimal(15,2), NOT float
Example:
pythonnet_premium: Decimal = Field(sa_type=Numeric(15, 2))
Reason: Float arithmetic causes rounding errors in financial calculations.

9. SQLModel Code Reference (IMPROVED)
9.1 Policy Model (Container Only)
pythonfrom datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from enum import Enum

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .client import Client
    from .product import Product
    from .risk_note import RiskNote
    from .claim import Claim


class PolicyStatus(str, Enum):
    ACTIVE = "Active"
    LAPSED = "Lapsed"
    CANCELLED = "Cancelled"
    EXPIRED = "Expired"


class PolicyBase(SQLModel):
    """Shared properties - just container metadata"""
    policy_number: str = Field(unique=True, index=True)
    client_id: UUID = Field(foreign_key="client.id", index=True)
    product_id: UUID = Field(foreign_key="product.id", index=True)
    status: PolicyStatus
    inception_date: date


class PolicyCreate(PolicyBase):
    """Properties to receive on creation"""
    pass


class PolicyUpdate(SQLModel):
    """Properties to receive on update"""
    status: PolicyStatus | None = None


class PolicyPublic(PolicyBase):
    """Properties to return via API"""
    id: UUID
    created_at: datetime


class Policy(PolicyBase, table=True):
    """
    Database model - just a container.
    NO coverage data stored here.
    """
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)

    # Relationships (eager load risk_notes for computed properties)
    client: "Client" = Relationship(back_populates="policies")
    product: "Product" = Relationship(back_populates="policies")
    risk_notes: list["RiskNote"] = Relationship(
        back_populates="policy",
        sa_relationship_kwargs={
            "order_by": "RiskNote.effective_date.desc()",
            "lazy": "selectin"
        }
    )
    claims: list["Claim"] = Relationship(back_populates="policy")

    # Computed properties (read from latest RiskNote)
    @property
    def current_risk_note(self) -> "RiskNote | None":
        """Get most recent risk note (current state)"""
        active_notes = [
            rn for rn in self.risk_notes
            if rn.status in [RiskNoteStatus.ISSUED, RiskNoteStatus.REPLACED]
        ]
        return active_notes[0] if active_notes else None

    @property
    def current_risk_details(self) -> dict:
        """Get current coverage details from latest risk note"""
        rn = self.current_risk_note
        return rn.policy_snapshot.get("risk_details", {}) if rn else {}

    @property
    def current_premium(self) -> Decimal:
        """Get current total premium from latest risk note"""
        rn = self.current_risk_note
        return rn.total_premium if rn else Decimal("0")

    @property
    def current_term_start(self) -> date | None:
        """Get current coverage period start"""
        rn = self.current_risk_note
        return rn.coverage_start if rn else None

    @property
    def current_term_end(self) -> date | None:
        """Get current coverage period end"""
        rn = self.current_risk_note
        return rn.coverage_end if rn else None
9.2 RiskNote Model (Single Source of Truth)
pythonfrom sqlalchemy import JSON, Numeric


class TransactionType(str, Enum):
    NEW_BUSINESS = "New Business"
    RENEWAL = "Renewal"
    ENDORSEMENT = "Endorsement"
    CANCELLATION = "Cancellation"


class RiskNoteStatus(str, Enum):
    DRAFT = "Draft"
    ISSUED = "Issued"
    CANCELLED = "Cancelled"
    REPLACED = "Replaced"


class PaymentStatus(str, Enum):
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"


class RiskNoteBase(SQLModel):
    """Base properties"""
    policy_id: UUID = Field(foreign_key="policy.id", index=True)
    transaction_type: TransactionType
    effective_date: date = Field(index=True)
    coverage_start: date
    coverage_end: date

    # THE DATA (all in policy_snapshot)
    policy_snapshot: dict = Field(sa_type=JSON)

    # Financial
    net_premium: Decimal = Field(sa_type=Numeric(15, 2))
    levies: dict = Field(sa_type=JSON)
    commission_amount: Decimal = Field(sa_type=Numeric(15, 2))
    total_premium: Decimal = Field(sa_type=Numeric(15, 2))

    special_clauses: list[str] = Field(default_factory=list, sa_type=JSON)


class RiskNoteCreate(RiskNoteBase):
    """Properties to receive on creation"""
    previous_risk_note_id: UUID | None = None


class RiskNote(RiskNoteBase, table=True):
    """
    Database model - SINGLE SOURCE OF TRUTH.
    All coverage data and premiums live here.
    """
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    risk_note_number: str = Field(unique=True, index=True)

    status: RiskNoteStatus = Field(default=RiskNoteStatus.DRAFT)
    payment_status: PaymentStatus = Field(default=PaymentStatus.UNPAID)

    previous_risk_note_id: UUID | None = Field(
        default=None,
        foreign_key="risknote.id"
    )

    invoice_number: str | None = None
    created_at: datetime = Field(default_factory=datetime.now, index=True)
    created_by_id: UUID | None = Field(default=None, foreign_key="user.id")

    # Relationships
    policy: "Policy" = Relationship(back_populates="risk_notes")
    previous_risk_note: "RiskNote | None" = Relationship(
        back_populates="subsequent_risk_notes",
        sa_relationship_kwargs={"remote_side": "RiskNote.id"}
    )
    subsequent_risk_notes: list["RiskNote"] = Relationship(
        back_populates="previous_risk_note"
    )

10. API Structure Reference
(Same as before - no changes to API endpoints)

11. Environment Configuration
(Same as before - no changes to environment variables)

12. Known Design Decisions
12.1 Why This Pattern is Better
Problem Solved: Data duplication between Policy and RiskNote
Solution: RiskNote is single source of truth, Policy has computed properties
Benefits:

No sync issues (can't get out of sync)
Simpler code (just create RiskNote, don't update Policy)
Automatic history (all RiskNotes form audit trail)
Matches business model (RiskNotes are the real documents)
Event sourcing pattern (each RiskNote = event)

Tradeoff: Slightly more complex queries (need to join/eager load risk_notes)
Mitigation: Proper indexing makes queries fast
12.2 When to Use This Pattern
✅ Use when:

Data changes over time and history matters
Need complete audit trail
Want to avoid sync issues
Transactions are the business documents

❌ Don't use when:

Current state rarely changes
History not important
Need maximum query performance on current state

For this insurance brokerage system: ✅ Perfect fit

Document Version History
VersionDateChanges1.02026-02-13Initial comprehensive documentation2.02026-02-13IMPROVED: Added transactional RiskNote pattern, Policy as container with computed properties

End of Document
