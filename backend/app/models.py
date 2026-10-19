import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import ConfigDict, EmailStr
from sqlalchemy import JSON, Column, Numeric
from sqlmodel import Field, Relationship, SQLModel

# ==========================================
# Mixins
# ==========================================


def get_datetime_utc() -> datetime:
    """Return the current time as a timezone-aware UTC datetime.

    Returns:
        The current UTC datetime with tzinfo set.
    """
    return datetime.now(UTC)


class AuditMixin(SQLModel):
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column_kwargs={"onupdate": get_datetime_utc},
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
    OPERATIONS = "Operations"
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


class RenewalStatus(str, Enum):
    AWAITING_CARRIER = "awaiting_carrier"
    CARRIER_RECEIVED = "carrier_received"
    CLIENT_INVITED = "client_invited"
    CHANGES_REQUESTED = "changes_requested"
    PAID = "paid"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InvoiceStatus(str, Enum):
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"
    CANCELLED = "Cancelled"


class ReceiptStatus(str, Enum):
    ACTIVE = "Active"
    VOIDED = "Voided"


class PaymentMethod(str, Enum):
    MPESA = "mpesa"
    CHEQUE = "cheque"
    BANK_TRANSFER = "bank_transfer"
    IPF = "ipf"
    CASH = "cash"


class PaymentStatus(str, Enum):
    ACTIVE = "active"
    REVERSED = "reversed"


class PaymentAllocationStatus(str, Enum):
    ACTIVE = "active"
    REVERSED = "reversed"


class ActivityType(str, Enum):
    NOTE = "note"
    CALL = "call"
    PHONE_CALL = "phone_call"
    EMAIL = "email"
    MEETING = "meeting"
    REMINDER = "reminder"
    SYSTEM = "system"


class RateTableStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    RETIRED = "retired"


class PricingMethod(str, Enum):
    BRACKETED_PERCENTAGE = "bracketed_percentage"
    MULTI_COMPONENT = "multi_component"
    FIXED_TIER = "fixed_tier"
    WAGE_ROLL = "wage_roll"
    LIMIT_OF_INDEMNITY = "limit_of_indemnity"
    PACKAGED = "packaged"


class BenefitCalculationType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class BusinessEvent(str, Enum):
    NEW_BUSINESS = "new_business"
    RENEWAL = "renewal"
    COVER_CHANGE = "cover_change"


class IPFStatus(str, Enum):
    PENDING_DEPOSIT = "pending_deposit"
    GUARANTEED = "guaranteed"
    DISBURSED = "disbursed"
    CANCELLED = "cancelled"


class ProductLine(str, Enum):
    MOTOR_COMPREHENSIVE = "motor_comprehensive"
    MOTOR_THIRD_PARTY = "motor_third_party"
    DOMESTIC_PACKAGE = "domestic_package"
    MEDICAL = "medical"
    WIBA = "wiba"
    FIRE = "fire"
    BURGLARY = "burglary"
    ALL_RISKS = "all_risks"
    PERSONAL_ACCIDENT = "personal_accident"
    GOLFERS = "golfers"
    PROFESSIONAL_INDEMNITY = "professional_indemnity"
    PUBLIC_LIABILITY = "public_liability"


class DocumentJobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class DocumentJobResourceType(str, Enum):
    RISK_NOTE = "risk_note"
    INVITATION = "invitation"
    INVOICE = "invoice"
    INVOICE_BATCH = "invoice_batch"
    STATEMENT = "statement"


class ClaimStatus(str, Enum):
    INTIMATED = "intimated"
    DOCUMENTS_PENDING = "documents_pending"
    ADJUSTER_APPOINTED = "adjuster_appointed"
    REPAIRS_AUTHORIZED = "repairs_authorized"
    DISCHARGE_VOUCHER = "discharge_voucher"
    SETTLED = "settled"
    DECLINED = "declined"
    CLOSED = "closed"
    # Legacy aliases
    REPORTED = "Reported"
    ASSESSED = "Assessed"
    PAID = "Paid"
    REJECTED = "Rejected"


class ClaimEventType(str, Enum):
    NOTIFICATION = "Notification"
    ASSESSMENT = "Assessment"
    CORRESPONDENCE = "Correspondence"
    PAYMENT = "Payment"


class DocumentEntityType(str, Enum):
    CLIENT = "Client"
    POLICY = "Policy"
    RENEWAL = "Renewal"
    CLAIM = "Claim"
    USER = "User"
    RISK_NOTE = "RiskNote"
    PAYMENT = "Payment"


