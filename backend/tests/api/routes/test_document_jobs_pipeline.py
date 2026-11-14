import uuid
from datetime import date
from decimal import Decimal

import pytest
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
from app.services.document_renderer import DocumentRenderer


@pytest.fixture(autouse=True)
def stub_pdf_rasterizer(monkeypatch):
    class StubPdfRasterizer:
        def render(self, html_content: str) -> bytes:
            assert html_content
            return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n" + (b"0" * 100) + b"\n%%EOF\n"

    monkeypatch.setattr(DocumentRenderer, "pdf_rasterizer", StubPdfRasterizer())


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

    # 1.5. Test HTML preview endpoint
    r_prev = client.get(
        f"{settings.API_V1_STR}/document-jobs/preview/html?resource_type=risk_note&resource_id={risk_note.id}",
        headers=superuser_token_headers,
    )
    assert r_prev.status_code == 200
    assert "text/html" in r_prev.headers["content-type"]
    assert f"RN-SAFARI-{uid}" in r_prev.text
    assert "CERTIFIED OFFICIAL" in r_prev.text

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

    # 3. BackgroundTasks already processed the job
    r_job = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_job.status_code == 200
    processed = r_job.json()
    assert processed["status"] == DocumentJobStatus.SUCCEEDED.value
    assert processed["document_id"] is not None
    assert processed["snapshot_data"]["_frozen"] is True
    assert processed["snapshot_data"]["include_digital_stamp"] is True

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

    # BackgroundTasks already processed the job
    r_job = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_job.status_code == 200
    assert r_job.json()["status"] == DocumentJobStatus.SUCCEEDED.value

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

    # BackgroundTasks already processed the job
    r_job = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_job.status_code == 200
    assert r_job.json()["status"] == DocumentJobStatus.SUCCEEDED.value

    r_down = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/download",
        headers=superuser_token_headers,
    )
    assert r_down.status_code == 200
    assert r_down.headers["content-type"] == "application/pdf"


def test_document_job_download_errors(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Non-existent job
    r_404 = client.get(
        f"{settings.API_V1_STR}/document-jobs/{uuid.uuid4()}/download",
        headers=superuser_token_headers,
    )
    assert r_404.status_code == 404

    # 2. Pending job (not yet processed)
    from app.services.document_job import DocumentJobService

    pending_job = DocumentJobService.enqueue_job(
        session=db,
        resource_type=DocumentJobResourceType.STATEMENT,
    )
    job_id = str(pending_job.id)

    r_400 = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/download",
        headers=superuser_token_headers,
    )
    assert r_400.status_code == 400
    assert "not ready" in r_400.json()["detail"]


def test_document_job_idempotency_key_deduplication(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    from sqlmodel import select

    from app.models import DocumentJob

    idem_key = f"idem-{uuid.uuid4().hex}"
    payload = {
        "resource_type": DocumentJobResourceType.STATEMENT.value,
        "snapshot_data": {"note": "first"},
    }

    # 1. Enqueue with Idempotency-Key header -> creates PENDING job
    r1 = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers={**superuser_token_headers, "Idempotency-Key": idem_key},
        json=payload,
    )
    assert r1.status_code == 202
    job1 = r1.json()
    assert job1["idempotency_key"] == idem_key
    assert job1["status"] == DocumentJobStatus.PENDING.value

    # 2. Replay with same Idempotency-Key in header -> returns same PENDING job
    r2 = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers={**superuser_token_headers, "Idempotency-Key": idem_key},
        json=payload,
    )
    assert r2.status_code == 202
    assert r2.json()["id"] == job1["id"]

    # 3. Replay with same idempotency_key in request body when PROCESSING -> returns same job
    db_job = db.get(DocumentJob, uuid.UUID(job1["id"]))
    assert db_job is not None
    db_job.status = DocumentJobStatus.PROCESSING
    db.add(db_job)
    db.commit()

    r3 = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json={**payload, "idempotency_key": idem_key},
    )
    assert r3.status_code == 202
    assert r3.json()["id"] == job1["id"]
    assert r3.json()["status"] == DocumentJobStatus.PROCESSING.value

    # 4. Replay when SUCCEEDED -> returns same job, no duplicate rows
    db_job.status = DocumentJobStatus.SUCCEEDED
    db.add(db_job)
    db.commit()

    r4 = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers={**superuser_token_headers, "Idempotency-Key": idem_key},
        json=payload,
    )
    assert r4.status_code == 202
    assert r4.json()["id"] == job1["id"]
    assert r4.json()["status"] == DocumentJobStatus.SUCCEEDED.value

    rows = db.exec(
        select(DocumentJob).where(DocumentJob.idempotency_key == idem_key)
    ).all()
    assert len(rows) == 1
