from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.main import app
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

client = TestClient(app)

def test_read_policy_returns_active_note(db: Session, superuser_token_headers: dict[str, str]) -> None:
    """
    Test that GET /policies/{id} returns the active_note with cover_snapshot.
    """
    # Setup
    insurer = Insurer(name="Integration Insurer")
    db.add(insurer)
    db.commit()

    product = Product(
        name="Integration Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id
    )
    db.add(product)
    db.commit()

    test_client = Client(
        name="Integration Client",
        kra_pin="I111111111Z",
        phone="0733333333"
    )
    db.add(test_client)
    db.commit()

    policy = Policy(
        policy_number="POL-INT-001",
        client_id=test_client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today()
    )
    db.add(policy)
    db.commit()

    snapshot = {
        "vehicle": {"reg": "KCC 123", "sum_insured": 2000000},
        "terms": {"clauses": "None"}
    }
    rn = RiskNote(
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("100000.00"),
        commission_amount=Decimal("10000.00"),
        total_amount=Decimal("110000.00"),
        cover_snapshot=snapshot
    )
    db.add(rn)
    db.commit()

    response = client.get(
        f"{settings.API_V1_STR}/policies/{policy.id}",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    content = response.json()
    assert "active_note" in content
    assert content["active_note"] is not None
    assert content["active_note"]["cover_snapshot"] == snapshot
    assert content["active_note"]["total_amount"] == "110000.00"
