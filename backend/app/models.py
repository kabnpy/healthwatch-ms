import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional, cast

from pydantic import ConfigDict, EmailStr, computed_field
from sqlalchemy import JSON, Column, Numeric
from sqlmodel import Field, Relationship, SQLModel

# ==========================================
# Mixins
# ==========================================


class AuditMixin(SQLModel):
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(
        default_factory=datetime.now, sa_column_kwargs={"onupdate": datetime.now}
    )

    deleted_at: datetime | None = Field(default=None, index=True)
    deleted_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )


# ==========================================
# Enums
# ==========================================


class UserRole(str, Enum):
    ADMIN = "Admin"
    UNDERWRITER = "Underwriter"
    CASHIER = "Cashier"
    VIEWER = "Viewer"


class PolicyStatus(str, Enum):
    ACTIVE = "Active"
    EXPIRED = "Expired"
    CANCELLED = "Cancelled"
    LAPSED = "Lapsed"


class TransactionType(str, Enum):
    NEW_BUSINESS = "New Business"
    RENEWAL = "Renewal"
    ENDORSEMENT = "Endorsement"
    CANCELLATION = "Cancellation"


class RiskNoteStatus(str, Enum):
    DRAFT = "Draft"
    ISSUED = "Issued"
    REPLACED = "Replaced"  # superseded by a newer note on same policy
    CANCELLED = "Cancelled"
    ACTIVE = "Issued"  # Alias for backward compatibility


class InvoiceStatus(str, Enum):
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"
    CANCELLED = "Cancelled"


class ReceiptStatus(str, Enum):
    ACTIVE = "Active"
    VOIDED = "Voided"


class ClaimStatus(str, Enum):
    REPORTED = "Reported"
    ASSESSED = "Assessed"
    PAID = "Paid"
    REJECTED = "Rejected"
    CLOSED = "Closed"


class ClaimEventType(str, Enum):
    NOTIFICATION = "Notification"
    ASSESSMENT = "Assessment"
    CORRESPONDENCE = "Correspondence"
    PAYMENT = "Payment"


class DocumentEntityType(str, Enum):
    CLIENT = "Client"
    POLICY = "Policy"
    CLAIM = "Claim"
    USER = "User"
    RISK_NOTE = "RiskNote"


class DocumentType(str, Enum):
    LOGBOOK = "Logbook"
    ID = "ID"
    VALUATION = "Valuation"
    POLICE_ABSTRACT = "PoliceAbstract"
    RECEIPT = "Receipt"
    OTHER = "Other"


class PricingStrategy(str, Enum):
    PERCENTAGE = "Percentage"
    FIXED_TIERED = "FixedTiered"
    MANUAL = "Manual"


# ==========================================
# Common Models
# ==========================================


class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None


# ==========================================
# User Models
# ==========================================


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    role: UserRole = Field(default=UserRole.VIEWER)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str


class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ==========================================
# Insurer & Product Models
# ==========================================


class InsurerBase(AuditMixin, SQLModel):
    model_config = ConfigDict(validate_assignment=True)  # type: ignore
    name: str = Field(unique=True, index=True)
    email: str | None = None
    phone: str | None = None


class InsurerCreate(InsurerBase):
    pass


