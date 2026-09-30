from datetime import date
from decimal import Decimal

from sqlmodel import Session

from app.api.utils import prepare_policy_public
from app.models import (
    Client,
    Insurer,
    Policy,
    PolicyStatus,
    Product,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)


def test_policy_public_contains_active_note(db: Session) -> None:
    """
    Test that prepare_policy_public correctly populates the active_note field.
    """
    # Setup entities
    insurer = Insurer(name="API Insurer")
    db.add(insurer)
    db.commit()

    product = Product(
        name="API Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id
    )
    db.add(product)
    db.commit()

    client = Client(
        name="API Client",
        kra_pin="A111111111Z",
        phone="0711111111"
    )
    db.add(client)
    db.commit()

    policy = Policy(
        policy_number="POL-API-001",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today()
    )
    db.add(policy)
    db.commit()

    # Create two notes, one replaced, one issued
    snapshot1 = {"v": 1}
    rn1 = RiskNote(
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.REPLACED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("1000.00"),
        commission_amount=Decimal("100.00"),
        total_amount=Decimal("1100.00"),
        cover_snapshot=snapshot1
    )
    db.add(rn1)

    snapshot2 = {"v": 2}
    rn2 = RiskNote(
        policy_id=policy.id,
        transaction_type=TransactionType.ENDORSEMENT,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("1200.00"),
        commission_amount=Decimal("120.00"),
        total_amount=Decimal("1320.00"),
        cover_snapshot=snapshot2
    )
    db.add(rn2)
    db.commit()
    db.refresh(policy)

    # Validate PolicyPublic
    policy_public = prepare_policy_public(policy)

    assert hasattr(policy_public, "active_note")
    assert policy_public.active_note is not None
    assert policy_public.active_note.cover_snapshot == snapshot2
    assert policy_public.active_note.status == RiskNoteStatus.ISSUED
