Principal Engineer Code Review: Insurance Agency Management System
I'll structure this review by impact level, focusing on architectural concerns, logic flaws, and future-proofing.
🚨 P0: Critical Issues (Fix Immediately)
1. Financial Precision Bug: Money Stored as Float
Location: Throughout models (Policy, Invoice, Receipt, RiskNote)
pythontotal_amount: float = 0.0
balance_due: float = 0.0
net_premium: float
Problem: Floating-point arithmetic is fundamentally incompatible with financial calculations. You'll get rounding errors like 0.1 + 0.2 = 0.30000000000000004.
Real-world impact:
python# This comparison in void_receipt is dangerous:
if invoice.balance_due >= invoice.total_amount:
    invoice.status = "Unpaid"
Fix:
pythonfrom decimal import Decimal
from sqlalchemy import Numeric

class InvoiceBase(SQLModel):
    total_amount: Decimal = Field(default=Decimal("0"), sa_type=Numeric(15, 2))
    balance_due: Decimal = Field(default=Decimal("0"), sa_type=Numeric(15, 2))
2. Broken Transactional Integrity in Risk Note Creation
Location: backend/app/crud/insurance/policy.py:create_risk_note()
pythondef create_risk_note(*, session: Session, risk_note_in: RiskNoteCreate) -> RiskNote:
    db_obj = RiskNote.model_validate(risk_note_in)
    session.add(db_obj)
    session.commit()  # ⚠️ COMMITTED
    session.refresh(db_obj)

    # 2. Handle Invoicing Logic
    policy = session.get(Policy, db_obj.policy_id)
    # ... creates invoice ...
    session.commit()  # ⚠️ SECOND COMMIT
Problem: If invoice creation fails, you have an orphaned RiskNote with no invoice. This violates atomicity.
Fix using nested transactions:
pythonfrom sqlalchemy.exc import SQLAlchemyError

def create_risk_note(*, session: Session, risk_note_in: RiskNoteCreate) -> RiskNote:
    try:
        # Everything in one transaction
        db_obj = RiskNote.model_validate(risk_note_in)

        if not db_obj.policy_snapshot:
            policy = session.get(Policy, db_obj.policy_id)
            if policy:
                db_obj.policy_snapshot = jsonable_encoder(policy)

        session.add(db_obj)
        session.flush()  # Get ID without committing

        # Handle invoicing
        policy = session.get(Policy, db_obj.policy_id)
        if policy:
            invoice = _get_or_create_invoice(session, policy.client_id)
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                risk_note_id=db_obj.id,
                amount=db_obj.total_amount,
            )
            session.add(line_item)

            invoice.total_amount += db_obj.total_amount
            invoice.balance_due += db_obj.total_amount
            db_obj.invoice_number = invoice.invoice_number

        session.commit()  # ONE commit for all changes
        session.refresh(db_obj)
        return db_obj

    except SQLAlchemyError:
        session.rollback()
        raise
3. Missing Financial Validation in Allocation
Location: backend/app/crud/insurance/financial.py:create_receipt_allocation()
pythondef create_receipt_allocation(...) -> ReceiptAllocation:
    db_obj = ReceiptAllocation.model_validate(allocation_in)
    session.add(db_obj)

    invoice = session.get(Invoice, db_obj.invoice_id)
    if invoice:
        invoice.balance_due -= db_obj.amount_allocated  # ⚠️ No validation!
Problem: You can allocate:

Negative amounts
More than the invoice balance
More than the receipt has available
To voided receipts or cancelled invoices

Fix:
pythondef create_receipt_allocation(
    *, session: Session, allocation_in: ReceiptAllocationCreate
) -> ReceiptAllocation:
    # Validate receipt
    receipt = session.get(Receipt, allocation_in.receipt_id)
    if not receipt:
        raise ValueError("Receipt not found")
    if receipt.status == "Voided":
        raise ValueError("Cannot allocate from a voided receipt")
    if receipt.unallocated_amount < allocation_in.amount_allocated:
        raise ValueError(
            f"Insufficient unallocated amount. Available: {receipt.unallocated_amount}, "
            f"Requested: {allocation_in.amount_allocated}"
        )

    # Validate invoice
    invoice = session.get(Invoice, allocation_in.invoice_id)
    if not invoice:
        raise ValueError("Invoice not found")
    if invoice.status == "Cancelled":
        raise ValueError("Cannot allocate to a cancelled invoice")
    if invoice.balance_due < allocation_in.amount_allocated:
        raise ValueError(
            f"Allocation exceeds invoice balance. Balance: {invoice.balance_due}, "
            f"Requested: {allocation_in.amount_allocated}"
        )

    # Validate amount
    if allocation_in.amount_allocated <= 0:
        raise ValueError("Allocation amount must be positive")

    # All validations passed - proceed with allocation
    # ... rest of implementation
