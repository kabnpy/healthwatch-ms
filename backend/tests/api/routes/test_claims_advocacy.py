from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    ClaimStatus,
    Client,
    Policy,
    PolicyStatus,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)


def test_claims_lifecycle_and_advocacy_summary(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = Client(
        name="Transit Express",
        email="ops@transit.co.ke",
        phone="+254733000222",
        kra_pin="P053344556C",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy = Policy(
        policy_number="POL-TRX-09", client_id=client_obj.id, status=PolicyStatus.ACTIVE
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    risk_note = RiskNote(
        policy_id=policy.id,
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ACTIVE,
        coverage_start=date(2026, 1, 1),
        coverage_end=date(2026, 12, 31),
        net_premium=Decimal("200000.00"),  # 200,000 net earned premium
        commission_amount=Decimal("20000.00"),
        total_amount=Decimal("200900.00"),
    )
    db.add(risk_note)
    db.commit()

    # 2. Create Claim (INTIMATED state)
    claim_data = {
        "policy_id": str(policy.id),
        "client_id": str(client_obj.id),
        "claim_number": "CLM-TRX-001",
        "date_of_loss": "2026-05-10",
        "date_reported": "2026-05-11",
        "description": "Accidental collision on Mombasa Road",
        "loss_type": "Accidental Collision",
        "loss_description": "Rear bumper and tailgate damage",
        "reserve_amount": 50000.00,
        "status": ClaimStatus.INTIMATED.value,
    }
    r = client.post(
        f"{settings.API_V1_STR}/claims/",
        headers=superuser_token_headers,
        json=claim_data,
    )
    assert r.status_code == 201
    claim = r.json()
    claim_id = claim["id"]
    assert claim["status"] == ClaimStatus.INTIMATED.value

    # 3. Transition: INTIMATED -> DOCUMENTS_PENDING
    r_doc = client.put(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
        json={"status": ClaimStatus.DOCUMENTS_PENDING.value},
    )
    assert r_doc.status_code == 200

    # 4. Transition: DOCUMENTS_PENDING -> ADJUSTER_APPOINTED
    r_adj = client.put(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
        json={
            "status": ClaimStatus.ADJUSTER_APPOINTED.value,
            "assigned_adjuster": "GAB Robins Adjusters",
        },
    )
    assert r_adj.status_code == 200

    # 5. Transition: ADJUSTER_APPOINTED -> REPAIRS_AUTHORIZED
    r_rep = client.put(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
        json={"status": ClaimStatus.REPAIRS_AUTHORIZED.value},
    )
    assert r_rep.status_code == 200

    # 6. Transition: REPAIRS_AUTHORIZED -> DISCHARGE_VOUCHER
    r_dv = client.put(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
        json={"status": ClaimStatus.DISCHARGE_VOUCHER.value},
    )
    assert r_dv.status_code == 200

    # 7. Transition: DISCHARGE_VOUCHER -> SETTLED
    r_set = client.put(
        f"{settings.API_V1_STR}/claims/{claim_id}",
        headers=superuser_token_headers,
        json={
            "status": ClaimStatus.SETTLED.value,
            "settled_amount": 45000.00,
        },
    )
    assert r_set.status_code == 200
    assert r_set.json()["status"] == ClaimStatus.SETTLED.value

    # 8. Test Advocacy Summary (Loss Ratio calculation)
    # Total earned premium = 200,000
    # Incurred claim = 45,000 settled
    # Loss ratio = 45,000 / 200,000 = 22.50% -> EXCELLENT
    summary_resp = client.get(
        f"{settings.API_V1_STR}/claims/policy/{policy.id}/advocacy-summary",
        headers=superuser_token_headers,
    )
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert Decimal(str(summary["loss_ratio_percent"])) == Decimal("22.50")
    assert summary["advocacy_rating"] == "EXCELLENT"
    assert "concessions" in summary["advocacy_note"]
