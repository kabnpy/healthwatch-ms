import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, func, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Claim,
    ClaimCreate,
    ClaimEvent,
    ClaimEventCreate,
    ClaimUpdate,
    Client,
    ClientCreate,
    ClientUpdate,
    Correspondence,
    CorrespondenceCreate,
    CorrespondenceUpdate,
    Document,
    DocumentCreate,
    DocumentEntityType,
    DocumentUpdate,
    Insurer,
    InsurerCreate,
    InsurerUpdate,
    Invoice,
    InvoiceBulkCreate,
    InvoiceCreate,
    InvoiceLineItem,
    InvoiceLineItemCreate,
    InvoiceStatus,
    InvoiceUpdate,
    Policy,
    PolicyCreate,
    PolicyUpdate,
    Product,
    ProductCreate,
    ProductUpdate,
    Receipt,
    ReceiptAllocation,
    ReceiptAllocationCreate,
    ReceiptCreate,
    ReceiptStatus,
    RiskNote,
    RiskNoteCreate,
    RiskNoteStatus,
    RiskNoteUpdate,
    User,
    UserCreate,
    UserUpdate,
)

# ==========================================
# User CRUD
# ==========================================


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


# ==========================================
# Insurer & Product CRUD
# ==========================================


def create_insurer(*, session: Session, insurer_in: InsurerCreate) -> Insurer:
    db_obj = Insurer.model_validate(insurer_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_insurer_by_name(session: Session, *, name: str) -> Insurer | None:
    statement = (
        select(Insurer).where(Insurer.name == name).where(Insurer.deleted_at == None)
    )
    return session.exec(statement).first()


def get_insurers(session: Session, *, skip: int = 0, limit: int = 100) -> list[Insurer]:
    statement = (
        select(Insurer).where(Insurer.deleted_at == None).offset(skip).limit(limit)
    )
    return list(session.exec(statement).all())


def count_insurers(session: Session) -> int:
    statement = (
        select(func.count()).select_from(Insurer).where(Insurer.deleted_at == None)
    )
    return session.exec(statement).one()


def delete_insurer(session: Session, *, db_insurer: Insurer) -> None:
    db_insurer.deleted_at = datetime.now()
    session.add(db_insurer)
    session.commit()


def update_insurer(
    *, session: Session, db_insurer: Insurer, insurer_in: InsurerUpdate
) -> Insurer:
    insurer_data = insurer_in.model_dump(exclude_unset=True)
    db_insurer.sqlmodel_update(insurer_data)
    session.add(db_insurer)
    session.commit()
    session.refresh(db_insurer)
    return db_insurer


def create_product(*, session: Session, product_in: ProductCreate) -> Product:
    db_obj = Product.model_validate(product_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_product_by_name(session: Session, *, name: str) -> Product | None:
    statement = (
        select(Product).where(Product.name == name).where(Product.deleted_at == None)
    )
    return session.exec(statement).first()


def get_products(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    insurer_id: uuid.UUID | None = None,
) -> list[Product]:
    statement = select(Product).where(Product.deleted_at == None)
    if insurer_id:
        statement = statement.where(Product.insurer_id == insurer_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def count_products(session: Session, *, insurer_id: uuid.UUID | None = None) -> int:
    statement = select(Product).where(Product.deleted_at == None)
    if insurer_id:
        statement = statement.where(Product.insurer_id == insurer_id)
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()


def delete_product(session: Session, *, db_product: Product) -> None:
    db_product.deleted_at = datetime.now()
    session.add(db_product)
    session.commit()


def update_product(
    *, session: Session, db_product: Product, product_in: ProductUpdate
) -> Product:
    product_data = product_in.model_dump(exclude_unset=True)
    db_product.sqlmodel_update(product_data)
    session.add(db_product)
    session.commit()
    session.refresh(db_product)
    return db_product


# ==========================================
# Client CRUD
# ==========================================


def create_client(*, session: Session, client_in: ClientCreate) -> Client:
    db_obj = Client.model_validate(client_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_client_by_kra_pin(session: Session, *, kra_pin: str) -> Client | None:
    statement = (
        select(Client).where(Client.kra_pin == kra_pin).where(Client.deleted_at == None)
    )
    return session.exec(statement).first()


def get_client_by_email(session: Session, *, email: str) -> Client | None:
    statement = (
        select(Client).where(Client.email == email).where(Client.deleted_at == None)
    )
    return session.exec(statement).first()


def update_client(
    *, session: Session, db_client: Client, client_in: ClientUpdate
) -> Client:
    client_data = client_in.model_dump(exclude_unset=True)
    db_client.sqlmodel_update(client_data)
    session.add(db_client)
    session.commit()
    session.refresh(db_client)
    return db_client


def get_clients(session: Session, *, skip: int = 0, limit: int = 100) -> list[Client]:
    statement = (
        select(Client).where(Client.deleted_at == None).offset(skip).limit(limit)
    )
    return list(session.exec(statement).all())


def count_clients(session: Session) -> int:
    statement = (
        select(func.count()).select_from(Client).where(Client.deleted_at == None)
    )
    return session.exec(statement).one()


def delete_client(session: Session, *, db_client: Client) -> None:
    db_client.deleted_at = datetime.now()
    session.add(db_client)
    session.commit()


def create_correspondence(
    *, session: Session, correspondence_in: CorrespondenceCreate
) -> Correspondence:
    db_obj = Correspondence.model_validate(correspondence_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_correspondence(
    *,
    session: Session,
    db_correspondence: Correspondence,
    correspondence_in: CorrespondenceUpdate,
) -> Correspondence:
    correspondence_data = correspondence_in.model_dump(exclude_unset=True)
    db_correspondence.sqlmodel_update(correspondence_data)
    session.add(db_correspondence)
    session.commit()
    session.refresh(db_correspondence)
    return db_correspondence


def get_correspondences(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> list[Correspondence]:
    statement = select(Correspondence).where(Correspondence.deleted_at == None)
    if client_id:
        statement = statement.where(Correspondence.client_id == client_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def count_correspondences(
    session: Session, *, client_id: uuid.UUID | None = None
) -> int:
    statement = select(Correspondence).where(Correspondence.deleted_at == None)
    if client_id:
        statement = statement.where(Correspondence.client_id == client_id)
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()


def delete_correspondence(
    session: Session, *, db_correspondence: Correspondence
) -> None:
    db_correspondence.deleted_at = datetime.now()
    session.add(db_correspondence)
    session.commit()


# ==========================================
# Policy & Risk Note CRUD
# ==========================================


def create_policy(*, session: Session, policy_in: PolicyCreate) -> Policy:
    db_obj = Policy.model_validate(policy_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_policy(session: Session, *, id: uuid.UUID) -> Policy | None:
    statement = (
        select(Policy)
        .where(Policy.id == id)
        .where(Policy.deleted_at == None)
        .options(
            selectinload(cast(Any, Policy.product)),
        )
    )
    return session.exec(statement).first()


def get_policy_by_policy_number(
    session: Session, *, policy_number: str
) -> Policy | None:
    statement = (
        select(Policy)
        .where(Policy.policy_number == policy_number)
        .where(Policy.deleted_at == None)
    )
    return session.exec(statement).first()


def get_policies_by_client_id(
    session: Session, *, client_id: uuid.UUID
) -> Sequence[Policy]:
    statement = (
        select(Policy)
        .where(Policy.client_id == client_id)
        .where(Policy.deleted_at == None)
        .options(
            selectinload(cast(Any, Policy.product)),
        )
    )
    return session.exec(statement).all()


def update_policy(
    *, session: Session, db_policy: Policy, policy_in: PolicyUpdate
) -> Policy:
    policy_data = policy_in.model_dump(exclude_unset=True)
    db_policy.sqlmodel_update(policy_data)
    session.add(db_policy)
    session.commit()
    session.refresh(db_policy)
    return db_policy


def get_policies(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> list[Policy]:
    statement = (
        select(Policy)
        .where(Policy.deleted_at == None)
        .options(selectinload(cast(Any, Policy.product)))
    )
    if client_id:
        statement = statement.where(Policy.client_id == client_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def count_policies(session: Session, *, client_id: uuid.UUID | None = None) -> int:
    statement = select(Policy).where(Policy.deleted_at == None)
    if client_id:
        statement = statement.where(Policy.client_id == client_id)
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()


def delete_policy(session: Session, *, db_policy: Policy) -> None:
    db_policy.deleted_at = datetime.now()
    session.add(db_policy)
    session.commit()


def create_risk_note(*, session: Session, risk_note_in: RiskNoteCreate) -> RiskNote:
    db_obj = RiskNote.model_validate(risk_note_in)
    if not db_obj.risk_note_number:
        from app.services.policy import generate_risk_note_number

        db_obj.risk_note_number = generate_risk_note_number()
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_risk_note(
    *, session: Session, db_risk_note: RiskNote, risk_note_in: RiskNoteUpdate
) -> RiskNote:
    risk_note_data = risk_note_in.model_dump(exclude_unset=True)
    db_risk_note.sqlmodel_update(risk_note_data)
    session.add(db_risk_note)
    session.commit()
    session.refresh(db_risk_note)
    return db_risk_note


def get_risk_notes(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    uninvoiced_only: bool = False,
) -> list[RiskNote]:
    statement = select(RiskNote).where(RiskNote.deleted_at == None)
    if policy_id:
        statement = statement.where(RiskNote.policy_id == policy_id)
    if client_id:
        statement = statement.join(Policy).where(Policy.client_id == client_id)
    if uninvoiced_only:
        statement = statement.where(~RiskNote.invoice_line_items.any())
        statement = statement.where(RiskNote.status != RiskNoteStatus.DRAFT)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def count_risk_notes(
    session: Session,
    *,
    policy_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    uninvoiced_only: bool = False,
) -> int:
    statement = select(RiskNote).where(RiskNote.deleted_at == None)
    if policy_id:
        statement = statement.where(RiskNote.policy_id == policy_id)
    if client_id:
        statement = statement.join(Policy).where(Policy.client_id == client_id)
    if uninvoiced_only:
        statement = statement.where(~RiskNote.invoice_line_items.any())
        statement = statement.where(RiskNote.status != RiskNoteStatus.DRAFT)
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()


def delete_risk_note(session: Session, *, db_risk_note: RiskNote) -> None:
    db_risk_note.deleted_at = datetime.now()
    session.add(db_risk_note)
    session.commit()


# ==========================================
# Claim CRUD
# ==========================================


def create_claim(*, session: Session, claim_in: ClaimCreate) -> Claim:
    db_obj = Claim.model_validate(claim_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_claim(*, session: Session, db_claim: Claim, claim_in: ClaimUpdate) -> Claim:
    claim_data = claim_in.model_dump(exclude_unset=True)
    db_claim.sqlmodel_update(claim_data)
    session.add(db_claim)
    session.commit()
    session.refresh(db_claim)
    return db_claim


def get_claims(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
) -> list[Claim]:
    statement = select(Claim).where(Claim.deleted_at == None)
    if policy_id:
        statement = statement.where(Claim.policy_id == policy_id)
    if client_id:
        statement = statement.join(Policy).where(Policy.client_id == client_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def count_claims(
    session: Session,
    *,
    policy_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
) -> int:
    statement = select(Claim).where(Claim.deleted_at == None)
    if policy_id:
        statement = statement.where(Claim.policy_id == policy_id)
    if client_id:
        statement = statement.join(Policy).where(Policy.client_id == client_id)
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()


def delete_claim(session: Session, *, db_claim: Claim) -> None:
    db_claim.deleted_at = datetime.now()
    session.add(db_claim)
    session.commit()


def create_claim_event(
    *, session: Session, claim_event_in: ClaimEventCreate
) -> ClaimEvent:
    db_obj = ClaimEvent.model_validate(claim_event_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


# ==========================================
# Financial CRUD
# ==========================================


def create_invoice(*, session: Session, invoice_in: InvoiceCreate) -> Invoice:
    db_obj = Invoice.model_validate(invoice_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_invoice(session: Session, *, id: uuid.UUID) -> Invoice | None:
    statement = (
        select(Invoice)
        .where(Invoice.id == id)
        .where(Invoice.deleted_at == None)
        .options(
            selectinload(cast(Any, Invoice.allocations)),
            selectinload(cast(Any, Invoice.line_items)),
        )
    )
    return session.exec(statement).first()


def get_invoices(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> list[Invoice]:
    statement = (
        select(Invoice)
        .where(Invoice.deleted_at == None)
        .options(
            selectinload(cast(Any, Invoice.allocations)),
            selectinload(cast(Any, Invoice.line_items)),
        )
    )
    if client_id:
        statement = statement.where(Invoice.client_id == client_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def update_invoice(
    *, session: Session, db_invoice: Invoice, invoice_in: InvoiceUpdate
) -> Invoice:
    invoice_data = invoice_in.model_dump(exclude_unset=True)
    db_invoice.sqlmodel_update(invoice_data)
    session.add(db_invoice)
    session.commit()
    session.refresh(db_invoice)
    return db_invoice


def create_invoice_bulk(*, session: Session, bulk_in: InvoiceBulkCreate) -> Invoice:
    risk_notes = session.exec(
        select(RiskNote).where(col(RiskNote.id).in_(bulk_in.risk_note_ids))
    ).all()
    total_amount = sum(rn.total_amount for rn in risk_notes)
    invoice_in = InvoiceCreate(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        client_id=bulk_in.client_id,
        date_issued=bulk_in.date_issued,
        total_amount=total_amount,
        balance_due=total_amount,
        notes=bulk_in.notes,
        status=InvoiceStatus.UNPAID,
    )
    invoice = create_invoice(session=session, invoice_in=invoice_in)
    for rn in risk_notes:
        line_item_in = InvoiceLineItemCreate(
            invoice_id=invoice.id,
            risk_note_id=rn.id,
            amount=rn.total_amount,
            description=f"{rn.transaction_type} - RN {rn.risk_note_number}",
        )
        create_invoice_line_item(session=session, line_item_in=line_item_in)
        session.add(rn)
    session.commit()
    session.refresh(invoice)
    return invoice


def create_invoice_line_item(
    *, session: Session, line_item_in: InvoiceLineItemCreate
) -> InvoiceLineItem:
    db_obj = InvoiceLineItem.model_validate(line_item_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def create_receipt(*, session: Session, receipt_in: ReceiptCreate) -> Receipt:
    db_obj = Receipt.model_validate(receipt_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_receipt(session: Session, *, id: uuid.UUID) -> Receipt | None:
    statement = (
        select(Receipt)
        .where(Receipt.id == id)
        .where(Receipt.deleted_at == None)
        .options(selectinload(cast(Any, Receipt.allocations)))
    )
    return session.exec(statement).first()


def get_receipts(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> list[Receipt]:
    statement = (
        select(Receipt)
        .where(Receipt.deleted_at == None)
        .options(selectinload(cast(Any, Receipt.allocations)))
    )
    if client_id:
        statement = statement.where(Receipt.client_id == client_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def void_receipt(*, session: Session, db_receipt: Receipt) -> Receipt:
    db_receipt.status = ReceiptStatus.VOIDED
    session.add(db_receipt)
    session.commit()
    session.refresh(db_receipt)
    return db_receipt


def create_receipt_allocation(
    *, session: Session, allocation_in: ReceiptAllocationCreate
) -> ReceiptAllocation:
    db_obj = ReceiptAllocation.model_validate(allocation_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


# ==========================================
# Document CRUD
# ==========================================


def create_document(*, session: Session, document_in: DocumentCreate) -> Document:
    update_data = {}
    if document_in.entity_type == DocumentEntityType.CLIENT:
        update_data["client_id"] = document_in.entity_id
    elif document_in.entity_type == DocumentEntityType.POLICY:
        update_data["policy_id"] = document_in.entity_id
    elif document_in.entity_type == DocumentEntityType.CLAIM:
        update_data["claim_id"] = document_in.entity_id
    elif document_in.entity_type == DocumentEntityType.RISK_NOTE:
        update_data["risk_note_id"] = document_in.entity_id

    db_obj = Document.model_validate(document_in, update=update_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_document(
    *,
    session: Session,
    db_document: Document,
    document_in: DocumentUpdate,
) -> Document:
    document_data = document_in.model_dump(exclude_unset=True)
    db_document.sqlmodel_update(document_data)
    session.add(db_document)
    session.commit()
    session.refresh(db_document)
    return db_document


def get_documents(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    entity_id: uuid.UUID | None = None,
    entity_type: str | None = None,
) -> list[Document]:
    statement = select(Document)
    if entity_id:
        statement = statement.where(Document.entity_id == entity_id)
    if entity_type:
        statement = statement.where(Document.entity_type == entity_type)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def count_documents(
    session: Session,
    *,
    entity_id: uuid.UUID | None = None,
    entity_type: str | None = None,
) -> int:
    statement = select(Document)
    if entity_id:
        statement = statement.where(Document.entity_id == entity_id)
    if entity_type:
        statement = statement.where(Document.entity_type == entity_type)
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()


def delete_document(session: Session, *, db_document: Document) -> None:
    session.delete(db_document)
    session.commit()
