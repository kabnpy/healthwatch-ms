from datetime import date

from sqlmodel import Session

from app import crud
from app.models import (
    ClientCreate,
    InsurerCreate,
    PolicyCreate,
    ProductCreate,
    RiskNoteCreate,
)
from tests.utils.utils import random_email, random_lower_string


def test_create_insurer(db: Session) -> None:
    name = random_lower_string()
    insurer_in = InsurerCreate(name=name, email=random_email())
    insurer = crud.create_insurer(session=db, insurer_in=insurer_in)
    assert insurer.name == name
    assert insurer.email is not None


def test_create_product(db: Session) -> None:
    insurer_in = InsurerCreate(name=random_lower_string(), email=random_email())
    insurer = crud.create_insurer(session=db, insurer_in=insurer_in)

    product_in = ProductCreate(
        insurer_id=insurer.id,
        name=random_lower_string(),
        class_of_insurance="Motor Private",
    )
    product = crud.create_product(session=db, product_in=product_in)
    assert product.name == product_in.name
    assert product.insurer_id == insurer.id


def test_create_client(db: Session) -> None:
    client_in = ClientCreate(
        name=random_lower_string(),
        kra_pin=random_lower_string(),
        email=random_email(),
        phone=random_lower_string(),
    )
    client = crud.create_client(session=db, client_in=client_in)
    assert client.name == client_in.name
    assert client.email == client_in.email


def test_create_policy(db: Session) -> None:
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
    assert policy.policy_number == policy_in.policy_number
    assert policy.client_id == client.id


def test_create_risk_note(db: Session) -> None:
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

    risk_note_in = RiskNoteCreate(
        risk_note_number=random_lower_string(),
        policy_id=policy.id,
        transaction_type="New Business",
        coverage_start=date(2024, 1, 1),
        coverage_end=date(2024, 12, 31),
        net_premium=1000.0,
        taxes={},
        commission_amount=100.0,
        total_amount=1100.0,
    )
    risk_note = crud.create_risk_note(session=db, risk_note_in=risk_note_in)
    assert risk_note.risk_note_number == risk_note_in.risk_note_number
    assert risk_note.policy_id == policy.id

