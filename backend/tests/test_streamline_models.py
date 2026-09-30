import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import (
    Client,
    Policy,
    PolicyStatus,
    RiskNote,
    TransactionType,
)


def test_policy_has_risk_details(db: Session) -> None:
    """
    Test that the Policy model has a risk_details field and it can be persisted.
    """
    client = Client(
        name="Test Client",
        kra_pin="A123456789Z",
        phone="0712345678",
        email="test@example.com"
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    policy = Policy(
        policy_number="POL-TEST-001",
        client_id=client.id,
        risk_details={"reg_no": "KBA 123A", "sum_insured": 1500000},
        inception_date=date.today(),
        status=PolicyStatus.ACTIVE
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    assert policy.risk_details == {"reg_no": "KBA 123A", "sum_insured": 1500000}

def test_risknote_no_longer_has_policy_snapshot(db: Session) -> None:
    """
    Test that RiskNote no longer has the policy_snapshot attribute.
    """
    with pytest.raises(AttributeError):
        # This should fail after we remove the attribute
        rn = RiskNote(
            policy_id=uuid.uuid4(),
            transaction_type=TransactionType.NEW_BUSINESS,
            coverage_start=date.today(),
            coverage_end=date.today(),
            net_premium=Decimal("1000.00"),
            commission_amount=Decimal("100.00"),
            total_amount=Decimal("1100.00")
        )
        _ = rn.policy_snapshot

def test_risknote_no_longer_has_payment_status(db: Session) -> None:
    """
    Test that RiskNote no longer has the payment_status attribute.
    """
    with pytest.raises(AttributeError):
        # This should fail after we remove the attribute
        rn = RiskNote(
            policy_id=uuid.uuid4(),
            transaction_type=TransactionType.NEW_BUSINESS,
            coverage_start=date.today(),
            coverage_end=date.today(),
            net_premium=Decimal("1000.00"),
            commission_amount=Decimal("100.00"),
            total_amount=Decimal("1100.00")
        )
        _ = rn.payment_status

def test_policy_no_longer_has_computed_traversal_properties() -> None:
    """
    Test that Policy model no longer has the redundant computed properties.
    """
    policy = Policy(policy_number="POL-TEST-002")

    redundant_props = [
        "current_risk_details",
        "total_premium",
        "start_date",
        "end_date",
        "display_name"
    ]

    for prop in redundant_props:
        with pytest.raises(AttributeError):
            getattr(policy, prop)
