from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Client,
    DocumentEntityType,
    DocumentJobResourceType,
    Insurer,
    Invoice,
    InvoiceStatus,
    Policy,
    PolicyStatus,
    Product,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)
from app.services.document_renderer import DocumentRenderer, RenderedDocument


def test_render_statement_with_snapshot_override(db: Session) -> None:
    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.STATEMENT, resource_id=None, snapshot_override={
            "client_name": "Acme Logistics Ltd",
            "kra_pin": "P051234567X",
            "total_invoiced": "15000.00",
            "total_allocated": "5000.00",
            "net_outstanding_balance": "10000.00",
            "invoice_count": 2,
            "allocation_count": 1,
        })
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.STATEMENT)

    assert isinstance(result, RenderedDocument)
    assert "Acme Logistics Ltd" in result.html
    assert "P051234567X" in result.html
    assert "10000.00" in result.html or "10,000.00" in result.html
    assert result.entity_type == DocumentEntityType.CLIENT
    assert result.filename.startswith("Statement_Acme_Logistics_Ltd_")
    assert result.fallback_title == "Statement - Acme Logistics Ltd"


def test_render_risk_note_from_db_with_snapshot_override(db: Session) -> None:
    client_rec = Client(
        name="Safari Traders",
        email="safari@example.com",
        phone="0700111222",
        kra_pin="P059998887Z",
    )
    db.add(client_rec)
    db.flush()

    insurer = Insurer(name="Jubilee Insurance")
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name="Motor Private",
        class_of_insurance="Motor",
    )
    db.add(product)
    db.flush()

    policy = Policy(
        policy_number="POL-RN-001",
        client_id=client_rec.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date(2026, 1, 1),
    )
    db.add(policy)
    db.flush()

    risk_note = RiskNote(
        risk_note_number="RN-2026-001",
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ACTIVE,
        coverage_start=date(2026, 1, 1),
        coverage_end=date(2026, 12, 31),
        net_premium=Decimal("25000.00"),
        total_amount=Decimal("25150.00"),
        cover_snapshot={"vehicle": {"registration": "KAA 123A"}},
        financial_breakdown={"taxes": {"training_levy": "50.00"}, "benefits": []},
    )
    db.add(risk_note)
    db.commit()

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.RISK_NOTE, resource_id=risk_note.id, snapshot_override={"special_conditions": "Excess 2.5% of sum insured"})
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.RISK_NOTE)

    assert "RN-2026-001" in result.html
    assert "Safari Traders" in result.html
    assert "Excess 2.5% of sum insured" in result.html
    assert result.entity_type == DocumentEntityType.RISK_NOTE
    assert result.entity_id == risk_note.id
    assert result.filename == "RiskNote_RN-2026-001.pdf"


def test_render_invoice_from_db(db: Session) -> None:
    client_rec = Client(
        name="Nairobi Holdings",
        email="nairobi@example.com",
        phone="0711222333",
        kra_pin="P051112223A",
    )
    db.add(client_rec)
    db.flush()

    invoice = Invoice(
        invoice_number="INV-2026-042",
        client_id=client_rec.id,
        date_issued=date(2026, 2, 1),
        due_date=date(2026, 2, 1) + timedelta(days=30),
        total_amount=Decimal("42000.00"),
        balance_due=Decimal("42000.00"),
        status=InvoiceStatus.UNPAID,
    )
    db.add(invoice)
    db.commit()

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.INVOICE, resource_id=invoice.id)
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.INVOICE)

    assert "INV-2026-042" in result.html
    assert "Nairobi Holdings" in result.html
    assert result.entity_type == DocumentEntityType.CLIENT
    assert result.entity_id == client_rec.id
    assert result.filename == "Invoice_INV-2026-042.pdf"


