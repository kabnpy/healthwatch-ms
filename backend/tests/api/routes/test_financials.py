import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    InvoiceLineItem,
    Policy,
    PolicyStatus,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)
from tests.utils.client import create_random_client
from tests.utils.insurance import (
    create_random_invoice,
    create_random_product,
)


def test_read_invoices(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_invoice(db)
    response = client.get(
        f"{settings.API_V1_STR}/financials/invoices/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 1


def test_create_invoice(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    data = {
        "invoice_number": f"INV-{uuid.uuid4().hex[:8].upper()}",
        "client_id": str(db_client.id),
        "total_amount": 1000.0,
        "balance_due": 1000.0,
        "status": "Unpaid",
    }
    response = client.post(
        f"{settings.API_V1_STR}/financials/invoices/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["invoice_number"] == data["invoice_number"]
    assert content["client_id"] == str(db_client.id)


def test_retired_receipt_endpoints_return_404(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    receipt_id = uuid.uuid4()
    assert (
        client.get(
            f"{settings.API_V1_STR}/financials/receipts/",
            headers=superuser_token_headers,
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{settings.API_V1_STR}/financials/receipts/",
            headers=superuser_token_headers,
            json={},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{settings.API_V1_STR}/financials/receipts/{receipt_id}/allocations",
            headers=superuser_token_headers,
            json={},
        ).status_code
        == 404
    )


def _create_risk_note_for_client(
    db: Session, client_id: uuid.UUID, total_amount: Decimal
) -> RiskNote:
    product = create_random_product(db, class_of_insurance="Motor Private")
    today = date.today()
    policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
        client_id=client_id,
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
        net_premium=total_amount,
        financial_breakdown={},
        commission_amount=Decimal("0.00"),
        total_amount=total_amount,
        cover_snapshot={},
        special_clauses=[],
    )
    db.add(risk_note)
    db.commit()
    db.refresh(risk_note)
    return risk_note


def test_create_bulk_invoice_empty_risk_notes_returns_422(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    response = client.post(
        f"{settings.API_V1_STR}/financials/bulk-invoices/",
        headers=superuser_token_headers,
        json={
            "client_id": str(db_client.id),
            "risk_note_ids": [],
        },
    )
    assert response.status_code == 422


def test_create_bulk_invoice_missing_risk_note_returns_404(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    response = client.post(
        f"{settings.API_V1_STR}/financials/bulk-invoices/",
        headers=superuser_token_headers,
        json={
            "client_id": str(db_client.id),
            "risk_note_ids": [str(uuid.uuid4())],
        },
    )
    assert response.status_code == 404


def test_create_bulk_invoice_wrong_client_returns_422(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    target_client = create_random_client(db)
    other_client = create_random_client(db)
    rn = _create_risk_note_for_client(db, other_client.id, Decimal("1500.00"))
    response = client.post(
        f"{settings.API_V1_STR}/financials/bulk-invoices/",
        headers=superuser_token_headers,
        json={
            "client_id": str(target_client.id),
            "risk_note_ids": [str(rn.id)],
        },
    )
    assert response.status_code == 422


def test_create_bulk_invoice_happy_path(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    rn1 = _create_risk_note_for_client(db, db_client.id, Decimal("1000.00"))
    rn2 = _create_risk_note_for_client(db, db_client.id, Decimal("2500.50"))

    response = client.post(
        f"{settings.API_V1_STR}/financials/bulk-invoices/",
        headers=superuser_token_headers,
        json={
            "client_id": str(db_client.id),
            "risk_note_ids": [str(rn1.id), str(rn2.id)],
            "notes": "Consolidated monthly invoice",
        },
    )
    assert response.status_code == 200
    content = response.json()
    assert content["client_id"] == str(db_client.id)
    assert Decimal(content["total_amount"]) == Decimal("3500.50")
    assert Decimal(content["balance_due"]) == Decimal("3500.50")
    assert content["notes"] == "Consolidated monthly invoice"

    line_items = db.exec(
        select(InvoiceLineItem).where(
            InvoiceLineItem.invoice_id == uuid.UUID(content["id"])
        )
    ).all()
    assert len(line_items) == 2
    assert {li.risk_note_id for li in line_items} == {rn1.id, rn2.id}



def test_create_invoice_missing_client_returns_404(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/financials/invoices/",
        headers=superuser_token_headers,
        json={
            "invoice_number": f"INV-{uuid.uuid4().hex[:8].upper()}",
            "client_id": str(uuid.uuid4()),
            "total_amount": "1000.00",
            "balance_due": "1000.00",
            "status": "Unpaid",
        },
    )
    assert response.status_code == 404


def test_create_invoice_duplicate_number_returns_422(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    inv_num = f"INV-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "invoice_number": inv_num,
        "client_id": str(db_client.id),
        "total_amount": "1000.00",
        "balance_due": "1000.00",
        "status": "Unpaid",
    }
    first = client.post(
        f"{settings.API_V1_STR}/financials/invoices/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert first.status_code == 200

    dup = client.post(
        f"{settings.API_V1_STR}/financials/invoices/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert dup.status_code == 422


def test_read_invoice_by_id_and_missing_returns_404(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    inv = create_random_invoice(db)
    ok = client.get(
        f"{settings.API_V1_STR}/financials/invoices/{inv.id}",
        headers=superuser_token_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["id"] == str(inv.id)

    missing = client.get(
        f"{settings.API_V1_STR}/financials/invoices/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert missing.status_code == 404


def test_read_financial_summary(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    inv = create_random_invoice(db)
    resp_global = client.get(
        f"{settings.API_V1_STR}/financials/summary",
        headers=superuser_token_headers,
    )
    assert resp_global.status_code == 200
    body_global = resp_global.json()
    assert set(body_global.keys()) == {
        "total_invoiced",
        "total_paid",
        "total_due",
        "total_unallocated",
    }

    resp_client = client.get(
        f"{settings.API_V1_STR}/financials/summary?client_id={inv.client_id}",
        headers=superuser_token_headers,
    )
    assert resp_client.status_code == 200
    body_client = resp_client.json()
    assert float(body_client["total_invoiced"]) >= float(inv.total_amount)
    assert float(body_client["total_due"]) >= float(inv.balance_due)

