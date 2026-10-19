from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Client,
    Document,
    DocumentEntityType,
    DocumentType,
    Invoice,
    IPFStatus,
    Policy,
    PolicyStatus,
    ProductLine,
)


def test_ipf_deposit_validation_and_transitions(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = Client(
        name="Apex Logistics Ltd",
        email="finance@apex.co.ke",
        phone="+254722000111",
        kra_pin="P052233445B",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy = Policy(
        policy_number="POL-APEX-01", client_id=client_obj.id, status=PolicyStatus.ACTIVE
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    invoice = Invoice(
        policy_id=policy.id,
        client_id=client_obj.id,
        invoice_number="INV-APEX-01",
        total_amount=Decimal("100000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("100000.00"),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # 1. Reject deposit less than 20% (e.g. 15,000 on 100,000)
    invalid_ipf = {
        "client_id": str(client_obj.id),
        "policy_id": str(policy.id),
        "invoice_id": str(invoice.id),
        "financier_name": "NIC Bank IPF",
        "agreement_reference": "IPF-REF-001",
        "total_financed_amount": 100000.00,
        "deposit_amount": 15000.00,  # 15% < 20%
        "number_of_installments": 10,
        "monthly_installment": 8500.00,
    }
    r_invalid = client.post(
        f"{settings.API_V1_STR}/ipf/",
        headers=superuser_token_headers,
        json=invalid_ipf,
    )
    assert r_invalid.status_code == 400
    assert "less than the statutory minimum 20%" in r_invalid.json()["detail"]

    # 2. Accept valid 20% deposit (20,000 on 100,000, 10 installments of 8,000)
    valid_ipf = {
        "client_id": str(client_obj.id),
        "policy_id": str(policy.id),
        "invoice_id": str(invoice.id),
        "financier_name": "NIC Bank IPF",
        "agreement_reference": "IPF-REF-002",
        "total_financed_amount": 100000.00,
        "deposit_amount": 20000.00,
        "number_of_installments": 10,
        "monthly_installment": 8000.00,
    }
    r_valid = client.post(
        f"{settings.API_V1_STR}/ipf/",
        headers=superuser_token_headers,
        json=valid_ipf,
    )
    assert r_valid.status_code == 201
    ipf_data = r_valid.json()
    ipf_id = ipf_data["id"]
    assert ipf_data["status"] == IPFStatus.PENDING_DEPOSIT.value

    # 3. Attempt GUARANTEE without commitment letter -> fails
    r_app_fail = client.patch(
        f"{settings.API_V1_STR}/ipf/{ipf_id}",
        headers=superuser_token_headers,
        json={"status": IPFStatus.GUARANTEED.value},
    )
    assert r_app_fail.status_code == 400

    # Create dummy commitment letter document
    doc = Document(
        entity_type=DocumentEntityType.POLICY,
        entity_id=policy.id,
        file_path="uploads/commitment_letter.pdf",
        document_type=DocumentType.OTHER,
        description="Bank Commitment Letter",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 4. Guarantee with commitment letter document attached -> succeeds
    r_app_success = client.patch(
        f"{settings.API_V1_STR}/ipf/{ipf_id}",
        headers=superuser_token_headers,
        json={
            "status": IPFStatus.GUARANTEED.value,
            "commitment_letter_document_id": str(doc.id),
        },
    )
    assert r_app_success.status_code == 200
    assert r_app_success.json()["status"] == IPFStatus.GUARANTEED.value

    # 5. Transition to DISBURSED
    r_disb = client.patch(
        f"{settings.API_V1_STR}/ipf/{ipf_id}",
        headers=superuser_token_headers,
        json={"status": IPFStatus.DISBURSED.value},
    )
    assert r_disb.status_code == 200
    assert r_disb.json()["status"] == IPFStatus.DISBURSED.value


def test_commission_calculation_and_remittance(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # 1. Motor Comprehensive (10% commission, 5% statutory WHT)
    # Net base premium: KES 100,000.00
    # Gross invoice total: KES 100,490.00 (with taxes)
    # Gross Commission (10%): KES 10,000.00
    # WHT (5% of 10,000): KES 500.00
    # Net Commission: KES 9,500.00
    # Net Carrier Remittance: 100,490.00 - 9,500.00 = KES 90,990.00
    calc_req = {
        "net_base_premium": 100000.00,
        "gross_invoice_total": 100490.00,
        "product_line": ProductLine.MOTOR_COMPREHENSIVE.value,
    }
    r = client.post(
        f"{settings.API_V1_STR}/commissions/calculate",
        headers=superuser_token_headers,
        json=calc_req,
    )
    assert r.status_code == 200
    res = r.json()
    assert Decimal(str(res["gross_commission"])) == Decimal("10000.00")
    assert Decimal(str(res["withholding_tax"])) == Decimal("500.00")
    assert Decimal(str(res["net_commission"])) == Decimal("9500.00")
    assert Decimal(str(res["net_carrier_remittance"])) == Decimal("90990.00")