def test_render_invoice_omits_duplicate_agency_row_and_renders_balance_due_and_remittance(
    db: Session,
) -> None:
    client_rec = Client(
        name="Savannah Logistics Ltd",
        email="finance@savannah.co.ke",
        phone="0722000111",
        kra_pin="P051999888B",
    )
    db.add(client_rec)
    db.flush()

    invoice = Invoice(
        invoice_number="INV-2026-104",
        client_id=client_rec.id,
        date_issued=date(2026, 3, 10),
        due_date=date(2026, 4, 9),
        total_amount=Decimal("125000.00"),
        amount_paid=Decimal("25000.00"),
        balance_due=Decimal("100000.00"),
        status=InvoiceStatus.PARTIAL,
    )
    db.add(invoice)
    db.commit()

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.INVOICE, resource_id=invoice.id)
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.INVOICE)

    assert '<span class="kv-label">Agency</span>' not in result.html
    assert "Balance Due" in result.html
    assert "125,000.00" in result.html
    assert "25,000.00" in result.html
    assert "100,000.00" in result.html
    assert "522522" in result.html
    assert "NCBA Bank Kenya" in result.html
    assert "1002345678" in result.html
    assert "NCBAKENA" in result.html
    assert "Quote invoice number <strong>INV-2026-104</strong>" in result.html


def test_render_fallback_resource_type(db: Session) -> None:
    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.INVITATION, resource_id=None)
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.INVITATION)

    assert "INVITATION" in result.html or "invitation" in result.html
    assert result.fallback_title == "Document invitation"


def test_preview_html_endpoints_use_document_renderer(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    get_resp = client.get(
        f"{settings.API_V1_STR}/document-jobs/preview/html",
        params={"resource_type": DocumentJobResourceType.INVITATION.value},
        headers=superuser_token_headers,
    )
    assert get_resp.status_code == 200
    assert "invitation" in get_resp.text

    post_resp = client.post(
        f"{settings.API_V1_STR}/document-jobs/preview/html",
        json={
            "resource_type": DocumentJobResourceType.STATEMENT.value,
            "snapshot_data": {
                "client_name": "Preview Draft Client",
                "net_outstanding_balance": "7500.00",
            },
        },
        headers=superuser_token_headers,
    )
    assert post_resp.status_code == 200
    assert "Preview Draft Client" in post_resp.text


def test_render_pdf_raises_when_rasterizer_fails(
    db: Session,
    monkeypatch,
) -> None:
    import pytest

    class FailingRasterizer:
        def render(self, html_content: str) -> bytes:
            raise RuntimeError("Playwright crashed")

    monkeypatch.setattr(DocumentRenderer, "pdf_rasterizer", FailingRasterizer())

    with pytest.raises(RuntimeError, match="Playwright crashed"):
        snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.STATEMENT, resource_id=None, snapshot_override={
                "client_name": "Failing PDF Client",
                "net_outstanding_balance": "1200.00",
            })
        DocumentRenderer.render_pdf(snapshot, resource_type=DocumentJobResourceType.STATEMENT)


def test_render_pdf_raises_on_invalid_pdf_output(
    db: Session,
    monkeypatch,
) -> None:
    import pytest

    class InvalidOutputRasterizer:
        def render(self, html_content: str) -> bytes:
            return b"not-a-pdf"

    monkeypatch.setattr(DocumentRenderer, "pdf_rasterizer", InvalidOutputRasterizer())

    with pytest.raises(ValueError, match="Invalid PDF"):
        snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.STATEMENT, resource_id=None)
        DocumentRenderer.render_pdf(snapshot, resource_type=DocumentJobResourceType.STATEMENT)


def test_render_pdf_uses_playwright_when_available(
    db: Session,
    monkeypatch,
    tmp_path,
) -> None:
    fake_script = tmp_path / "render_pdf.ts"
    fake_script.write_text("// fake")
    monkeypatch.setattr(
        "app.services.document_renderer.FRONTEND_RENDER_SCRIPT", fake_script
    )
    monkeypatch.setattr(
        "app.services.document_renderer.shutil.which", lambda _: "/usr/bin/bun"
    )

    def fake_subprocess_run(cmd, **_kwargs):
        out_idx = cmd.index("--output") + 1
        with open(cmd[out_idx], "wb") as f:
            f.write(b"%PDF-1.4 playwright-output\n%%EOF\n")

        class _Result:
            returncode = 0
            stderr = ""

        return _Result()

    monkeypatch.setattr(
        "app.services.document_renderer.subprocess.run", fake_subprocess_run
    )

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.INVITATION, resource_id=None)
    result = DocumentRenderer.render_pdf(snapshot, resource_type=DocumentJobResourceType.INVITATION)

    assert result.pdf_bytes == b"%PDF-1.4 playwright-output\n%%EOF\n"


