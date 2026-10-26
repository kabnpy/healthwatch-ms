from pathlib import Path

from app.services.pdf_renderer import PdfRendererService


def test_render_html_risk_note():
    context = {
        "risk_note": {
            "risk_note_number": "RN-TEST-001",
            "status": "FINAL",
            "coverage_start": "2026-01-01",
            "coverage_end": "2026-12-31",
            "sum_insured": "1500000.00",
            "gross_premium": "67500.00",
            "training_levy": "135.00",
            "pcf_levy": "168.75",
            "stamp_duty": "40.00",
            "net_premium": "67843.75",
            "cover_snapshot": {},
        },
        "policy": {
            "policy_number": "POL-2026-001",
        },
        "client": {
            "name": "Jane Mwangi",
            "kra_pin": "A001234567X",
            "email": "jane@example.com",
            "phone": "+254711000000",
        },
        "product": {
            "name": "Motor Comprehensive Private",
        },
        "include_digital_stamp": True,
        "generated_at": "2026-10-26 10:00:00 UTC",
    }
    html = PdfRendererService.render_html("risk_note.html", context)
    assert "RN-TEST-001" in html
    assert "Jane Mwangi" in html
    assert "A001234567X" in html
    assert "HealthWatch" in html


def test_render_html_invoice():
    context = {
        "invoice": {
            "invoice_number": "INV-2026-001",
            "date_issued": "2026-01-01",
            "due_date": "2026-01-31",
            "status": "ISSUED",
            "currency": "KES",
            "total_amount": "67843.75",
            "line_items": [
                {
                    "description": "Annual Premium",
                    "gross_amount": "67500.00",
                    "training_levy": "135.00",
                    "pcf_levy": "168.75",
                    "stamp_duty": "40.00",
                    "total_amount": "67843.75",
                }
            ],
        },
        "client": {
            "name": "John Doe",
            "kra_pin": "P051234567Z",
        },
        "policy": {
            "policy_number": "POL-TEST-001",
        },
        "generated_at": "2026-10-26 10:00:00 UTC",
    }
    html = PdfRendererService.render_html("invoice.html", context)
    assert "INV-2026-001" in html
    assert "John Doe" in html
    assert "67,843.75" in html


def test_render_html_statement():
    context = {
        "statement": {
            "client_name": "Atlas Logistics Ltd",
            "client_id": "c1111111-2222-3333-4444-555555555555",
            "kra_pin": "P051999999Z",
            "total_invoiced": "200000.00",
            "total_allocated": "150000.00",
            "net_outstanding_balance": "50000.00",
            "invoice_count": 2,
            "allocation_count": 1,
            "ledger_entries": [
                {
                    "date": "2026-01-10",
                    "type": "INVOICE",
                    "reference": "INV-001",
                    "description": "Initial premium",
                    "debit": "200000.00",
                    "credit": "0.00",
                },
                {
                    "date": "2026-01-15",
                    "type": "PAYMENT",
                    "reference": "PAY-001",
                    "description": "Bank wire part payment",
                    "debit": "0.00",
                    "credit": "150000.00",
                },
            ],
        },
        "generated_at": "2026-10-26 10:00:00 UTC",
    }
    html = PdfRendererService.render_html("statement.html", context)
    assert "Atlas Logistics Ltd" in html
    assert "Statement of Account" in html
    assert "50,000.00" in html


def test_render_html_risk_note_multi_vehicle():
    context = {
        "risk_note": {
            "risk_note_number": "RN-FLEET-001",
            "status": "FINAL",
            "coverage_start": "2026-01-01",
            "coverage_end": "2026-12-31",
            "sum_insured": "12500000.00",
            "net_premium": "350000.00",
        },
        "policy": {
            "policy_number": "POL-FLEET-001",
        },
        "client": {
            "name": "Rift Valley Hauliers",
            "kra_pin": "P051999999Z",
        },
        "product": {
            "name": "Commercial Fleet Comprehensive",
            "class_of_insurance": "Commercial Motor",
        },
        "vehicles": [
            {
                "registration_number": "KDA 111A",
                "make": "Isuzu",
                "model": "FSR",
                "year_of_manufacture": 2021,
                "chassis_number": "JALFSR34-998811",
                "sum_insured": "6500000.00",
            },
            {
                "registration_number": "KDB 222B",
                "make": "Mitsubishi",
                "model": "FH215",
                "year_of_manufacture": 2022,
                "chassis_number": "ME012345-776655",
                "sum_insured": "6000000.00",
            },
        ],
        "include_digital_stamp": True,
        "stamp_date": "26 OCT 2026",
    }
    html = PdfRendererService.render_html("risk_note.html", context)
    assert "RN-FLEET-001" in html
    assert "Asset Schedule (2 Vehicles)" in html
    assert "KDA 111A" in html
    assert "KDB 222B" in html
    assert "6,500,000.00" in html
    assert "CERTIFIED OFFICIAL" in html


def test_render_html_statement_running_balance():
    context = {
        "statement": {
            "client_name": "Agnes Mwangi",
            "client_id": "c9999999-0000-1111-2222-333333333333",
            "kra_pin": "A001234567X",
            "total_invoiced": "150000.00",
            "total_allocated": "100000.00",
            "net_outstanding_balance": "50000.00",
            "invoice_count": 2,
            "allocation_count": 1,
            "ledger_entries": [
                {
                    "date": "2026-01-01",
                    "type": "INVOICE",
                    "reference": "INV-001",
                    "description": "Annual Premium",
                    "debit": "150000.00",
                    "credit": "0.00",
                    "running_balance": "150000.00",
                },
                {
                    "date": "2026-01-15",
                    "type": "PAYMENT",
                    "reference": "PAY-001",
                    "description": "Part payment via bank",
                    "debit": "0.00",
                    "credit": "100000.00",
                    "running_balance": "50000.00",
                },
            ],
        },
        "generated_at": "2026-10-26 10:00:00 UTC",
    }
    html = PdfRendererService.render_html("statement.html", context)
    assert "Agnes Mwangi" in html
    assert "150,000.00" in html
    assert "50,000.00" in html
    assert "Balance (KES)" in html


def test_fallback_pdf_generation():
    title = "Test Fallback Notice"
    lines = ["Line 1: HealthWatch Insurance Agency", "Line 2: Invoice KES 10,000.00"]
    pdf_bytes = PdfRendererService._generate_fallback_pdf(title, lines)
    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf_bytes
    assert b"Test Fallback Notice" in pdf_bytes


def test_render_pdf_to_disk(tmp_path: Path):
    target = tmp_path / "output.pdf"
    res = PdfRendererService.render_pdf(
        html_content="<h1>Test HealthWatch PDF Output</h1>",
        output_path=target,
        fallback_title="Test Title",
    )
    assert res == target
    assert target.exists()
    assert target.stat().st_size > 0
