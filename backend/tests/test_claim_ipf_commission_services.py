import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    ClaimCreate,
    ClaimEventCreate,
    ClaimEventType,
    ClaimStatus,
    ClaimUpdate,
    Client,
    CommissionScheduleCreate,
    Document,
    DocumentEntityType,
    DocumentType,
    Insurer,
    Invoice,
    IPFAgreementCreate,
    IPFAgreementUpdate,
    IPFStatus,
    Policy,
    PolicyStatus,
    ProductLine,
)
from app.services.claim import (
    ClaimNotFoundError,
    ClaimService,
    ClaimValidationError,
)
from app.services.commission import (
    CommissionNotFoundError,
    CommissionService,
)
from app.services.ipf import (
    IPFNotFoundError,
    IPFService,
    IPFValidationError,
)


def _seed_client_and_policy(db: Session, suffix: str = "1") -> tuple[Client, Policy]:
    client_obj = Client(
        name=f"Claim Client {suffix}",
        email=f"claim-client-{suffix}-{uuid.uuid4().hex[:6]}@example.co.ke",
        phone="+254711000111",
        kra_pin=f"A00{uuid.uuid4().hex[:7].upper()}Z",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy = Policy(
        policy_number=f"POL-CLM-{suffix}-{uuid.uuid4().hex[:6]}",
        client_id=client_obj.id,
        status=PolicyStatus.ACTIVE,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return client_obj, policy


def test_claim_service_crud_and_transitions(db: Session) -> None:
    client_obj, policy = _seed_client_and_policy(db, "svc")

    claim = ClaimService.create_claim(
        session=db,
        claim_in=ClaimCreate(
            claim_number=f"CLM-{uuid.uuid4().hex[:8]}",
            policy_id=policy.id,
            client_id=client_obj.id,
            date_of_loss=date(2026, 5, 1),
            description="Windscreen crack",
            reserve_amount=Decimal("25000.00"),
            status=ClaimStatus.INTIMATED,
        ),
    )
    assert claim.id is not None

    fetched = ClaimService.get_claim(session=db, claim_id=claim.id)
    assert fetched.id == claim.id

    claims, count = ClaimService.list_claims(
        session=db, policy_id=policy.id, client_id=client_obj.id
    )
    assert count == 1
    assert len(claims) == 1
    assert claims[0].id == claim.id

    event = ClaimService.create_claim_event(
        session=db,
        claim_event_in=ClaimEventCreate(
            claim_id=claim.id,
            event_type=ClaimEventType.NOTIFICATION,
            description="Claim intimated by client",
        ),
    )
    assert event.claim_id == claim.id

    updated = ClaimService.update_claim(
        session=db,
        claim_id=claim.id,
        claim_in=ClaimUpdate(status=ClaimStatus.DOCUMENTS_PENDING),
    )
    assert updated.status == ClaimStatus.DOCUMENTS_PENDING

    with pytest.raises(ClaimValidationError):
        ClaimService.update_claim(
            session=db,
            claim_id=claim.id,
            claim_in=ClaimUpdate(status=ClaimStatus.INTIMATED),
        )

    ClaimService.delete_claim(session=db, claim_id=claim.id)
    with pytest.raises(ClaimNotFoundError):
        ClaimService.get_claim(session=db, claim_id=claim.id)

    claims_after, count_after = ClaimService.list_claims(
        session=db, policy_id=policy.id
    )
    assert count_after == 0
    assert claims_after == []


def test_claims_routes_list_get_delete_and_errors(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj, policy = _seed_client_and_policy(db, "routes")

    r_create = client.post(
        f"{settings.API_V1_STR}/claims/",
        headers=superuser_token_headers,
        json={
            "claim_number": f"CLM-RT-{uuid.uuid4().hex[:6]}",
            "policy_id": str(policy.id),
            "client_id": str(client_obj.id),
            "date_of_loss": "2026-05-10",
            "description": "Route test claim",
        },
    )
    assert r_create.status_code == 201
    claim_id = r_create.json()["id"]

    r_list = client.get(
        f"{settings.API_V1_STR}/claims/?policy_id={policy.id}",
        headers=superuser_token_headers,
    )
    assert r_list.status_code == 200
    assert r_list.json()["count"] == 1

    r_get = client.get(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
    )
    assert r_get.status_code == 200
    assert r_get.json()["id"] == claim_id

    r_bad_transition = client.put(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
        json={"status": ClaimStatus.SETTLED.value},
    )
    assert r_bad_transition.status_code == 400

    r_del = client.delete(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
    )
    assert r_del.status_code == 200

    r_get_deleted = client.get(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
    )
    assert r_get_deleted.status_code == 404


def test_ipf_service_crud_and_validation(db: Session) -> None:
    client_obj, policy = _seed_client_and_policy(db, "ipf")
    invoice = Invoice(
        policy_id=policy.id,
        client_id=client_obj.id,
        invoice_number=f"INV-IPF-{uuid.uuid4().hex[:6]}",
        total_amount=Decimal("100000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("100000.00"),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    with pytest.raises(IPFValidationError):
        IPFService.create_ipf_agreement(
            session=db,
            ipf_in=IPFAgreementCreate(
                client_id=client_obj.id,
                policy_id=policy.id,
                invoice_id=invoice.id,
                financier_name="NCBA IPF",
                agreement_reference=f"IPF-BAD-{uuid.uuid4().hex[:6]}",
                total_financed_amount=Decimal("100000.00"),
                deposit_amount=Decimal("10000.00"),
                number_of_installments=10,
                monthly_installment=Decimal("9000.00"),
            ),
        )

    agreement = IPFService.create_ipf_agreement(
        session=db,
        ipf_in=IPFAgreementCreate(
            client_id=client_obj.id,
            policy_id=policy.id,
            invoice_id=invoice.id,
            financier_name="NCBA IPF",
            agreement_reference=f"IPF-OK-{uuid.uuid4().hex[:6]}",
            total_financed_amount=Decimal("100000.00"),
            deposit_amount=Decimal("20000.00"),
            number_of_installments=10,
            monthly_installment=Decimal("9999.00"),  # overridden by service
        ),
    )
    assert agreement.monthly_installment == Decimal("8000.00")

    fetched = IPFService.get_ipf_agreement(session=db, ipf_id=agreement.id)
    assert fetched.id == agreement.id

    agreements, count = IPFService.list_ipf_agreements(
        session=db, client_id=client_obj.id, policy_id=policy.id
    )
    assert count == 1
    assert len(agreements) == 1

    with pytest.raises(IPFValidationError):
        IPFService.update_ipf_agreement(
            session=db,
            ipf_id=agreement.id,
            ipf_in=IPFAgreementUpdate(status=IPFStatus.GUARANTEED),
        )

    doc = Document(
        entity_type=DocumentEntityType.POLICY,
        entity_id=policy.id,
        file_path="uploads/ipf_commitment.pdf",
        document_type=DocumentType.OTHER,
        description="Commitment Letter",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    updated = IPFService.update_ipf_agreement(
        session=db,
        ipf_id=agreement.id,
        ipf_in=IPFAgreementUpdate(
            status=IPFStatus.GUARANTEED,
            commitment_letter_document_id=doc.id,
        ),
    )
    assert updated.status == IPFStatus.GUARANTEED

    with pytest.raises(IPFNotFoundError):
        IPFService.get_ipf_agreement(session=db, ipf_id=uuid.uuid4())


def test_ipf_routes_list_get_and_404(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj, policy = _seed_client_and_policy(db, "ipf-rt")
    invoice = Invoice(
        policy_id=policy.id,
        client_id=client_obj.id,
        invoice_number=f"INV-IPFRT-{uuid.uuid4().hex[:6]}",
        total_amount=Decimal("50000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("50000.00"),
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    r_create = client.post(
        f"{settings.API_V1_STR}/ipf/",
        headers=superuser_token_headers,
        json={
            "client_id": str(client_obj.id),
            "policy_id": str(policy.id),
            "invoice_id": str(invoice.id),
            "financier_name": "KCB IPF",
            "agreement_reference": f"IPF-RT-{uuid.uuid4().hex[:6]}",
            "total_financed_amount": 50000.00,
            "deposit_amount": 10000.00,
            "number_of_installments": 4,
            "monthly_installment": 10000.00,
        },
    )
    assert r_create.status_code == 201
    ipf_id = r_create.json()["id"]

    r_list = client.get(
        f"{settings.API_V1_STR}/ipf/?client_id={client_obj.id}",
        headers=superuser_token_headers,
    )
    assert r_list.status_code == 200
    assert r_list.json()["count"] == 1

    r_get = client.get(
        f"{settings.API_V1_STR}/ipf/{ipf_id}",
        headers=superuser_token_headers,
    )
    assert r_get.status_code == 200
    assert r_get.json()["id"] == ipf_id

    r_missing = client.get(
        f"{settings.API_V1_STR}/ipf/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r_missing.status_code == 404


def test_commission_service_and_routes(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    insurer = Insurer(
        name=f"Jubilee-{uuid.uuid4().hex[:6]}",
        email=f"jubilee-{uuid.uuid4().hex[:6]}@example.co.ke",
    )
    db.add(insurer)
    db.commit()
    db.refresh(insurer)

    schedule = CommissionService.create_commission_schedule(
        session=db,
        schedule_in=CommissionScheduleCreate(
            insurer_id=insurer.id,
            product_line=ProductLine.MOTOR_COMPREHENSIVE,
            commission_rate_percent=Decimal("0.1000"),
            effective_from=date(2026, 1, 1),
            is_active=True,
        ),
    )
    assert schedule.id is not None

    fetched = CommissionService.get_commission_schedule(
        session=db, schedule_id=schedule.id
    )
    assert fetched.id == schedule.id

    schedules, count = CommissionService.list_commission_schedules(
        session=db, insurer_id=insurer.id
    )
    assert count == 1
    assert len(schedules) == 1

    with pytest.raises(CommissionNotFoundError):
        CommissionService.get_commission_schedule(
            session=db, schedule_id=uuid.uuid4()
        )

    r_post = client.post(
        f"{settings.API_V1_STR}/commissions/",
        headers=superuser_token_headers,
        json={
            "insurer_id": str(insurer.id),
            "product_line": ProductLine.DOMESTIC_PACKAGE.value,
            "commission_rate_percent": "0.2000",
            "effective_from": "2026-02-01",
            "is_active": True,
        },
    )
    assert r_post.status_code == 201

    r_list = client.get(
        f"{settings.API_V1_STR}/commissions/?insurer_id={insurer.id}",
        headers=superuser_token_headers,
    )
    assert r_list.status_code == 200
    assert r_list.json()["count"] == 2