4. Runtime Error in Seed Data
Location: backend/app/seed_mock_data.py:81
pythonclient = Client(
    name="Agnes Njoki Mwangi",
    city="Nairobi",  # ⚠️ Field doesn't exist in ClientBase
    # ...
)
Problem: ClientBase has no city field. This will crash on startup in local environment.

🔴 P1: High Priority Issues
5. Type-Unsafe Status Strings
Location: Throughout models
pythonstatus: str = "Active"  # Manual comments listing valid values
payment_status: str = Field(default="Unpaid")
Problem: You already use enums for UserRole and PricingStrategy, but not for statuses. Inconsistent and error-prone.
Fix:
pythonclass PolicyStatus(str, Enum):
    ACTIVE = "Active"
    EXPIRED = "Expired"
    CANCELLED = "Cancelled"

class InvoiceStatus(str, Enum):
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"
    CANCELLED = "Cancelled"

class PolicyBase(SQLModel):
    status: PolicyStatus = Field(default=PolicyStatus.ACTIVE)
6. Authorization Gap: Roles Not Enforced
Location: All API routes
python@router.post("/", response_model=ClaimPublic)
def create_claim(
    *, session: SessionDep, _current_user: CurrentUser, claim_in: ClaimCreate
) -> Any:
Problem: A user with role=UserRole.VIEWER can create/update/delete everything. The role field exists but isn't checked.
Fix:
pythonfrom functools import wraps
from typing import Callable

def require_role(*allowed_roles: UserRole):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, current_user: CurrentUser, **kwargs):
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=403,
                    detail=f"Requires one of: {[r.value for r in allowed_roles]}"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

@router.post("/", response_model=ClaimPublic)
@require_role(UserRole.ADMIN, UserRole.UNDERWRITER)
def create_claim(
    *, session: SessionDep, current_user: CurrentUser, claim_in: ClaimCreate
) -> Any:
7. Missing Database Indexes
Location: Models lacking indexes on foreign keys
Problem: These queries will do full table scans:
sqlSELECT * FROM policy WHERE client_id = ?
SELECT * FROM risknote WHERE policy_id = ?
SELECT * FROM claim WHERE policy_id = ?
Fix:
pythonclass Policy(PolicyBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)  # Add index
    product_id: uuid.UUID | None = Field(default=None, foreign_key="product.id", index=True)
Create migration:
pythondef upgrade():
    op.create_index('ix_policy_client_id', 'policy', ['client_id'])
    op.create_index('ix_risknote_policy_id', 'risknote', ['policy_id'])
    op.create_index('ix_claim_policy_id', 'claim', ['policy_id'])
8. No Audit Trail (Hard Deletes)
Problem: In financial/insurance systems, you need to know who deleted what and when. Hard deletes lose this history.
Fix - Add soft delete pattern:
pythonclass AuditMixin(SQLModel):
    deleted_at: datetime | None = Field(default=None, index=True)
    deleted_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")

class Client(ClientBase, AuditMixin, table=True):
    # ...

def get_clients(session: Session, *, skip: int = 0, limit: int = 100, include_deleted: bool = False):
    statement = select(Client)
    if not include_deleted:
        statement = statement.where(Client.deleted_at.is_(None))
    return session.exec(statement.offset(skip).limit(limit)).all()

def delete_client(session: Session, *, db_client: Client, current_user: User):
    db_client.deleted_at = datetime.now(timezone.utc)
    db_client.deleted_by_id = current_user.id
    session.add(db_client)
    session.commit()

