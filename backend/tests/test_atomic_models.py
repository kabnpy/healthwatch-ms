from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import Session

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


def test_policy_no_longer_has_risk_details(db: Session) -> None:
    """
    Test that the Policy model no longer has a risk_details field.
    """
    with pytest.raises(AttributeError):
        # This will fail after we remove the field from the model
        policy = Policy(
            policy_number="POL-ATOMIC-001",
            risk_details={"reg_no": "KBA 123A", "sum_insured": 1500000}
        )
        _ = policy.risk_details

def test_risknote_has_cover_snapshot(db: Session) -> None:
    """
    Test that RiskNote has a cover_snapshot field and it can be persisted.
    """
    # Create required entities
    insurer = Insurer(name="Test Insurer")
    db.add(insurer)
    db.commit()

    product = Product(
        name="Motor Private",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id
    )
    db.add(product)
    db.commit()

    client = Client(
        name="Atomic Client",
        kra_pin="A999999999Z",
        phone="0700000000"
    )
    db.add(client)
    db.commit()

    policy = Policy(
        policy_number="POL-ATOMIC-002",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today()
    )
    db.add(policy)
    db.commit()

    snapshot = {
        "vehicle": {
            "registration_number": "KCM 123",
            "make": "Toyota",
            "sum_insured": 1500000
        },
        "terms": {
            "benefits_and_limits": "Standard Benefits...",
            "excesses": "Standard Excesses...",
            "special_clauses": "Standard Clauses..."
        }
    }

    rn = RiskNote(
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("50000.00"),
        commission_amount=Decimal("5000.00"),
        total_amount=Decimal("55000.00"),
        cover_snapshot=snapshot
    )
    db.add(rn)
    db.commit()
    db.refresh(rn)

    assert rn.cover_snapshot == snapshot

def test_product_has_default_templates(db: Session) -> None:
    """
    Test that Product model has default text templates for terms.
    """
    insurer = Insurer(name="Template Insurer")
    db.add(insurer)
    db.commit()

    product = Product(
        name="Template Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        default_benefits_and_limits="Default Benefits",
        default_excesses="Default Excesses",
        default_special_clauses="Default Clauses"
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    assert product.default_benefits_and_limits == "Default Benefits"
    assert product.default_excesses == "Default Excesses"
    assert product.default_special_clauses == "Default Clauses"