def test_document_job_service_process_job_uses_document_renderer_and_uploads_pdf(
    db: Session,
    monkeypatch,
) -> None:
    from app.models import Document, DocumentJobStatus
    from app.services.document_job import DocumentJobService

    class StubPdfRasterizer:
        def render(self, html_content: str) -> bytes:
            assert "Job Pipeline Client" in html_content
            return b"%PDF-1.4 stub-pdf\n%%EOF\n"

    monkeypatch.setattr(DocumentRenderer, "pdf_rasterizer", StubPdfRasterizer())

    render_calls: list[dict] = []
    original_render_pdf = DocumentRenderer.render_pdf

    def spy_render_pdf(*args, **kwargs):
        render_calls.append({"args": args, "kwargs": kwargs})
        return original_render_pdf(*args, **kwargs)

    monkeypatch.setattr(DocumentRenderer, "render_pdf", spy_render_pdf)

    uploaded_payloads: list[tuple[bytes, str, str]] = []

    def fake_save_file(file, filename: str, folder: str = "") -> str:
        uploaded_payloads.append((file.read(), filename, folder))
        return f"{folder}/{filename}"

    monkeypatch.setattr("app.services.document.storage.save_file", fake_save_file)

    job = DocumentJobService.enqueue_job(
        session=db,
        resource_type=DocumentJobResourceType.STATEMENT,
        snapshot_data={"client_name": "Job Pipeline Client"},
    )
    processed = DocumentJobService.process_job(session=db, job_id=job.id)

    assert processed.status == DocumentJobStatus.SUCCEEDED
    assert len(render_calls) == 1
    assert len(uploaded_payloads) == 1
    pdf_bytes, filename, folder = uploaded_payloads[0]
    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert filename.startswith("Statement_Job_Pipeline_Client_")
    assert folder == "documents/statement"

    import uuid

    doc_id = uuid.UUID(processed.snapshot_data["document_id"])
    doc = db.get(Document, doc_id)
    assert doc is not None
    assert doc.mime_type == "application/pdf"


def test_legacy_pdf_renderer_and_6_tuple_method_removed() -> None:
    import importlib

    import pytest

    from app.services.document_job import DocumentJobService

    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.services.pdf_renderer")

    assert not hasattr(DocumentJobService, "render_resource_html")


def test_render_statement_surfaces_unapplied_funds_when_positive_and_omits_when_zero(
    db: Session,
) -> None:
    from app.models import PaymentMethod, PaymentRecord, PaymentStatus

    client_rec = Client(
        name="Savannah Imports Ltd",
        email="savannah@example.com",
        phone="0722334455",
        kra_pin="P058887776B",
    )
    db.add(client_rec)
    db.flush()

    payment = PaymentRecord(
        client_id=client_rec.id,
        amount=Decimal("12500.00"),
        unallocated_amount=Decimal("4500.00"),
        payment_date=date(2026, 4, 10),
        payment_method=PaymentMethod.MPESA,
        reference_number="MPESA-SAV-1",
        status=PaymentStatus.ACTIVE,
    )
    db.add(payment)
    db.commit()

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.STATEMENT, resource_id=client_rec.id)
    db_result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.STATEMENT)
    assert "Unapplied Funds" in db_result.html
    assert "4,500.00" in db_result.html

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.STATEMENT, resource_id=None, snapshot_override={
            "client_name": "Zero Unapplied Client",
            "unallocated_credits": "0.00",
        })
    zero_result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.STATEMENT)
    assert "Unapplied Funds" not in zero_result.html


def test_render_statement_mpesa_invoice_number_ledger_activity_and_date_fallback(
    db: Session,
) -> None:
    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.STATEMENT, resource_id=None, snapshot_override={
            "client_name": "Rift Valley Builders",
            "kra_pin": "P051119998C",
            "total_invoiced": "50000.00",
            "total_allocated": "20000.00",
            "net_outstanding_balance": "30000.00",
            "invoice_count": 2,
            "allocation_count": 1,
        })
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.STATEMENT)

    assert "Ledger Activity" in result.html
    assert "2 Invoices, 1 Payments" in result.html
    assert "Invoice Number" in result.html
    assert "Account: <span class=\"kv-val mono bold\">Rift Valley Builders</span>" not in result.html
    assert "18 October 2026" not in result.html

    no_date_html = DocumentRenderer.render_template_html(
        "statement.html",
        {
            "statement": {
                "client_name": "No Date Client",
                "total_invoiced": "0.00",
                "total_allocated": "0.00",
                "net_outstanding_balance": "0.00",
                "invoice_count": 0,
                "allocation_count": 0,
                "ledger_entries": [],
            }
        },
    )
    assert "18 October 2026" not in no_date_html
    assert 'Statement Date: <span class="doc-ref-number">—</span>' in no_date_html


