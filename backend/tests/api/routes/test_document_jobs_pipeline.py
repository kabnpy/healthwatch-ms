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
    InvoiceStatus,
    Policy,
    PolicyStatus,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)


def test_document_job_risk_note_pipeline(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Create client, policy, and risk note
    uid = uuid.uuid4().hex[:8].upper()
    client_obj = Client(
        name=f"Safari Logistics {uid}",
        email=f"ops_{uid.lower()}@safari.co.ke",
        phone="+254700112233",
        kra_pin=f"P05{uid}",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy = Policy(
        policy_number=f"POL-SAFARI-{uid}",
        client_id=client_obj.id,
        status=PolicyStatus.ACTIVE,
        start_date=date.today(),
        end_date=date.today(),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    risk_note = RiskNote(
        policy_id=policy.id,
        risk_note_number=f"RN-SAFARI-{uid}",
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("113046.25"),
        total_amount=Decimal("113046.25"),
        cover_snapshot={
            "vehicle": {
                "registration_number": f"KD{uid[:2]} {uid[2:5]}X",
                "make": "Toyota",
                "model": "Prado",
                "year_of_manufacture": 2022,
                "body_type": "Station Wagon",
                "chassis_number": f"JTEBX{uid}",
            }
        },
    )
    db.add(risk_note)
    db.commit()
    db.refresh(risk_note)

    # 2. Enqueue document job for Risk Note
    req = {
        "resource_type": DocumentJobResourceType.RISK_NOTE.value,
        "resource_id": str(risk_note.id),
        "snapshot_data": {"include_digital_stamp": True},
    }
    r = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json=req,
    )
    assert r.status_code == 202
    job_data = r.json()
    job_id = job_data["id"]
    assert job_data["status"] == DocumentJobStatus.PENDING.value

    # 3. Process the job
    r_proc = client.post(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/process",
        headers=superuser_token_headers,
    )
    assert r_proc.status_code == 200
    processed = r_proc.json()
    assert processed["status"] == DocumentJobStatus.SUCCEEDED.value
    assert processed["snapshot_data"]["filename"].endswith(".pdf")
    assert "document_id" in processed["snapshot_data"]

    # 4. Download generated PDF
    r_down = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/download",
        headers=superuser_token_headers,
    )
    assert r_down.status_code == 200
    assert r_down.headers["content-type"] == "application/pdf"
    assert len(r_down.content) > 100
    assert r_down.content.startswith(b"%PDF-")


def test_document_job_invoice_pipeline(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Create client and invoice
    uid = uuid.uuid4().hex[:8].upper()
    client_obj = Client(
        name=f"Serengeti Traders {uid}",
        email=f"finance_{uid.lower()}@serengeti.co.ke",
        phone="+254711223344",
        kra_pin=f"P05{uid}",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    invoice = Invoice(
        invoice_number=f"INV-SRG-{uid}",
        client_id=client_obj.id,
        date_issued=date.today(),
        due_date=date.today(),
        status=InvoiceStatus.UNPAID,
        total_amount=Decimal("85000.00"),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # 2. Enqueue and process
    req = {
        "resource_type": DocumentJobResourceType.INVOICE.value,
        "resource_id": str(invoice.id),
    }
    r = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json=req,
    )
    assert r.status_code == 202
    job_id = r.json()["id"]

    r_proc = client.post(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/process",
        headers=superuser_token_headers,
    )
    assert r_proc.status_code == 200
    assert r_proc.json()["status"] == DocumentJobStatus.SUCCEEDED.value

    # 3. Download
    r_down = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/download",
        headers=superuser_token_headers,
    )
    assert r_down.status_code == 200
    assert r_down.headers["content-type"] == "application/pdf"
    assert len(r_down.content) > 100


def test_document_job_statement_pipeline(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    uid = uuid.uuid4().hex[:8].upper()
    client_obj = Client(
        name=f"Kilimanjaro Logistics {uid}",
        email=f"billing_{uid.lower()}@kili.co.ke",
        phone="+254799887766",
        kra_pin=f"P05{uid}",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    req = {
        "resource_type": DocumentJobResourceType.STATEMENT.value,
        "resource_id": str(client_obj.id),
    }
    r = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json=req,
    )
    assert r.status_code == 202
    job_id = r.json()["id"]

    r_proc = client.post(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/process",
        headers=superuser_token_headers,
    )
    assert r_proc.status_code == 200
    assert r_proc.json()["status"] == DocumentJobStatus.SUCCEEDED.value

    r_down = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/download",
        headers=superuser_token_headers,
    )
    assert r_down.status_code == 200
    assert r_down.headers["content-type"] == "application/pdf"


def test_document_job_download_errors(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # 1. Non-existent job
    r_404 = client.get(
        f"{settings.API_V1_STR}/document-jobs/{uuid.uuid4()}/download",
        headers=superuser_token_headers,
    )
    assert r_404.status_code == 404

    # 2. Pending job (not yet processed)
    r_enq = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json={"resource_type": DocumentJobResourceType.STATEMENT.value},
    )
    job_id = r_enq.json()["id"]

    r_400 = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/download",
        headers=superuser_token_headers,
    )
    assert r_400.status_code == 400
    assert "not ready" in r_400.json()["detail"]
