import uuid

from app.models import DocumentEntityType, DocumentJobResourceType
from app.services.document_renderer import DocumentRenderer


class StubPdfRasterizer:
    def render(self, html_content: str) -> bytes:
        assert "Acme Logistics Ltd" in html_content
        return b"%PDF-1.4 pure-stub\n%%EOF\n"


def test_render_html_risk_note_pure_in_process() -> None:
    risk_note_id = uuid.uuid4()
    snapshot = {
        "found": True,
        "entity_type": DocumentEntityType.POLICY.value,
        "entity_id": str(risk_note_id),
        "filename": "RiskNote_RN-001.pdf",
        "risk_note": {
            "id": str(risk_note_id),
            "risk_note_number": "RN-001",
            "transaction_type": "New Business",
            "status": "Issued",
            "sum_insured": "1500000.00",
            "basic_premium": "45000.00",
            "total_amount": "45225.00",
        },
        "policy": {"policy_number": "POL-001"},
        "client": {"name": "Acme Logistics Ltd", "kra_pin": "P051234567X"},
        "product": {"name": "Motor Private", "class_of_business": "Motor Private"},
        "insurer": {"name": "Jubilee Insurance"},
        "vehicle": {"registration_number": "KAA 123A", "make": "Toyota", "model": "Corolla"},
        "vehicles": [],
        "taxes": {"itl": "90.00", "pcf": "112.50", "stamp_duty": "40.00"},
        "benefits": [],
        "special_conditions": None,
        "coverage_start_formatted": "01 January 2026",
        "coverage_end_formatted": "31 December 2026",
        "stamp_date": "01 January 2026",
        "include_digital_stamp": True,
    }

    rendered = DocumentRenderer.render_html(
        snapshot,
        resource_type=DocumentJobResourceType.RISK_NOTE,
    )

    assert "Acme Logistics Ltd" in rendered.html
    assert "RN-001" in rendered.html
    assert rendered.filename == "RiskNote_RN-001.pdf"
    assert rendered.entity_type == DocumentEntityType.POLICY
    assert rendered.entity_id == risk_note_id


def test_render_pdf_pure_in_process_with_stub_rasterizer() -> None:
    snapshot = {
        "found": True,
        "entity_type": DocumentEntityType.CLIENT.value,
        "entity_id": str(uuid.uuid4()),
        "filename": "Statement_Acme.pdf",
        "client_name": "Acme Logistics Ltd",
        "kra_pin": "P051234567X",
        "total_invoiced": "15000.00",
        "total_allocated": "5000.00",
        "net_outstanding_balance": "10000.00",
        "entries": [],
    }

    rendered = DocumentRenderer.render_pdf(
        snapshot,
        resource_type=DocumentJobResourceType.STATEMENT,
        rasterizer=StubPdfRasterizer(),
    )

    assert rendered.pdf_bytes == b"%PDF-1.4 pure-stub\n%%EOF\n"
    assert rendered.filename == "Statement_Acme.pdf"
    assert rendered.entity_type == DocumentEntityType.CLIENT


def test_render_html_invoice_pure_in_process() -> None:
    client_id = uuid.uuid4()
    invoice_id = uuid.uuid4()
    snapshot = {
        "found": True,
        "entity_type": DocumentEntityType.CLIENT.value,
        "entity_id": str(client_id),
        "filename": "Invoice_INV-042.pdf",
        "invoice": {
            "id": str(invoice_id),
            "invoice_number": "INV-042",
            "client_id": str(client_id),
            "total_amount": "42000.00",
            "balance_due": "42000.00",
            "status": "Unpaid",
        },
        "client": {"name": "Nairobi Holdings", "kra_pin": "P051112223A"},
        "policy": None,
        "invoice_date_formatted": "01 February 2026",
        "due_date_formatted": "03 March 2026",
    }

    rendered = DocumentRenderer.render_html(
        snapshot,
        resource_type=DocumentJobResourceType.INVOICE,
    )

    assert "Nairobi Holdings" in rendered.html
    assert "INV-042" in rendered.html
    assert rendered.filename == "Invoice_INV-042.pdf"
    assert rendered.entity_type == DocumentEntityType.CLIENT
    assert rendered.entity_id == client_id


def test_render_html_fallback_resource_pure_in_process() -> None:
    entity_id = uuid.uuid4()
    snapshot = {
        "found": True,
        "entity_type": DocumentEntityType.CLIENT.value,
        "entity_id": str(entity_id),
        "filename": "Invitation_001.pdf",
    }

    rendered = DocumentRenderer.render_html(
        snapshot,
        resource_type=DocumentJobResourceType.INVITATION,
    )

    assert "Document invitation" in rendered.html
    assert rendered.filename == "Invitation_001.pdf"
    assert rendered.entity_type == DocumentEntityType.CLIENT
    assert rendered.entity_id == entity_id
