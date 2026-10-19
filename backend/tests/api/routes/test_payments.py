from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import InvoiceCreate, InvoiceStatus
from tests.utils.client import create_random_client


def test_record_payment_and_validation(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = create_random_client(db)

    # 1. Successful payment record
    payload = {
        "client_id": str(client_obj.id),
        "amount": "100000.00",
        "payment_date": str(date.today()),
        "payment_method": "mpesa",
        "reference_number": "MPESA123456",
        "payer_name": "Jane Doe",
    }
    response = client.post(
        f"{settings.API_V1_STR}/payment-records/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "100000.00"
    assert data["unallocated_amount"] == "100000.00"
    assert data["status"] == "active"
    assert data["payment_method"] == "mpesa"

    # 2. Zero amount rejected
    bad_payload = dict(payload, amount="0.00")
    bad_res = client.post(
        f"{settings.API_V1_STR}/payment-records/",
        headers=superuser_token_headers,
        json=bad_payload,
    )
    assert bad_res.status_code == 400


def test_payment_allocation_ledger_invariants(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = create_random_client(db)

    # Create Invoice for 60,000.00
    inv = crud.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number="INV-TEST-001",
            client_id=client_obj.id,
            date_issued=date.today(),
            total_amount=Decimal("60000.00"),
            balance_due=Decimal("60000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )

    # Record payment of 50,000.00
    pmt_res = client.post(
        f"{settings.API_V1_STR}/payment-records/",
        headers=superuser_token_headers,
        json={
            "client_id": str(client_obj.id),
            "amount": "50000.00",
            "payment_method": "bank_transfer",
            "reference_number": "BNK-7788",
        },
    )
    pmt_id = pmt_res.json()["id"]

    # Allocate 30,000.00
    alloc1_res = client.post(
        f"{settings.API_V1_STR}/payment-records/{pmt_id}/allocations",
        headers=superuser_token_headers,
        json={
            "payment_record_id": pmt_id,
            "invoice_id": str(inv.id),
            "amount": "30000.00",
        },
    )
    assert alloc1_res.status_code == 201

    # Verify payment record unallocated reduced to 20,000.00
    pmt_check = client.get(
        f"{settings.API_V1_STR}/payment-records/{pmt_id}",
        headers=superuser_token_headers,
    )
    assert pmt_check.json()["unallocated_amount"] == "20000.00"

    # Verify invoice balance reduced to 30,000.00 and status Partial
    inv_check = client.get(
        f"{settings.API_V1_STR}/financials/invoices/{inv.id}",
        headers=superuser_token_headers,
    )
    assert Decimal(str(inv_check.json()["balance_due"])) == Decimal("30000.00")
    assert inv_check.json()["status"].lower() == "partial"

    # Allocate remaining 20,000.00
    alloc2_res = client.post(
        f"{settings.API_V1_STR}/payment-records/{pmt_id}/allocations",
        headers=superuser_token_headers,
        json={
            "payment_record_id": pmt_id,
            "invoice_id": str(inv.id),
            "amount": "20000.00",
        },
    )
    assert alloc2_res.status_code == 201

    # Now attempt to allocate even 1.00 KES (exceeds 0.00 unallocated)
    over_res = client.post(
        f"{settings.API_V1_STR}/payment-records/{pmt_id}/allocations",
        headers=superuser_token_headers,
        json={
            "payment_record_id": pmt_id,
            "invoice_id": str(inv.id),
            "amount": "1.00",
        },
    )
    assert over_res.status_code == 400
    assert "exceeds unallocated" in over_res.json()["detail"].lower()


def test_reverse_allocation_and_payment_cascade(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = create_random_client(db)

    inv = crud.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number="INV-CASCADE-001",
            client_id=client_obj.id,
            date_issued=date.today(),
            total_amount=Decimal("40000.00"),
            balance_due=Decimal("40000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )

    pmt_res = client.post(
        f"{settings.API_V1_STR}/payment-records/",
        headers=superuser_token_headers,
        json={
            "client_id": str(client_obj.id),
            "amount": "40000.00",
            "payment_method": "cheque",
            "reference_number": "CHQ-001",
        },
    )
    pmt_id = pmt_res.json()["id"]

    alloc_res = client.post(
        f"{settings.API_V1_STR}/payment-records/{pmt_id}/allocations",
        headers=superuser_token_headers,
        json={
            "payment_record_id": pmt_id,
            "invoice_id": str(inv.id),
            "amount": "40000.00",
        },
    )
    alloc_id = alloc_res.json()["id"]

    # Invoice is now Paid
    inv_check = client.get(
        f"{settings.API_V1_STR}/financials/invoices/{inv.id}",
        headers=superuser_token_headers,
    )
    assert inv_check.json()["status"].lower() == "paid"

    # Reverse the entire payment record (e.g. cheque bounced)
    rev_res = client.post(
        f"{settings.API_V1_STR}/payment-records/{pmt_id}/reverse",
        headers=superuser_token_headers,
        json={"reversal_reason": "Cheque bounced due to signature mismatch"},
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "reversed"
    assert rev_res.json()["unallocated_amount"] == "0.00"

    # Verify allocation is now reversed
    alloc_check = client.get(
        f"{settings.API_V1_STR}/payment-allocations/{alloc_id}",
        headers=superuser_token_headers,
    )
    assert alloc_check.json()["status"] == "reversed"
    assert "cascaded" in alloc_check.json()["reversal_reason"].lower()

    # Verify invoice balance is restored to 40,000.00 and status is Unpaid
    inv_restored = client.get(
        f"{settings.API_V1_STR}/financials/invoices/{inv.id}",
        headers=superuser_token_headers,
    )
    assert Decimal(str(inv_restored.json()["balance_due"])) == Decimal("40000.00")
    assert inv_restored.json()["status"].lower() == "unpaid"