class InsurerUpdate(SQLModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class InsurerPublic(InsurerBase):
    id: uuid.UUID


class Insurer(InsurerBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    products: list["Product"] = Relationship(back_populates="insurer")


class InsurersPublic(SQLModel):
    data: list[InsurerPublic]
    count: int


class ProductBase(AuditMixin, SQLModel):
    insurer_id: uuid.UUID = Field(foreign_key="insurer.id", index=True)
    name: str
    class_of_insurance: str  # "Motor Private", "Fire"
    product_details: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    pricing_strategy: PricingStrategy = Field(default=PricingStrategy.PERCENTAGE)
    pricing_rules: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    default_commission_rate: float = 10.0
    # Text templates for document terms
    default_benefits_and_limits: str | None = None
    default_excesses: str | None = None
    default_special_clauses: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(SQLModel):
    insurer_id: uuid.UUID | None = None
    name: str | None = None
    class_of_insurance: str | None = None
    product_details: dict[str, Any] | None = None
    pricing_strategy: PricingStrategy | None = None
    pricing_rules: dict[str, Any] | None = None
    default_commission_rate: float | None = None


class ProductPublic(ProductBase):
    id: uuid.UUID
    insurer: Optional["InsurerPublic"] = None


class Product(ProductBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    insurer: "Insurer" = Relationship(back_populates="products")
    policies: list["Policy"] = Relationship(back_populates="product")

    def validate_risk_details(self, risk_details: dict[str, Any]) -> dict[str, Any]:
        if "motor private" in self.class_of_insurance.lower():
            from app.schemas import MotorPrivateRiskDetails

            validated = MotorPrivateRiskDetails(**risk_details)
            
            # Return a clean, semantic structure that is JSON-serializable
            return validated.model_dump(mode="python")
        return risk_details
    def calculate_premium(self, risk_details: dict[str, Any]) -> Decimal:
        from app.services.rating import RatingService

        breakdown = RatingService.calculate_breakdown(self, risk_details)
        return breakdown.net_premium


class ProductsPublic(SQLModel):
    data: list[ProductPublic]
    count: int


# ==========================================
# Client Models
# ==========================================


class ClientBase(AuditMixin, SQLModel):
    model_config = ConfigDict(validate_assignment=True)  # type: ignore
    client_type: str = Field(default="Individual")
    name: str = Field(index=True)
    kra_pin: str = Field(unique=True, index=True)
    email: str | None = None
    phone: str
    physical_address: str | None = None
    postal_number: str | None = None
    postal_code: str | None = None
    town: str | None = None
    contacts: list[dict[str, Any]] = Field(default_factory=list, sa_type=JSON)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(SQLModel):
    client_type: str | None = None
    name: str | None = None
    kra_pin: str | None = None
    email: str | None = None
    phone: str | None = None
    physical_address: str | None = None
    postal_number: str | None = None
    postal_code: str | None = None
    town: str | None = None
    contacts: list[dict[str, Any]] | None = None


class ClientPublic(ClientBase):
    id: uuid.UUID


class Client(ClientBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policies: list["Policy"] = Relationship(back_populates="client")
    correspondence: list["Correspondence"] = Relationship(back_populates="client")
    invoices: list["Invoice"] = Relationship(back_populates="client")
    receipts: list["Receipt"] = Relationship(back_populates="client")


class ClientsPublic(SQLModel):
    data: list[ClientPublic]
    count: int


class CorrespondenceBase(AuditMixin, SQLModel):
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    subject: str
    summary: str | None = None
    file_path: str
    date_logged: datetime = Field(default_factory=datetime.now)


class CorrespondenceCreate(CorrespondenceBase):
    pass


class CorrespondenceUpdate(SQLModel):
    client_id: uuid.UUID | None = None
    subject: str | None = None
    summary: str | None = None
    file_path: str | None = None
    date_logged: datetime | None = None


class CorrespondencePublic(CorrespondenceBase):
    id: uuid.UUID


class Correspondence(CorrespondenceBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: "Client" = Relationship(back_populates="correspondence")


class CorrespondencesPublic(SQLModel):
    data: list[CorrespondencePublic]
    count: int


# ==========================================
# Policy & Risk Note Models
# ==========================================


class PolicyBase(AuditMixin, SQLModel):
    model_config = ConfigDict(validate_assignment=True)  # type: ignore
    policy_number: str = Field(unique=True, index=True)
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    product_id: uuid.UUID | None = Field(
        default=None, foreign_key="product.id", index=True
    )
    status: PolicyStatus = Field(default=PolicyStatus.ACTIVE)
    # inception_date = when this policy was first taken out. Never changes.
    inception_date: date = Field(default_factory=date.today)


class PolicyCreate(PolicyBase):
    pass


class PolicyCreateExtended(PolicyCreate):
    coverage_start: date = Field(default_factory=date.today)
    coverage_end: date
    risk_details: dict[str, Any] = Field(default_factory=dict)


class EndorsementCreate(SQLModel):
    updated_risk_details: dict[str, Any]
    change_description: str
    effective_date: date | None = None


class PolicyUpdate(SQLModel):
    policy_number: str | None = None
    client_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    status: PolicyStatus | None = None
    inception_date: date | None = None


class Policy(PolicyBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: "Client" = Relationship(back_populates="policies")
    product: Optional["Product"] = Relationship(back_populates="policies")
    risk_notes: list["RiskNote"] = Relationship(
        back_populates="policy",
        sa_relationship_kwargs={
            "order_by": "RiskNote.effective_date.desc(), RiskNote.created_at.desc()",
            "lazy": "selectin",
        },
    )
    claims: list["Claim"] = Relationship(back_populates="policy")


class PolicyPublic(PolicyBase):
    id: uuid.UUID
    product: ProductPublic | None = None
    active_note: Optional["RiskNotePublic"] = None


class PoliciesPublic(SQLModel):
    data: list[PolicyPublic]
    count: int


class RiskNoteBase(AuditMixin, SQLModel):
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    risk_note_number: str | None = Field(default=None, unique=True, index=True)
    transaction_type: TransactionType
    status: RiskNoteStatus = Field(default=RiskNoteStatus.DRAFT)
    previous_risk_note_id: uuid.UUID | None = Field(
        default=None, foreign_key="risknote.id", index=True
    )
    created_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )
    effective_date: date = Field(default_factory=date.today, index=True)
    coverage_start: date
    coverage_end: date
    net_premium: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    commission_amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    total_amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    cover_snapshot: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)


class RiskNoteCreate(RiskNoteBase):
    financial_breakdown: dict[str, Any] = Field(default_factory=dict)
    special_clauses: list[str] = Field(default_factory=list)


class RiskNoteUpdate(SQLModel):
    transaction_type: TransactionType | None = None
    risk_note_number: str | None = None
    status: RiskNoteStatus | None = None
    previous_risk_note_id: uuid.UUID | None = None
    effective_date: date | None = None
    coverage_start: date | None = None
    coverage_end: date | None = None
    net_premium: Decimal | None = None
    financial_breakdown: dict[str, Any] | None = None
    commission_amount: Decimal | None = None
    total_amount: Decimal | None = None
    special_clauses: list[str] | None = None
    cover_snapshot: dict[str, Any] | None = None


class RiskNotePublic(RiskNoteBase):
    id: uuid.UUID
    policy: PolicyPublic | None = None
    financial_breakdown: dict[str, Any] = Field(default_factory=dict)
    special_clauses: list[str] = Field(default_factory=list)
    invoice_line_items: list["InvoiceLineItemPublic"] = []


class RiskNote(RiskNoteBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy: Policy = Relationship(back_populates="risk_notes")
    invoice_line_items: list["InvoiceLineItem"] = Relationship(
        back_populates="risk_note"
    )
    allocations: list["ReceiptAllocation"] = Relationship(back_populates="risk_note")
    financial_breakdown: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    special_clauses: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class RiskNotesPublic(SQLModel):
    data: list[RiskNotePublic]
    count: int


# ==========================================
# Financial Models
# ==========================================


class InvoiceBase(AuditMixin, SQLModel):
    model_config = ConfigDict(validate_assignment=True)  # type: ignore
    invoice_number: str = Field(unique=True, index=True)
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    date_issued: date = Field(default_factory=date.today)
    due_date: date | None = None
    status: InvoiceStatus = Field(default=InvoiceStatus.UNPAID)
    total_amount: Decimal = Field(
        default=Decimal("0.0"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    balance_due: Decimal = Field(
        default=Decimal("0.0"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    notes: str | None = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceBulkCreate(SQLModel):
    client_id: uuid.UUID
    risk_note_ids: list[uuid.UUID]
    date_issued: date = Field(default_factory=date.today)
    notes: str | None = None


class InvoiceUpdate(SQLModel):
    invoice_number: str | None = None
    due_date: date | None = None
    status: InvoiceStatus | None = None
    total_amount: Decimal | None = None
    balance_due: Decimal | None = None
    notes: str | None = None


class Invoice(InvoiceBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: "Client" = Relationship(back_populates="invoices")
    line_items: list["InvoiceLineItem"] = Relationship(back_populates="invoice")
    allocations: list["ReceiptAllocation"] = Relationship(back_populates="invoice")


class InvoiceLineItemBase(SQLModel):
    invoice_id: uuid.UUID = Field(foreign_key="invoice.id", index=True)
    risk_note_id: uuid.UUID = Field(foreign_key="risknote.id", index=True)
    amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    description: str | None = None


class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass


class InvoiceLineItem(InvoiceLineItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    invoice: "Invoice" = Relationship(back_populates="line_items")
    risk_note: "RiskNote" = Relationship(back_populates="invoice_line_items")


class ReceiptBase(AuditMixin, SQLModel):
    receipt_number: str = Field(unique=True, index=True)
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    date_received: date
    amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    unallocated_amount: Decimal = Field(
        default=Decimal("0.0"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    mode: str
    reference: str
    notes: str | None = None
    status: ReceiptStatus = Field(default=ReceiptStatus.ACTIVE)
    created_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )


class ReceiptCreate(ReceiptBase):
    pass


class ReceiptUpdate(SQLModel):
    receipt_number: str | None = None
    date_received: date | None = None
    amount: Decimal | None = None
    unallocated_amount: Decimal | None = None
    mode: str | None = None
    reference: str | None = None
    notes: str | None = None
    status: ReceiptStatus | None = None


class ReceiptAllocationBase(SQLModel):
    receipt_id: uuid.UUID = Field(foreign_key="receipt.id", index=True)
    invoice_id: uuid.UUID = Field(foreign_key="invoice.id", index=True)
    risk_note_id: uuid.UUID | None = Field(
        default=None, foreign_key="risknote.id", index=True
    )
    amount_allocated: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))


class ReceiptAllocationCreate(ReceiptAllocationBase):
    pass


class ReceiptAllocation(ReceiptAllocationBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    receipt: "Receipt" = Relationship(back_populates="allocations")
    invoice: "Invoice" = Relationship(back_populates="allocations")
    risk_note: "RiskNote" = Relationship(back_populates="allocations")


class ReceiptAllocationsPublic(SQLModel):
    data: list[ReceiptAllocationBase]
    count: int


class InvoiceLineItemPublic(InvoiceLineItemBase):
    id: uuid.UUID
    risk_note: Optional["RiskNotePublic"] = None
    invoice: Optional["InvoicePublic"] = None


class InvoicePublic(InvoiceBase):
    id: uuid.UUID
    line_items: list[InvoiceLineItemPublic] = []
    allocations: list[ReceiptAllocationBase] = []


class InvoicesPublic(SQLModel):
    data: list[InvoicePublic]
    count: int


class ReceiptPublic(ReceiptBase):
    id: uuid.UUID
    allocations: list[ReceiptAllocationBase] = []


class Receipt(ReceiptBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: "Client" = Relationship(back_populates="receipts")
    allocations: list["ReceiptAllocation"] = Relationship(back_populates="receipt")


class ReceiptsPublic(SQLModel):
    data: list[ReceiptPublic]
    count: int


# ==========================================
# Claim Models
# ==========================================


class ClaimBase(AuditMixin, SQLModel):
    claim_number: str = Field(unique=True, index=True)
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    date_of_loss: date
    date_reported: date = Field(default_factory=date.today)
    description: str
    status: ClaimStatus = Field(default=ClaimStatus.REPORTED)
    reserve_amount: Decimal = Field(
        default=Decimal("0.0"), sa_column=Column(Numeric(precision=15, scale=2))
    )


class ClaimCreate(ClaimBase):
    pass


class ClaimUpdate(SQLModel):
    claim_number: str | None = None
    policy_id: uuid.UUID | None = None
    date_of_loss: date | None = None
    date_reported: date | None = None
    description: str | None = None
    status: ClaimStatus | None = None
    reserve_amount: Decimal | None = None


class ClaimPublic(ClaimBase):
    id: uuid.UUID


class Claim(ClaimBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy: "Policy" = Relationship(back_populates="claims")
    events: list["ClaimEvent"] = Relationship(back_populates="claim")


class ClaimsPublic(SQLModel):
    data: list[ClaimPublic]
    count: int


class ClaimEventBase(SQLModel):
    claim_id: uuid.UUID = Field(foreign_key="claim.id", index=True)
    event_type: ClaimEventType
    description: str
    created_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )
    created_at: datetime = Field(default_factory=datetime.now)


class ClaimEventCreate(ClaimEventBase):
    pass


class ClaimEventPublic(ClaimEventBase):
    id: uuid.UUID


class ClaimEvent(ClaimEventBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    claim: "Claim" = Relationship(back_populates="events")


class ClaimEventsPublic(SQLModel):
    data: list[ClaimEventPublic]
    count: int


# ==========================================
# Document Models
# ==========================================


class DocumentBase(SQLModel):
    model_config = ConfigDict(validate_assignment=True)  # type: ignore
    document_type: DocumentType
    file_path: str
    mime_type: str | None = None
    uploaded_at: datetime = Field(default_factory=datetime.now)


class DocumentCreate(DocumentBase):
    entity_type: DocumentEntityType
    entity_id: uuid.UUID
    doc_metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentUpdate(SQLModel):
    document_type: DocumentType | None = None
    file_path: str | None = None
    mime_type: str | None = None
    doc_metadata: dict[str, Any] | None = None


class DocumentPublic(DocumentBase):
    id: uuid.UUID
    entity_type: DocumentEntityType
    entity_id: uuid.UUID
    doc_metadata: dict[str, Any] = Field(default_factory=dict)


class Document(DocumentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    entity_type: DocumentEntityType
    entity_id: uuid.UUID
    doc_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class DocumentsPublic(SQLModel):
    data: list[DocumentPublic]
    count: int


# ==========================================
# Late Binding / Rebuild
# ==========================================

InvoiceLineItemPublic.model_rebuild()
InvoicePublic.model_rebuild()
InvoicesPublic.model_rebuild()
ReceiptPublic.model_rebuild()
ReceiptsPublic.model_rebuild()
PolicyPublic.model_rebuild()
PoliciesPublic.model_rebuild()
RiskNotePublic.model_rebuild()
RiskNotesPublic.model_rebuild()
ClaimPublic.model_rebuild()
ClaimsPublic.model_rebuild()
ClaimEventPublic.model_rebuild()
ClaimEventsPublic.model_rebuild()
DocumentPublic.model_rebuild()
DocumentsPublic.model_rebuild()
