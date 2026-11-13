import uuid
from datetime import date, timedelta

from sqlmodel import Session

from app.models import (
    Claim,
    ClaimCreate,
    Insurer,
    InsurerCreate,
    Invoice,
    InvoiceCreate,
    Policy,
    PolicyCreateExtended,
    Product,
    ProductCreate,
)
from app.services.catalog import catalog_service
from app.services.claim import ClaimService
from app.services.client_ledger import ClientLedgerService
from app.services.policy import policy_service
from tests.utils.client import create_random_client
from tests.utils.utils import random_email, random_lower_string


def create_random_insurer(db: Session) -> Insurer:
    name = random_lower_string()
    email = random_email()
    insurer_in = InsurerCreate(name=name, email=email)
    return catalog_service.create_insurer(session=db, insurer_in=insurer_in)


def create_random_product(
    db: Session,
    insurer_id: uuid.UUID | None = None,
    class_of_insurance: str = "Generic",
) -> Product:
    if not insurer_id:
        insurer = create_random_insurer(db)
        insurer_id = insurer.id
    name = random_lower_string()
    product_in = ProductCreate(
        insurer_id=insurer_id, name=name, class_of_insurance=class_of_insurance
    )
    return catalog_service.create_product(session=db, product_in=product_in)


def create_random_policy(
    db: Session, client_id: uuid.UUID | None = None, product_id: uuid.UUID | None = None
) -> Policy:
    if not client_id:
        client = create_random_client(db)
        client_id = client.id
    if not product_id:
        product = create_random_product(db)
        product_id = product.id

    policy_number = random_lower_string()
    policy_in = PolicyCreateExtended(
        policy_number=policy_number,
        client_id=client_id,
        product_id=product_id,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
        risk_details={"info": "random details"},
    )
    return policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        risk_details=policy_in.risk_details,
        coverage_start=policy_in.coverage_start,
        coverage_end=policy_in.coverage_end,
    )


def create_random_invoice(db: Session, client_id: uuid.UUID | None = None) -> Invoice:
    if not client_id:
        client = create_random_client(db)
        client_id = client.id
    invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
    invoice_in = InvoiceCreate(
        invoice_number=invoice_number,
        client_id=client_id,
        date_issued=date.today(),
        total_amount=5000.0,
        balance_due=5000.0,
        status="Unpaid",
    )
    return ClientLedgerService.create_invoice(session=db, invoice_in=invoice_in)


def create_random_claim(db: Session, policy_id: uuid.UUID | None = None) -> Claim:
    if not policy_id:
        policy = create_random_policy(db)
        policy_id = policy.id

    claim_number = random_lower_string()
    claim_in = ClaimCreate(
        claim_number=claim_number,
        policy_id=policy_id,
        date_of_loss=date.today(),
        description="Fender bender",
    )
    return ClaimService.create_claim(session=db, claim_in=claim_in)
