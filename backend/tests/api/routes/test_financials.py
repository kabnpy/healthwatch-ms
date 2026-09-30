import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.client import create_random_client
from tests.utils.insurance import (
    create_random_invoice,
    create_random_receipt,
)
from tests.utils.utils import random_lower_string


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


def test_read_receipts(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    create_random_receipt(db)
    response = client.get(
        f"{settings.API_V1_STR}/financials/receipts/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert len(content["data"]) >= 1


def test_create_receipt(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    data = {
        "receipt_number": random_lower_string(),
        "client_id": str(db_client.id),
        "date_received": "2024-01-01",
        "amount": 500.0,
        "mode": "Cheque",
        "reference": "CHQ999",
    }
    response = client.post(
        f"{settings.API_V1_STR}/financials/receipts/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["receipt_number"] == data["receipt_number"]
    assert Decimal(content["amount"]) == Decimal("500.0")


def test_allocate_receipt(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    invoice = create_random_invoice(db)
    receipt = create_random_receipt(db, client_id=invoice.client_id)
    data = {
        "receipt_id": str(receipt.id),
        "invoice_id": str(invoice.id),
        "amount_allocated": 500.0,
    }
    response = client.post(
        f"{settings.API_V1_STR}/financials/receipts/{receipt.id}/allocations",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["message"] == "Allocation successful"
