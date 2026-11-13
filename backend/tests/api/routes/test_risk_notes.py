import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Policy,
    PolicyStatus,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)
from tests.utils.client import create_random_client
from tests.utils.insurance import create_random_product


def _create_issued_risk_note(db: Session) -> RiskNote:
    db_client = create_random_client(db)
    product = create_random_product(db, class_of_insurance="Motor Private")
    today = date.today()
    policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
        client_id=db_client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=today,
    )
    db.add(policy)
    db.flush()

    risk_note = RiskNote(
        policy_id=policy.id,
        risk_note_number=f"RN-{uuid.uuid4().hex[:8].upper()}",
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        effective_date=today,
        coverage_start=today,
        coverage_end=today + timedelta(days=365),
        net_premium=Decimal("50000.00"),
        financial_breakdown={"training_levy": 100.0, "pcf_levy": 125.0, "stamp_duty": 40.0},
        commission_amount=Decimal("5000.00"),
        total_amount=Decimal("50265.00"),
        cover_snapshot={"sum_insured": 1000000},
        special_clauses=["Initial clause"],
    )
    db.add(risk_note)
    db.commit()
    db.refresh(risk_note)
    return risk_note


def test_create_risk_note_clause_revision(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    original = _create_issued_risk_note(db)

    response = client.post(
        f"{settings.API_V1_STR}/risk-notes/{original.id}/revisions",
        headers=superuser_token_headers,
        json={"special_clauses": ["Updated clause 1", "Updated clause 2"]},
    )

    assert response.status_code == 200
    revised = response.json()
    assert revised["id"] != str(original.id)
    assert revised["previous_risk_note_id"] == str(original.id)
    assert revised["special_clauses"] == ["Updated clause 1", "Updated clause 2"]
    assert Decimal(str(revised["net_premium"])) == Decimal("50000.00")
    assert revised["financial_breakdown"] == {
        "training_levy": 100.0,
        "pcf_levy": 125.0,
        "stamp_duty": 40.0,
    }
    assert Decimal(str(revised["commission_amount"])) == Decimal("5000.00")
    assert Decimal(str(revised["total_amount"])) == Decimal("50265.00")
    assert revised["status"] == RiskNoteStatus.ISSUED.value

    original_resp = client.get(
        f"{settings.API_V1_STR}/risk-notes/{original.id}",
        headers=superuser_token_headers,
    )
    assert original_resp.status_code == 200
    assert original_resp.json()["status"] == RiskNoteStatus.REPLACED.value