class DocumentType(str, Enum):
    INSURER_RECEIPT = "insurer_receipt"
    PROOF_OF_PAYMENT = "proof_of_payment"
    CARRIER_RENEWAL_NOTICE = "carrier_renewal_notice"
    KYC_DOCUMENT = "kyc_document"
    VALUATION_REPORT = "valuation_report"
    LOGBOOK = "Logbook"
    ID = "ID"
    VALUATION = "Valuation"
    POLICE_ABSTRACT = "PoliceAbstract"
    RECEIPT = "Receipt"
    OTHER = "Other"
    # Document Presets for UI consistency
    KRA_PIN_CERTIFICATE = "KRA PIN Certificate"
    NATIONAL_ID_PASSPORT = "National ID / Passport"
    CERTIFICATE_OF_INCORPORATION = "Certificate of Incorporation"
    UTILITY_BILL = "Utility Bill"
    POLICY_SCHEDULE = "Policy Schedule"
    COVER_NOTE = "Cover Note"
    ACCIDENT_PHOTOS = "Accident Photos"
    REPAIR_ESTIMATE = "Repair Estimate"
    CLAIM_FORM = "Claim Form"
    POLICE_REPORT = "Police Report"
    BANK_SLIP = "Bank Slip"
    MPESA_SCREENSHOT = "M-Pesa Screenshot"


class PricingStrategy(str, Enum):
    PERCENTAGE = "Percentage"
    FIXED_TIERED = "FixedTiered"
    MANUAL = "Manual"


class InsuranceClass(str, Enum):
    MOTOR_PRIVATE = "Motor Private"
    MOTOR_COMMERCIAL = "Motor Commercial"
    DOMESTIC_PACKAGE = "Domestic Package"
    WIBA = "WIBA / Employers Liability"
    FIRE_PERILS = "Fire & Perils"
    BURGLARY = "Burglary & Theft"
    MARINE_CARGO = "Marine Cargo"
    MEDICAL = "Medical"
    PERSONAL_ACCIDENT = "Personal Accident"
    PROFESSIONAL_INDEMNITY = "Professional Indemnity"
    TRAVEL = "Travel Insurance"


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
    products: list[Product] = Relationship(back_populates="insurer")
    rate_tables: list[RateTableVersion] = Relationship(back_populates="insurer")
    commission_schedules: list[CommissionSchedule] = Relationship(
        back_populates="insurer"
    )


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
    insurer: InsurerPublic | None = None