def test_document_job_process_failure_marks_job_failed(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch,
) -> None:
    class FailingPdfRasterizer:
        def render(self, html_content: str) -> bytes:
            raise RuntimeError("Playwright browser launch failed")

    monkeypatch.setattr(DocumentRenderer, "pdf_rasterizer", FailingPdfRasterizer())

    r_enq = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json={"resource_type": DocumentJobResourceType.STATEMENT.value},
    )
    assert r_enq.status_code == 202
    job_id = r_enq.json()["id"]

    # BackgroundTasks ran and marked the job FAILED
    r_job = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_job.status_code == 200
    job_data = r_job.json()
    assert job_data["status"] == DocumentJobStatus.FAILED.value
    assert job_data["attempt_count"] == 1
    assert "Playwright browser launch failed" in job_data["error_message"]

    # Staff can retry the FAILED job via /process
    with pytest.raises(RuntimeError, match="Playwright browser launch failed"):
        client.post(
            f"{settings.API_V1_STR}/document-jobs/{job_id}/process",
            headers=superuser_token_headers,
        )


def test_risk_note_snapshot_frozen_at_enqueue_time(
    db: Session,
    monkeypatch,
) -> None:
    from app.services.document_job import DocumentJobService

    captured_html: list[str] = []

    class CapturingPdfRasterizer:
        def render(self, html_content: str) -> bytes:
            captured_html.append(html_content)
            return b"%PDF-1.4\n%%EOF\n"

    monkeypatch.setattr(DocumentRenderer, "pdf_rasterizer", CapturingPdfRasterizer())
    monkeypatch.setattr(
        "app.services.document.storage.save_file",
        lambda file, filename, folder="": f"{folder}/{filename}",
    )

    uid = uuid.uuid4().hex[:8].upper()
    client_obj = Client(
        name=f"Original Client {uid}",
        email=f"orig_{uid.lower()}@example.com",
        phone="+254700000001",
        kra_pin=f"P05{uid}",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy = Policy(
        policy_number=f"POL-ORIG-{uid}",
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
        risk_note_number=f"RN-ORIG-{uid}",
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("50000.00"),
        total_amount=Decimal("50000.00"),
    )
    db.add(risk_note)
    db.commit()
    db.refresh(risk_note)

    job = DocumentJobService.enqueue_job(
        session=db,
        resource_type=DocumentJobResourceType.RISK_NOTE,
        resource_id=risk_note.id,
        snapshot_data={"special_conditions": "Frozen at enqueue"},
    )

    # Mutate source records after enqueue
    risk_note.risk_note_number = f"RN-MUTATED-{uid}"
    client_obj.name = f"Mutated Client {uid}"
    db.add(risk_note)
    db.add(client_obj)
    db.commit()

    processed = DocumentJobService.process_job(session=db, job_id=job.id)
    assert processed.status == DocumentJobStatus.SUCCEEDED
    assert len(captured_html) == 1
    assert f"RN-ORIG-{uid}" in captured_html[0]
    assert f"Original Client {uid}" in captured_html[0]
    assert "Frozen at enqueue" in captured_html[0]
    assert f"RN-MUTATED-{uid}" not in captured_html[0]
    assert f"Mutated Client {uid}" not in captured_html[0]


def test_enqueue_schedules_background_processing_and_process_rejects_succeeded(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "app.services.document.storage.save_file",
        lambda file, filename, folder="": f"{folder}/{filename}",
    )

    r_enq = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json={"resource_type": DocumentJobResourceType.STATEMENT.value},
    )
    assert r_enq.status_code == 202
    job_id = r_enq.json()["id"]

    # BackgroundTasks runs before TestClient returns, so job is already SUCCEEDED
    r_job = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_job.status_code == 200
    assert r_job.json()["status"] == DocumentJobStatus.SUCCEEDED.value

    # Manual /process is strictly for staff retry of FAILED or stuck PENDING jobs
    r_proc = client.post(
        f"{settings.API_V1_STR}/document-jobs/{job_id}/process",
        headers=superuser_token_headers,
    )
    assert r_proc.status_code == 409


def test_delete_document_job_generated_document_returns_409_conflict(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r_enq = client.post(
        f"{settings.API_V1_STR}/document-jobs/",
        headers=superuser_token_headers,
        json={"resource_type": DocumentJobResourceType.STATEMENT.value},
    )
    assert r_enq.status_code == 202
    job_id = r_enq.json()["id"]

    r_job = client.get(
        f"{settings.API_V1_STR}/document-jobs/{job_id}",
        headers=superuser_token_headers,
    )
    assert r_job.status_code == 200
    doc_id = r_job.json()["document_id"]
    assert doc_id is not None

    r_del = client.delete(
        f"{settings.API_V1_STR}/documents/{doc_id}",
        headers=superuser_token_headers,
    )
    assert r_del.status_code == 409