def test_render_risk_note_indents_included_benefits_beneath_net_base_premium(
    db: Session,
) -> None:
    client_rec = Client(
        name="Savannah Fleet Ltd",
        email="fleet@example.com",
        phone="0700333444",
        kra_pin="P051112224B",
    )
    db.add(client_rec)
    db.flush()

    insurer = Insurer(name="Britam General Insurance")
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name="Motor Commercial",
        class_of_insurance="Motor",
    )
    db.add(product)
    db.flush()

    policy = Policy(
        policy_number="POL-RN-BEN-001",
        client_id=client_rec.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date(2026, 3, 1),
    )
    db.add(policy)
    db.flush()

    risk_note = RiskNote(
        risk_note_number="RN-2026-BEN-001",
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ACTIVE,
        coverage_start=date(2026, 3, 1),
        coverage_end=date(2027, 2, 28),
        net_premium=Decimal("50000.00"),
        total_amount=Decimal("50265.00"),
        cover_snapshot={"vehicle": {"registration": "KCB 456C"}},
        financial_breakdown={
            "taxes": {
                "training_levy": "100.00",
                "pcf": "125.00",
                "stamp_duty": "40.00",
            },
            "benefits": [
                {"name": "Political Violence & Terrorism", "premium": "5000.00"},
                {"name": "Excess Protector", "premium": "3500.00"},
            ],
        },
    )
    db.add(risk_note)
    db.commit()

    snapshot = DocumentRenderer.build_snapshot(session=db, resource_type=DocumentJobResourceType.RISK_NOTE, resource_id=risk_note.id)
    result = DocumentRenderer.render_html(snapshot, resource_type=DocumentJobResourceType.RISK_NOTE)

    assert "Net Base Premium" in result.html
    assert "Political Violence &amp; Terrorism" in result.html
    assert "(Included)" in result.html
    assert "benefit-subrow" in result.html


def test_render_risk_note_compact_certification_and_pending_issue_fallback() -> None:
    issued_html = DocumentRenderer.render_template_html(
        "risk_note.html",
        {
            "risk_note": {
                "risk_note_number": "RN-2026-CERT-001",
                "status": "Issued",
                "transaction_type": "new_business",
                "net_premium": "25000.00",
                "total_amount": "25150.00",
            },
            "policy": {"policy_number": "POL-CERT-001"},
            "client": {"name": "Mombasa Logistics Ltd", "kra_pin": "P051234567M"},
            "product": {"name": "Motor Private"},
            "insurer": {"name": "Jubilee Insurance"},
            "vehicles": [],
            "vehicle": None,
            "taxes": {},
            "benefits": [],
            "special_conditions": None,
            "coverage_start_formatted": "01 January 2026",
            "coverage_end_formatted": "31 December 2026",
            "stamp_date": None,
            "generated_at": None,
            "include_digital_stamp": True,
        },
    )

    assert "CERTIFIED OFFICIAL" in issued_html
    assert "Digitally Authenticated — Agency Operations" in issued_html
    assert 'viewBox="0 0 200 100"' not in issued_html
    assert "Pending Issue" in issued_html
    assert "18 October 2026" not in issued_html

    draft_html = DocumentRenderer.render_template_html(
        "risk_note.html",
        {
            "risk_note": {
                "risk_note_number": "DRAFT",
                "status": "Draft",
                "transaction_type": "new_business",
                "net_premium": "25000.00",
                "total_amount": "25150.00",
            },
            "policy": {"policy_number": "POL-DRAFT-001"},
            "client": {"name": "Mombasa Logistics Ltd", "kra_pin": "P051234567M"},
            "product": {"name": "Motor Private"},
            "insurer": {"name": "Jubilee Insurance"},
            "vehicles": [],
            "vehicle": None,
            "taxes": {},
            "benefits": [],
            "special_conditions": None,
            "coverage_start_formatted": "01 January 2026",
            "coverage_end_formatted": "31 December 2026",
            "stamp_date": None,
            "generated_at": None,
            "include_digital_stamp": True,
        },
    )

    assert "CERTIFIED OFFICIAL" not in draft_html
    assert "Digitally Authenticated — Agency Operations" not in draft_html