class Product(ProductBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    insurer: Insurer = Relationship(
        back_populates="products",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    policies: list[Policy] = Relationship(back_populates="product")

    def validate_risk_details(self, risk_details: dict[str, Any]) -> dict[str, Any]:
        class_name = self.class_of_insurance.lower()
        if "motor private" in class_name:
            from app.schemas import MotorPrivateRiskDetails

            validated = MotorPrivateRiskDetails(**risk_details)
            return validated.model_dump(mode="python")
        elif "domestic" in class_name and any(
            k in risk_details
            for k in (
                "buildings_sum_insured",
                "contents_sum_insured",
                "all_risks_valuables",
            )
        ):
            from app.schemas import DomesticPackageRiskDetails

            validated = DomesticPackageRiskDetails(**risk_details)
            return validated.model_dump(mode="python")
        elif "wiba" in class_name and any(
            k in risk_details
            for k in ("clerical_payroll", "artisan_payroll", "hazardous_payroll")
        ):
            from app.schemas import WIBARiskDetails

            validated = WIBARiskDetails(**risk_details)
            return validated.model_dump(mode="python")
        elif "fire" in class_name and any(
            k in risk_details
            for k in (
                "buildings_sum_insured",
                "plant_machinery_sum_insured",
                "stock_sum_insured",
            )
        ):
            from app.schemas import FirePerilsRiskDetails

            validated = FirePerilsRiskDetails(**risk_details)
            return validated.model_dump(mode="python")
        elif "marine" in class_name and "cif_value" in risk_details:
            from app.schemas import MarineCargoRiskDetails

            validated = MarineCargoRiskDetails(**risk_details)
            return validated.model_dump(mode="python")
        elif "medical" in class_name and any(
            k in risk_details for k in ("inpatient_limit", "principal_age")
        ):
            from app.schemas import MedicalRiskDetails

            validated = MedicalRiskDetails(**risk_details)
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
    policies: list[Policy] = Relationship(back_populates="client")
    correspondence: list[Correspondence] = Relationship(back_populates="client")
    invoices: list[Invoice] = Relationship(back_populates="client")
    receipts: list[Receipt] = Relationship(back_populates="client")
    activities: list[Activity] = Relationship(
        back_populates="client",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    payment_records: list[PaymentRecord] = Relationship(
        back_populates="client",
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class ClientsPublic(SQLModel):
    data: list[ClientPublic]
    count: int


class CorrespondenceBase(AuditMixin, SQLModel):
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    subject: str
    summary: str | None = None
    file_path: str
    date_logged: datetime = Field(default_factory=get_datetime_utc)


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
    client: Client = Relationship(back_populates="correspondence")


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
    client: Client = Relationship(back_populates="policies")
    product: Product | None = Relationship(back_populates="policies")
    risk_notes: list[RiskNote] = Relationship(
        back_populates="policy",
        sa_relationship_kwargs={
            "order_by": "RiskNote.effective_date.desc(), RiskNote.created_at.desc()",
            "lazy": "selectin",
        },
    )
    claims: list[Claim] = Relationship(back_populates="policy")
    vehicles: list[Vehicle] = Relationship(
        back_populates="policy",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    renewals: list[Renewal] = Relationship(
        back_populates="policy",
        sa_relationship_kwargs={
            "order_by": "Renewal.renewal_period_start.desc()",
            "lazy": "selectin",
        },
    )
    activities: list[Activity] = Relationship(
        back_populates="policy",
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class PolicyPublic(PolicyBase):
    id: uuid.UUID
    product: ProductPublic | None = None
    active_note: RiskNotePublic | None = None
    vehicles: list[VehiclePublic] = []


class PoliciesPublic(SQLModel):
    data: list[PolicyPublic]
    count: int


# ==========================================
# Vehicle Models (Motor Policy Asset)
# ==========================================


class VehicleBase(AuditMixin, SQLModel):
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    registration_number: str = Field(index=True)
    make: str
    model: str
    year_of_manufacture: int
    insured_value: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    chassis_number: str | None = None
    engine_number: str | None = None


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(SQLModel):
    registration_number: str | None = None
    make: str | None = None
    model: str | None = None
    year_of_manufacture: int | None = None
    insured_value: Decimal | None = None
    chassis_number: str | None = None
    engine_number: str | None = None


class VehiclePublic(VehicleBase):
    id: uuid.UUID


class Vehicle(VehicleBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy: Policy = Relationship(back_populates="vehicles")


class VehiclesPublic(SQLModel):
    data: list[VehiclePublic]
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
    net_premium: Decimal = Field(
        default=Decimal("0.00"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    commission_amount: Decimal = Field(
        default=Decimal("0.00"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    total_amount: Decimal = Field(
        default=Decimal("0.00"), sa_column=Column(Numeric(precision=15, scale=2))
    )
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
    invoice_line_items: list[InvoiceLineItemPublic] = []


class RiskNote(RiskNoteBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy: Policy = Relationship(back_populates="risk_notes")
    invoice_line_items: list[InvoiceLineItem] = Relationship(back_populates="risk_note")
    allocations: list[ReceiptAllocation] = Relationship(back_populates="risk_note")
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
    client: Client = Relationship(back_populates="invoices")
    line_items: list[InvoiceLineItem] = Relationship(back_populates="invoice")
    allocations: list[ReceiptAllocation] = Relationship(back_populates="invoice")
    payment_allocations: list[PaymentAllocation] = Relationship(
        back_populates="invoice"
    )


class InvoiceLineItemBase(SQLModel):
    invoice_id: uuid.UUID = Field(foreign_key="invoice.id", index=True)
    risk_note_id: uuid.UUID = Field(foreign_key="risknote.id", index=True)
    amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    description: str | None = None


class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass


class InvoiceLineItem(InvoiceLineItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    invoice: Invoice = Relationship(back_populates="line_items")
    risk_note: RiskNote = Relationship(back_populates="invoice_line_items")


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
    receipt: Receipt = Relationship(back_populates="allocations")
    invoice: Invoice = Relationship(back_populates="allocations")
    risk_note: RiskNote = Relationship(back_populates="allocations")


class ReceiptAllocationsPublic(SQLModel):
    data: list[ReceiptAllocationBase]
    count: int


class InvoiceLineItemPublic(InvoiceLineItemBase):
    id: uuid.UUID
    risk_note: RiskNotePublic | None = None
    invoice: InvoicePublic | None = None


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
    client: Client = Relationship(back_populates="receipts")
    allocations: list[ReceiptAllocation] = Relationship(back_populates="receipt")


class ReceiptsPublic(SQLModel):
    data: list[ReceiptPublic]
    count: int


# ==========================================
# Claim Models
# ==========================================


class ClaimBase(AuditMixin, SQLModel):
    claim_number: str = Field(unique=True, index=True)
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    client_id: uuid.UUID | None = Field(
        default=None, foreign_key="client.id", index=True
    )
    vehicle_id: uuid.UUID | None = Field(
        default=None, foreign_key="vehicle.id", index=True
    )
    date_of_loss: date
    date_reported: date = Field(default_factory=date.today)
    description: str
    loss_type: str | None = None
    loss_description: str | None = None
    status: ClaimStatus = Field(default=ClaimStatus.INTIMATED)
    reserve_amount: Decimal = Field(
        default=Decimal("0.00"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    settled_amount: Decimal | None = Field(
        default=None, sa_column=Column(Numeric(precision=15, scale=2), nullable=True)
    )
    assigned_adjuster: str | None = None


class ClaimCreate(ClaimBase):
    pass


class ClaimUpdate(SQLModel):
    claim_number: str | None = None
    policy_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    vehicle_id: uuid.UUID | None = None
    date_of_loss: date | None = None
    date_reported: date | None = None
    description: str | None = None
    loss_type: str | None = None
    loss_description: str | None = None
    status: ClaimStatus | None = None
    reserve_amount: Decimal | None = None
    settled_amount: Decimal | None = None
    assigned_adjuster: str | None = None


class ClaimPublic(ClaimBase):
    id: uuid.UUID


class Claim(ClaimBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy: Policy = Relationship(back_populates="claims")
    client: Client | None = Relationship()
    vehicle: Vehicle | None = Relationship()
    events: list[ClaimEvent] = Relationship(back_populates="claim")


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
    created_at: datetime = Field(default_factory=get_datetime_utc)


class ClaimEventCreate(ClaimEventBase):
    pass


class ClaimEventPublic(ClaimEventBase):
    id: uuid.UUID


class ClaimEvent(ClaimEventBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    claim: Claim = Relationship(back_populates="events")


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
    uploaded_at: datetime = Field(default_factory=get_datetime_utc)


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
# Renewal Models (Workflow Engine)
# ==========================================


class RenewalBase(AuditMixin, SQLModel):
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    status: RenewalStatus = Field(default=RenewalStatus.AWAITING_CARRIER, index=True)
    version: int = Field(default=1)
    renewal_period_start: date
    renewal_period_end: date
    previous_premium: Decimal = Field(
        default=Decimal("0.00"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    proposed_premium: Decimal | None = Field(
        default=None, sa_column=Column(Numeric(precision=15, scale=2), nullable=True)
    )
    agreed_premium: Decimal | None = Field(
        default=None, sa_column=Column(Numeric(precision=15, scale=2), nullable=True)
    )
    selected_calculation_id: uuid.UUID | None = Field(default=None, index=True)
    carrier_document_key: str | None = None
    carrier_received_at: datetime | None = None
    invited_at: datetime | None = None
    paid_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None


class RenewalCreate(SQLModel):
    policy_id: uuid.UUID
    renewal_period_start: date
    renewal_period_end: date
    previous_premium: Decimal = Decimal("0.00")
    proposed_premium: Decimal | None = None
    target_premium: Decimal | None = None
    notes: str | None = None


class RenewalUpdate(SQLModel):
    version: int = Field(default=1, alias="expected_version")
    proposed_premium: Decimal | None = None
    agreed_premium: Decimal | None = None
    selected_calculation_id: uuid.UUID | None = None
    carrier_document_key: str | None = None
    notes: str | None = None

    model_config = {"populate_by_name": True}


class RenewalTransition(SQLModel):
    target_status: RenewalStatus
    version: int = Field(default=1, alias="expected_version")
    agreed_premium: Decimal | None = None
    notes: str | None = None

    model_config = {"populate_by_name": True}


class RenewalPublic(RenewalBase):
    id: uuid.UUID


class Renewal(RenewalBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policy: Policy = Relationship(back_populates="renewals")
    activities: list[Activity] = Relationship(back_populates="renewal")


class RenewalsPublic(SQLModel):
    data: list[RenewalPublic]
    count: int


# ==========================================
# Activity Models (Operational Timeline)
# ==========================================


class ActivityBase(SQLModel):
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    policy_id: uuid.UUID | None = Field(
        default=None, foreign_key="policy.id", index=True
    )
    renewal_id: uuid.UUID | None = Field(
        default=None, foreign_key="renewal.id", index=True
    )
    activity_type: ActivityType = Field(default=ActivityType.NOTE, index=True)
    body: str
    created_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )
    created_at: datetime = Field(default_factory=get_datetime_utc)


class ActivityCreate(SQLModel):
    client_id: uuid.UUID
    policy_id: uuid.UUID | None = None
    renewal_id: uuid.UUID | None = None
    activity_type: ActivityType = ActivityType.NOTE
    body: str


class ActivityPublic(ActivityBase):
    id: uuid.UUID


class Activity(ActivityBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: Client = Relationship(back_populates="activities")
    policy: Policy | None = Relationship(back_populates="activities")
    renewal: Renewal | None = Relationship(back_populates="activities")


class ActivitiesPublic(SQLModel):
    data: list[ActivityPublic]
    count: int


# ==========================================
# Payment & Ledger Models
# ==========================================


class PaymentRecordBase(AuditMixin, SQLModel):
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    unallocated_amount: Decimal = Field(
        default=Decimal("0.00"), sa_column=Column(Numeric(precision=15, scale=2))
    )
    currency: str = Field(default="KES")
    payment_date: date = Field(default_factory=date.today)
    payment_method: PaymentMethod = Field(default=PaymentMethod.MPESA)
    reference_number: str | None = Field(default=None, index=True)
    payer_name: str | None = None
    proof_document_id: uuid.UUID | None = Field(
        default=None, foreign_key="document.id", index=True
    )
    status: PaymentStatus = Field(default=PaymentStatus.ACTIVE, index=True)
    reversal_of_id: uuid.UUID | None = Field(
        default=None, foreign_key="paymentrecord.id", index=True
    )
    reversal_reason: str | None = None


class PaymentRecordCreate(SQLModel):
    client_id: uuid.UUID
    amount: Decimal
    payment_date: date = Field(default_factory=date.today)
    payment_method: PaymentMethod = PaymentMethod.MPESA
    reference_number: str | None = None
    payer_name: str | None = None
    proof_document_id: uuid.UUID | None = None


class PaymentRecordPublic(PaymentRecordBase):
    id: uuid.UUID


class PaymentRecord(PaymentRecordBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: Client = Relationship(back_populates="payment_records")
    allocations: list[PaymentAllocation] = Relationship(back_populates="payment_record")


class PaymentRecordsPublic(SQLModel):
    data: list[PaymentRecordPublic]
    count: int


class PaymentAllocationBase(SQLModel):
    payment_record_id: uuid.UUID = Field(foreign_key="paymentrecord.id", index=True)
    invoice_id: uuid.UUID = Field(foreign_key="invoice.id", index=True)
    risk_note_id: uuid.UUID | None = Field(
        default=None, foreign_key="risknote.id", index=True
    )
    amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    status: PaymentAllocationStatus = Field(
        default=PaymentAllocationStatus.ACTIVE, index=True
    )
    reversal_of_id: uuid.UUID | None = Field(
        default=None, foreign_key="paymentallocation.id", index=True
    )
    reversal_reason: str | None = None
    allocated_at: datetime = Field(default_factory=get_datetime_utc)


class PaymentAllocationCreate(SQLModel):
    payment_record_id: uuid.UUID
    invoice_id: uuid.UUID
    amount: Decimal
    risk_note_id: uuid.UUID | None = None


class PaymentAllocationPublic(PaymentAllocationBase):
    id: uuid.UUID


class PaymentAllocation(PaymentAllocationBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    payment_record: PaymentRecord = Relationship(back_populates="allocations")
    invoice: Invoice = Relationship(back_populates="payment_allocations")


class PaymentAllocationsPublic(SQLModel):
    data: list[PaymentAllocationPublic]
    count: int


class ReversalCreate(SQLModel):
    reversal_reason: str


# ==========================================
# Advisory Rating & Rate Tables (Section 4)
# ==========================================


class RateTableVersionBase(AuditMixin, SQLModel):
    insurer_id: uuid.UUID = Field(foreign_key="insurer.id", index=True)
    class_of_insurance: str = Field(index=True)
    pricing_method: PricingMethod = Field(default=PricingMethod.BRACKETED_PERCENTAGE)
    currency: str = Field(default="KES")
    version_number: int = Field(default=1)
    status: RateTableStatus = Field(default=RateTableStatus.DRAFT, index=True)
    effective_from: date = Field(default_factory=date.today)
    effective_to: date | None = None
    source_reference: str
    change_reason: str | None = None


class RateTableVersionCreate(SQLModel):
    insurer_id: uuid.UUID
    class_of_insurance: str
    pricing_method: PricingMethod = PricingMethod.BRACKETED_PERCENTAGE
    currency: str = "KES"
    version_number: int = 1
    effective_from: date = Field(default_factory=date.today)
    effective_to: date | None = None
    source_reference: str
    change_reason: str | None = None


class RateTableVersionUpdate(SQLModel):
    status: RateTableStatus | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    source_reference: str | None = None
    change_reason: str | None = None


class RateTableVersionPublic(RateTableVersionBase):
    id: uuid.UUID


class RateTableVersion(RateTableVersionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    insurer: Insurer = Relationship(back_populates="rate_tables")
    brackets: list[RateBracket] = Relationship(back_populates="rate_table_version")
    benefits: list[RateBenefit] = Relationship(back_populates="rate_table_version")
    medical_tiers: list[MedicalTier] = Relationship(back_populates="rate_table_version")


class RateTableVersionsPublic(SQLModel):
    data: list[RateTableVersionPublic]
    count: int


class RateBracketBase(SQLModel):
    rate_table_version_id: uuid.UUID = Field(
        foreign_key="ratetableversion.id", index=True
    )
    min_value: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    max_value: Decimal | None = Field(
        default=None, sa_column=Column(Numeric(precision=15, scale=2), nullable=True)
    )
    rate_percent: Decimal = Field(sa_column=Column(Numeric(precision=5, scale=4)))
    minimum_premium: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    display_label: str


class RateBracketCreate(RateBracketBase):
    pass


class RateBracketPublic(RateBracketBase):
    id: uuid.UUID


class RateBracket(RateBracketBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    rate_table_version: RateTableVersion = Relationship(back_populates="brackets")


class RateBracketsPublic(SQLModel):
    data: list[RateBracketPublic]
    count: int


class RateBenefitBase(SQLModel):
    rate_table_version_id: uuid.UUID = Field(
        foreign_key="ratetableversion.id", index=True
    )
    code: str = Field(index=True)
    name: str
    calculation_type: BenefitCalculationType = Field(
        default=BenefitCalculationType.PERCENTAGE
    )
    rate_value: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=4)))
    is_mandatory: bool = Field(default=False)
    is_complimentary: bool = Field(default=False)
    complimentary_threshold: Decimal | None = Field(
        default=None, sa_column=Column(Numeric(precision=15, scale=2), nullable=True)
    )


class RateBenefitCreate(RateBenefitBase):
    pass


class RateBenefitPublic(RateBenefitBase):
    id: uuid.UUID


class RateBenefit(RateBenefitBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    rate_table_version: RateTableVersion = Relationship(back_populates="benefits")


class RateBenefitsPublic(SQLModel):
    data: list[RateBenefitPublic]
    count: int


class MedicalTierBase(SQLModel):
    rate_table_version_id: uuid.UUID = Field(
        foreign_key="ratetableversion.id", index=True
    )
    tier_code: str = Field(index=True)
    benefit_limits: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    premium: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))


class MedicalTierCreate(MedicalTierBase):
    pass


class MedicalTierPublic(MedicalTierBase):
    id: uuid.UUID


class MedicalTier(MedicalTierBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    rate_table_version: RateTableVersion = Relationship(back_populates="medical_tiers")


class MedicalTiersPublic(SQLModel):
    data: list[MedicalTierPublic]
    count: int


class TaxRateRuleBase(SQLModel):
    code: str = Field(unique=True, index=True)
    name: str
    rate_percent: Decimal = Field(sa_column=Column(Numeric(precision=5, scale=4)))
    calculation_basis: str = Field(default="base_premium")
    sequence_order: int = Field(default=1)
    is_active: bool = Field(default=True)


class TaxRateRuleCreate(TaxRateRuleBase):
    pass


class TaxRateRulePublic(TaxRateRuleBase):
    id: uuid.UUID


class TaxRateRule(TaxRateRuleBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class TaxRateRulesPublic(SQLModel):
    data: list[TaxRateRulePublic]
    count: int


class PremiumCalculationBase(SQLModel):
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    renewal_id: uuid.UUID | None = Field(
        default=None, foreign_key="renewal.id", index=True
    )
    business_event: BusinessEvent = Field(default=BusinessEvent.NEW_BUSINESS)
    rating_date: date = Field(default_factory=date.today)
    rate_table_version_id: uuid.UUID | None = Field(
        default=None, foreign_key="ratetableversion.id", index=True
    )
    input_snapshot: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    rule_provenance: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    calculation_detail: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    total_premium: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    is_selected: bool = Field(default=False)
    created_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )
    created_at: datetime = Field(default_factory=get_datetime_utc)


class PremiumCalculationCreate(SQLModel):
    policy_id: uuid.UUID
    renewal_id: uuid.UUID | None = None
    business_event: BusinessEvent = BusinessEvent.NEW_BUSINESS
    rating_date: date = Field(default_factory=date.today)
    rate_table_version_id: uuid.UUID | None = None
    input_snapshot: dict[str, Any] = Field(default_factory=dict)
    rule_provenance: dict[str, Any] = Field(default_factory=dict)
    calculation_detail: dict[str, Any] = Field(default_factory=dict)
    total_premium: Decimal
    is_selected: bool = False


class PremiumCalculationPublic(PremiumCalculationBase):
    id: uuid.UUID


class PremiumCalculation(PremiumCalculationBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class PremiumCalculationsPublic(SQLModel):
    data: list[PremiumCalculationPublic]
    count: int


# ==========================================
# Renewal Invitation Model (Section 3)
# ==========================================


class InvitationBase(SQLModel):
    renewal_id: uuid.UUID = Field(foreign_key="renewal.id", index=True)
    calculation_id: uuid.UUID = Field(foreign_key="premiumcalculation.id", index=True)
    storage_key: str | None = None
    rendered_snapshot: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    generated_at: datetime = Field(default_factory=get_datetime_utc)
    created_by_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", index=True
    )


class InvitationCreate(SQLModel):
    renewal_id: uuid.UUID
    calculation_id: uuid.UUID
    rendered_snapshot: dict[str, Any] = Field(default_factory=dict)
    storage_key: str | None = None


class InvitationPublic(InvitationBase):
    id: uuid.UUID


class Invitation(InvitationBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class InvitationsPublic(SQLModel):
    data: list[InvitationPublic]
    count: int


# ==========================================
# Financing & Commission Models (Section 7)
# ==========================================


class IPFAgreementBase(AuditMixin, SQLModel):
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    policy_id: uuid.UUID = Field(foreign_key="policy.id", index=True)
    invoice_id: uuid.UUID = Field(foreign_key="invoice.id", index=True)
    financier_name: str
    agreement_reference: str = Field(index=True)
    total_financed_amount: Decimal = Field(
        sa_column=Column(Numeric(precision=15, scale=2))
    )
    deposit_amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    number_of_installments: int
    monthly_installment: Decimal = Field(
        sa_column=Column(Numeric(precision=15, scale=2))
    )
    commitment_letter_document_id: uuid.UUID | None = Field(
        default=None, foreign_key="document.id", index=True
    )
    status: IPFStatus = Field(default=IPFStatus.PENDING_DEPOSIT, index=True)


class IPFAgreementCreate(SQLModel):
    client_id: uuid.UUID
    policy_id: uuid.UUID
    invoice_id: uuid.UUID
    financier_name: str
    agreement_reference: str
    total_financed_amount: Decimal
    deposit_amount: Decimal
    number_of_installments: int
    monthly_installment: Decimal
    commitment_letter_document_id: uuid.UUID | None = None
    status: IPFStatus = IPFStatus.PENDING_DEPOSIT


class IPFAgreementUpdate(SQLModel):
    status: IPFStatus | None = None
    commitment_letter_document_id: uuid.UUID | None = None
    financier_name: str | None = None
    agreement_reference: str | None = None


class IPFAgreementPublic(IPFAgreementBase):
    id: uuid.UUID


class IPFAgreement(IPFAgreementBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class IPFAgreementsPublic(SQLModel):
    data: list[IPFAgreementPublic]
    count: int


class CommissionScheduleBase(SQLModel):
    insurer_id: uuid.UUID = Field(foreign_key="insurer.id", index=True)
    product_line: ProductLine = Field(index=True)
    commission_rate_percent: Decimal = Field(
        sa_column=Column(Numeric(precision=5, scale=4))
    )
    withholding_tax_percent: Decimal = Field(
        default=Decimal("0.0500"), sa_column=Column(Numeric(precision=5, scale=4))
    )
    effective_from: date = Field(default_factory=date.today)
    is_active: bool = Field(default=True)


class CommissionScheduleCreate(CommissionScheduleBase):
    pass


class CommissionSchedulePublic(CommissionScheduleBase):
    id: uuid.UUID


class CommissionSchedule(CommissionScheduleBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    insurer: Insurer = Relationship(back_populates="commission_schedules")


class CommissionSchedulesPublic(SQLModel):
    data: list[CommissionSchedulePublic]
    count: int


# ==========================================
# Invoicing Batches & Document Jobs (Section 5 & 6)
# ==========================================


class InvoiceBatchBase(SQLModel):
    client_id: uuid.UUID = Field(foreign_key="client.id", index=True)
    billing_month: str = Field(index=True)
    batch_number: str = Field(unique=True, index=True)
    total_amount: Decimal = Field(sa_column=Column(Numeric(precision=15, scale=2)))
    included_invoice_ids: list[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    generated_at: datetime = Field(default_factory=get_datetime_utc)
    storage_key: str | None = None


class InvoiceBatchCreate(SQLModel):
    client_id: uuid.UUID
    billing_month: str
    batch_number: str
    total_amount: Decimal
    included_invoice_ids: list[str] = Field(default_factory=list)
    storage_key: str | None = None


class InvoiceBatchPublic(InvoiceBatchBase):
    id: uuid.UUID


class InvoiceBatch(InvoiceBatchBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class InvoiceBatchesPublic(SQLModel):
    data: list[InvoiceBatchPublic]
    count: int


class DocumentJobBase(SQLModel):
    resource_type: DocumentJobResourceType = Field(index=True)
    resource_id: uuid.UUID | None = Field(default=None, index=True)
    status: DocumentJobStatus = Field(default=DocumentJobStatus.PENDING, index=True)
    idempotency_key: str = Field(index=True)
    snapshot_data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    attempt_count: int = Field(default=0)
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(default_factory=get_datetime_utc)


class DocumentJobCreate(SQLModel):
    resource_type: DocumentJobResourceType
    resource_id: uuid.UUID | None = None
    idempotency_key: str
    snapshot_data: dict[str, Any] = Field(default_factory=dict)


class DocumentJobPublic(DocumentJobBase):
    id: uuid.UUID


class DocumentJob(DocumentJobBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class DocumentJobsPublic(SQLModel):
    data: list[DocumentJobPublic]
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
VehiclePublic.model_rebuild()
VehiclesPublic.model_rebuild()
RenewalPublic.model_rebuild()
RenewalsPublic.model_rebuild()
ActivityPublic.model_rebuild()
ActivitiesPublic.model_rebuild()
PaymentRecordPublic.model_rebuild()
PaymentRecordsPublic.model_rebuild()
PaymentAllocationPublic.model_rebuild()
PaymentAllocationsPublic.model_rebuild()
RateTableVersionPublic.model_rebuild()
RateTableVersionsPublic.model_rebuild()
RateBracketPublic.model_rebuild()
RateBracketsPublic.model_rebuild()
RateBenefitPublic.model_rebuild()
RateBenefitsPublic.model_rebuild()
MedicalTierPublic.model_rebuild()
MedicalTiersPublic.model_rebuild()
TaxRateRulePublic.model_rebuild()
TaxRateRulesPublic.model_rebuild()
PremiumCalculationPublic.model_rebuild()
PremiumCalculationsPublic.model_rebuild()
InvitationPublic.model_rebuild()
InvitationsPublic.model_rebuild()
IPFAgreementPublic.model_rebuild()
IPFAgreementsPublic.model_rebuild()
CommissionSchedulePublic.model_rebuild()
CommissionSchedulesPublic.model_rebuild()
InvoiceBatchPublic.model_rebuild()
InvoiceBatchesPublic.model_rebuild()
DocumentJobPublic.model_rebuild()
DocumentJobsPublic.model_rebuild()
