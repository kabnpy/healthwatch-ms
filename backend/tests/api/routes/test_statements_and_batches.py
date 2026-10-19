import uuid
from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Client,
    DocumentJobResourceType,
    DocumentJobStatus,
    Invoice,
    PaymentAllocation,
    PaymentMethod,
    PaymentRecord,
    Policy,
    PolicyStatus,
)


def test_client_statement_reconciliation(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = Client(
        name="Horizon Holdings",
        email="accounts@horizon.co.ke",
        phone="+254744000333",
        kra_pin="P054455667D",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy = Policy(
        policy_number="POL-HH-01", client_id=client_obj.id, status=PolicyStatus.ACTIVE
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    inv1 = Invoice(
        client_id=client_obj.id,
        invoice_number="INV-HH-01",
        total_amount=Decimal("50000.00"),
        balance_due=Decimal("50000.00"),
        date_issued=date(2026, 10, 1),
    )
    db.add(inv1)

    inv2 = Invoice(
        client_id=client_obj.id,
        invoice_number="INV-HH-02",
        total_amount=Decimal("30000.00"),
        balance_due=Decimal("30000.00"),
        date_issued=date(2026, 10, 15),
    )
    db.add(inv2)
    db.commit()
    db.refresh(inv1)
    db.refresh(inv2)

    # Cleared Payment Record: 60,000
    payment = PaymentRecord(
        client_id=client_obj.id,
        amount=Decimal("60000.00"),
        unallocated_amount=Decimal("10000.00"),
        reference_number="MPESA-HH-99",
        payment_method=PaymentMethod.MPESA.value,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Allocation of 50,000 to inv1
    alloc = PaymentAllocation(
        payment_record_id=payment.id,
        invoice_id=inv1.id,
        amount=Decimal("50000.00"),
    )
    db.add(alloc)
    db.commit()

    # 2. Query Client Statement
    # Total Invoiced = 50,000 + 30,000 = 80,000
    # Total Allocated = 50,000
    # Net Outstanding = 30,000
    stmt_resp = client.get(
        f"{settings.API_V1_STR}/statements/client/{client_obj.id}",
        headers=superuser_token_headers,
    )
    assert stmt_resp.status_code == 200
    stmt = stmt_resp.json()
    assert Decimal(str(stmt["total_invoiced"])) == Decimal("80000.00")
    assert Decimal(str(stmt["total_allocated"])) == Decimal("50000.00")
    assert Decimal(str(stmt["net_outstanding_balance"])) == Decimal("30000.00")
    assert len(stmt["ledger_entries"]) == 3


def test_invoice_batch_monthly_uniqueness(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = Client(
        name="Global Freight",
        email="fin@global.co.ke",
        phone="+254755000444",
        kra_pin="P055566778E",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    # 1. Create batch for "2026-10"
    batch_req = {
        "client_id": str(client_obj.id),
        "billing_month": "2026-10",
    }
    r = client.post(
        f"{settings.API_V1_STR}/invoice-batches/",
        headers=superuser_token_headers,
        json=batch_req,
    )
    assert r.status_code == 201
    batch = r.json()
    assert batch["billing_month"] == "2026-10"

    # 2. Attempt duplicate batch for same client and month -> must fail
    r_dup = client.post(
        f"{settings.API_V1_STR}/invoice-batches/",
        headers=superuser_token_headers,
        json=batch_req,
    )
    assert r_dup.status_code == 400
    assert "already exists" in r_dup.json()["detail"]


def test_document_job_async_contract(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # 1. Enqueue Job -> returns 202 Accepted
    job_req = {
        "resource_type": DocumentJobResourceType.STATEMENT.value,
        "snapshot_data": {"client_id": str(uuid.uuid4())},
    }
    r = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json=job_req,
    )
    assert r.status_code == 202
    job = r.json()
    job_id = job["id"]
    assert job["status"] == DocumentJobStatus.PENDING.value

    # 2. Poll status
    r_poll = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_poll.status_code == 200

    # 3. Process Job -> triggers execution
    r_proc = client.post(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/process",
        headers=superuser_token_headers,
    )
    assert r_proc.status_code == 200
    processed = r_proc.json()
    assert processed["status"] == DocumentJobStatus.SUCCEEDED.value
    assert "pdf" in processed["snapshot_data"]["generated_storage_key"]
