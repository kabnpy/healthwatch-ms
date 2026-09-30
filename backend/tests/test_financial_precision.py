from datetime import date
from decimal import Decimal

from sqlmodel import Session

from app import crud
from app.models import (
    ClientCreate,
    PolicyCreate,
    RiskNoteCreate,
)
from tests.utils.utils import random_email, random_lower_string


def test_floating_point_precision_error(db: Session) -> None:
    # Demonstrate that Decimal resolves the precision error: 0.1 + 0.2 == 0.3

    client_in = ClientCreate(
        name=random_lower_string(),
        kra_pin=random_lower_string(),
        email=random_email(),
        phone=random_lower_string(),
    )
    client = crud.create_client(session=db, client_in=client_in)

    policy_in = PolicyCreate(
        policy_number=random_lower_string(),
        client_id=client.id,
    )
    policy = crud.create_policy(session=db, policy_in=policy_in)

    # We'll use Decimal("0.1") and Decimal("0.2")
    risk_note_in = RiskNoteCreate(
        risk_note_number=random_lower_string(),
        policy_id=policy.id,
        transaction_type="New Business",
        coverage_start=date(2024, 1, 1),
        coverage_end=date(2024, 12, 31),
        net_premium=Decimal("0.1"),
        commission_amount=Decimal("0.2"),
        total_amount=Decimal("0.1") + Decimal("0.2"),
    )

    # With Decimal, this should be exactly 0.3
    assert risk_note_in.total_amount == Decimal("0.3")

    risk_note = crud.create_risk_note(session=db, risk_note_in=risk_note_in)
    db.refresh(risk_note)

    # It should remain precise after DB roundtrip
    assert risk_note.total_amount == Decimal("0.3")


def test_money_should_be_precise(db: Session) -> None:
    client_in = ClientCreate(
        name=random_lower_string(),
        kra_pin=random_lower_string(),
        email=random_email(),
        phone=random_lower_string(),
    )
    client = crud.create_client(session=db, client_in=client_in)

    policy_in = PolicyCreate(
        policy_number=random_lower_string(),
        client_id=client.id,
    )
    policy = crud.create_policy(session=db, policy_in=policy_in)

    # Adding many small amounts using Decimal
    total = Decimal("0.0")
    for _ in range(10):
        total += Decimal("0.1")

    # total should be exactly 1.0

    risk_note_in = RiskNoteCreate(
        risk_note_number=random_lower_string(),
        policy_id=policy.id,
        transaction_type="New Business",
        coverage_start=date(2024, 1, 1),
        coverage_end=date(2024, 12, 31),
        net_premium=total,
        commission_amount=Decimal("0.0"),
        total_amount=total,
    )

    risk_note = crud.create_risk_note(session=db, risk_note_in=risk_note_in)
    db.refresh(risk_note)

    # We expect exactly 1.0
    assert risk_note.total_amount == Decimal("1.0")