🟡 P2: Medium Priority (Architectural Concerns)
9. Polymorphic Document Model Without Referential Integrity
Location: backend/app/models/insurance/policy.py:Document
pythonclass DocumentBase(SQLModel):
    entity_type: str  # "Client", "Policy", "Claim"
    entity_id: uuid.UUID  # ⚠️ Not a real foreign key
Problem:

Can't enforce referential integrity
Can point to deleted entities
Can't cascade deletes
Complex joins

Better approach:
python# Separate tables for each entity type
class PolicyDocument(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy_id: uuid.UUID = Field(foreign_key="policy.id", ondelete="CASCADE")
    document_type: str
    file_path: str
    # ...

class ClaimDocument(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    claim_id: uuid.UUID = Field(foreign_key="claim.id", ondelete="CASCADE")
    document_type: str
    file_path: str
    # ...
Or use PostgreSQL inheritance if you must have polymorphism:
python# Requires postgresql
from sqlalchemy import Column, Integer
from sqlalchemy.ext.declarative import declared_attr

class Document(SQLModel):
    __tablename__ = "document"
    __mapper_args__ = {"polymorphic_on": "entity_type"}

    entity_type: str = Field(sa_column=Column(String))

class PolicyDocument(Document, table=True):
    __mapper_args__ = {"polymorphic_identity": "policy"}
    policy_id: uuid.UUID = Field(foreign_key="policy.id")
10. Hidden Side Effect: Policy Creates Draft RiskNote
Location: backend/app/crud/insurance/policy.py:create_policy()
pythondef create_policy(...) -> Policy:
    db_obj = Policy.model_validate(policy_in)
    session.add(db_obj)
    session.commit()

    # ⚠️ Hidden side effect
    create_risk_note(session=session, risk_note_in=first_risk_note_in)
    return db_obj
Problem: Violates principle of least surprise. Creating a policy shouldn't automatically create a risk note.
Fix - Make it explicit:
python# Service layer
class PolicyService:
    @staticmethod
    def create_policy_with_draft_note(
        session: Session,
        policy_in: PolicyCreate,
        current_user: User
    ) -> tuple[Policy, RiskNote]:
        """Creates a policy and its initial draft risk note atomically."""
        try:
            policy = crud.create_policy(session=session, policy_in=policy_in)

            risk_note_in = RiskNoteCreate(
                policy_id=policy.id,
                transaction_type="New Business",
                status="Draft",
                # ...
            )
            risk_note = crud.create_risk_note(session=session, risk_note_in=risk_note_in)

            session.commit()
            return policy, risk_note
        except SQLAlchemyError:
            session.rollback()
            raise

# Route uses service
@router.post("/", response_model=PolicyPublic)
def create_policy(
    *, session: SessionDep, current_user: CurrentUser, policy_in: PolicyCreate
) -> Any:
    policy, _risk_note = PolicyService.create_policy_with_draft_note(
        session, policy_in, current_user
    )
    return policy
11. Unstructured JSON Fields
pythonproduct_details: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
risk_details: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
Problem:

No schema validation
Can't query efficiently
Type safety lost
Migration nightmare

Better approach:
pythonfrom pydantic import BaseModel

class VehicleDetails(BaseModel):
    """Strongly typed vehicle details"""
    registration: str
    make: str
    model: str
    year: int
    value: Decimal

    class Config:
        frozen = True  # Immutable

class MotorRiskDetails(BaseModel):
    vehicle: VehicleDetails
    usage: Literal["Private", "Commercial"]
    overnight_location: str

# In Policy model
from sqlalchemy.dialects.postgresql import JSONB

class Policy(PolicyBase, table=True):
    # Store as JSONB with schema validation
    risk_details: MotorRiskDetails | None = Field(
        default=None,
        sa_type=JSONB  # Queryable in PostgreSQL
    )

    @validator('risk_details', pre=True)
    def validate_risk_details(cls, v):
        if isinstance(v, dict):
            return MotorRiskDetails(**v)
        return v
12. Global Storage Singleton Prevents Testing
Location: backend/app/core/storage.py
pythonstorage = LocalFileSystemProvider(...)  # Module-level singleton
Problem:

Hard to test
Can't swap implementations
Environment variable read at import time

Fix - Dependency injection:
python# In deps.py
from typing import Annotated

def get_storage() -> StorageProvider:
    base_dir = os.getenv("STORAGE_BASE_DIR", "storage")
    return LocalFileSystemProvider(base_dir=base_dir)

StorageDep = Annotated[StorageProvider, Depends(get_storage)]

# In routes
@router.post("/upload")
async def upload_document(
    storage: StorageDep,  # Injected
    file: UploadFile = File(...),
):
    path = storage.save_file(file.file, file.filename)

🟢 P3: Future-Proofing Suggestions
13. Add Optimistic Locking for Concurrent Updates
For financial records that might be edited concurrently:
pythonclass Invoice(InvoiceBase, table=True):
    version: int = Field(default=1)  # Version counter

def update_invoice(..., invoice_in: InvoiceUpdate) -> Invoice:
    # Check version matches
    if invoice_in.version != db_invoice.version:
        raise HTTPException(
            status_code=409,
            detail="Invoice was modified by another user. Please refresh."
        )

    update_dict = invoice_in.model_dump(exclude_unset=True)
    db_invoice.sqlmodel_update(update_dict)
    db_invoice.version += 1  # Increment version
    session.commit()
14. Add Request Correlation IDs
For distributed tracing:
pythonfrom contextvars import ContextVar
import uuid

request_id_ctx: ContextVar[str] = ContextVar('request_id', default=None)

@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    request_id_ctx.set(request_id)

    response = await call_next(request)
    response.headers['X-Request-ID'] = request_id
    return response

# In logging
logger.info(f"[{request_id_ctx.get()}] Creating policy...")
15. Schema Stability Concerns
Your migrations show significant churn:

067034ce2c0b - Restores product_details after splitting it
300464e5e502 - Drops RiskItem table completely
ae3b5ec0bde2 - "Final refined architecture overhaul v2"

Question from first principles: Why the instability?
This suggests unclear domain modeling. Consider:

Event Storming Workshop: Gather domain experts and map the actual insurance business processes
Bounded Contexts: Are you trying to model too much in one schema? Consider separating:

Underwriting (Policies, Products)
Claims
Financials (Invoicing, Receipts)


Read Models: For complex queries, consider CQRS with separate read models

16. Consider Event Sourcing for Financial State
For financial transactions, event sourcing provides:

Complete audit trail
Ability to reconstruct state at any point
No "update" operations, only appends

pythonclass FinancialEvent(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    aggregate_id: uuid.UUID  # Invoice ID
    event_type: str  # "InvoiceCreated", "PaymentReceived", "InvoiceVoided"
    event_data: dict = Field(sa_type=JSON)
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: uuid.UUID

# Reconstruct current state
def get_invoice_state(invoice_id: uuid.UUID) -> InvoiceState:
    events = session.exec(
        select(FinancialEvent)
        .where(FinancialEvent.aggregate_id == invoice_id)
        .order_by(FinancialEvent.created_at)
    ).all()

    state = InvoiceState()
    for event in events:
        state = state.apply(event)
    return state

Summary: Immediate Action Items

This Week:

Fix the Decimal issue for money fields
Fix the seed data bug
Add transaction boundaries to create_risk_note and void_receipt


This Sprint:

Add financial validation to all money operations
Implement role-based access control
Add database indexes
Replace status strings with enums


Next Quarter:

Implement soft deletes with audit trail
Refactor document model
Extract business logic to service layer
Add event sourcing for financial state



The codebase shows good FastAPI/SQLModel patterns, but the financial domain logic needs hardening. The migration churn suggests you're still discovering the domain model—consider pausing feature development to solidify the core abstractions.

curl -X POST http://localhost:8000/api/v1/policies/quote \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzI1NDIyNzAsInN1YiI6ImE5OWZhZjJkLWU5M2ItNDQ4Yy1iYWY1LTRkZjY3ODZjMzJiZCJ9.0-zp_IcinAccNoP5m4bjFiWn8VgOz-RsoEUiphd-pFQ" \
-H "Content-Type: application/json" \
-d '{
  "product_id": "<motor_private_product_id>",
  "risk_details": {
    "vehicle": { "sum_insured": 1000000, "registration_number": "KCM 123", "make": "Toyota", "model": "Prado", "year_of_manufacture": 2020 }
  }
}'
