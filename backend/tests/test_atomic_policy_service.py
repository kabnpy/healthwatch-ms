from datetime import date
from decimal import Decimal

from sqlmodel import Session

from app.models import (
    Client,
    Insurer,
    PolicyCreate,
    PolicyStatus,
    Product,
    RiskNoteStatus,
    TransactionType,
)
from app.services.policy import policy_service


def test_create_policy_atomic_snapshot(db: Session) -> None:
    """
    Test that PolicyService.create_policy creates an atomic snapshot in the first RiskNote.
    """
    insurer = Insurer(name="Service Insurer")
    db.add(insurer)
    db.commit()

    product = Product(
        name="Service Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        pricing_rules={"tiers": []},
    )
    db.add(product)
    db.commit()

    client = Client(name="Service Client", kra_pin="S111111111Z", phone="0711111111")
    db.add(client)
    db.commit()

    cover_data = {
        "vehicle": {
            "registration_number": "KBA 001",
            "make": "Toyota",
            "sum_insured": 1000000,
        },
        "extensions": {"pvt": True},
        "terms": {
            "benefits_and_limits": "Included",
            "excesses": "Standard",
            "special_clauses": "None",
        },
    }

    policy_in = PolicyCreate(
        policy_number="POL-SRV-001",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )

    policy = policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        cover_snapshot=cover_data,
        coverage_start=date.today(),
        coverage_end=date.today(),
    )
    db.commit()
    db.refresh(policy)

    assert len(policy.risk_notes) == 1
    snapshot = policy.risk_notes[0].cover_snapshot
    assert snapshot["vehicle"]["registration_number"] == "KBA 001"
    assert snapshot["vehicle"]["sum_insured"] in [
        1000000,
        "1000000",
        Decimal("1000000"),
    ]
    assert snapshot["extensions"]["pvt"] is True
    assert snapshot["benefits_and_limits"] == "Included"
    assert policy.risk_notes[0].transaction_type == TransactionType.NEW_BUSINESS


def test_create_endorsement_atomic_snapshot(db: Session) -> None:
    """
    Test that PolicyService.create_endorsement creates a new atomic snapshot RiskNote.
    """
    # Setup initial policy
    insurer = Insurer(name="Endorsement Insurer")
    db.add(insurer)
    db.commit()

    product = Product(
        name="Endorsement Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        pricing_rules={"tiers": []},
    )
    db.add(product)
    db.commit()

    client = Client(
        name="Endorsement Client", kra_pin="E111111111Z", phone="0722222222"
    )
    db.add(client)
    db.commit()

    initial_cover = {
        "vehicle": {
            "registration_number": "KBA 002",
            "make": "Honda",
            "sum_insured": 800000,
        },
        "extensions": {"pvt": False},
        "terms": {
            "benefits_and_limits": "Basic",
            "excesses": "Standard",
            "special_clauses": "None",
        },
    }

    policy_in = PolicyCreate(
        policy_number="POL-END-001",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )

    policy = policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        cover_snapshot=initial_cover,
        coverage_start=date.today(),
        coverage_end=date.today(),
    )
    db.commit()
    db.refresh(policy)

    # Now create endorsement with FULL updated state
    updated_cover = initial_cover.copy()
    updated_cover["vehicle"]["sum_insured"] = 900000
    updated_cover["extensions"]["pvt"] = True

    endorsement_rn = policy_service.create_endorsement(
        session=db,
        policy_id=policy.id,
        updated_cover_snapshot=updated_cover,
        change_description="Upgraded value and added PVT",
    )
    db.commit()
    db.refresh(policy)

    assert len(policy.risk_notes) == 2
    # Verify the latest issued note is the endorsement
    latest_rn = next(
        rn
        for rn in policy.risk_notes
        if rn.transaction_type == TransactionType.ENDORSEMENT
    )
    snapshot = latest_rn.cover_snapshot
    assert snapshot["vehicle"]["registration_number"] == "KBA 002"
    assert snapshot["vehicle"]["sum_insured"] in [900000, "900000", Decimal("900000")]
    assert snapshot["extensions"]["pvt"] is True
    assert latest_rn.status == RiskNoteStatus.ISSUED

    # Verify the old note was replaced
    old_rn = next(
        rn
        for rn in policy.risk_notes
        if rn.transaction_type == TransactionType.NEW_BUSINESS
    )
    assert old_rn.status == RiskNoteStatus.REPLACED
