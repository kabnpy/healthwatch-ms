from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session

from app.models import Policy, PolicyStatus, RiskNote, RiskNoteStatus
from tests.utils.client import create_random_client
from tests.utils.insurance import create_random_product
from tests.utils.utils import random_lower_string


def test_policy_risk_details_storage(db: Session) -> None:
    """
    Verify that Policy now stores the authoritative risk_details.
    """
    client = create_random_client(db)
    product = create_random_product(db)
    risk_details = {"vehicle": {"value": 1200000}}

    # 1. Create Policy with details
    policy = Policy(
        policy_number=random_lower_string(),
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        risk_details=risk_details,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    assert policy.risk_details == risk_details


def test_risknote_chain_and_changelog(db: Session) -> None:
    """
    Verify that RiskNote records the change_log and linking.
    """
    # 1. Setup base entities
    client = create_random_client(db)
    product = create_random_product(db)

    # 2. Create Policy container
    policy = Policy(
        policy_number=random_lower_string(),
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        risk_details={"vehicle": {"value": 1000000}},
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    # 3. Create historical RiskNote
    old_date = date.today() - timedelta(days=365)
    rn_old = RiskNote(
        risk_note_number=random_lower_string(),
        policy_id=policy.id,
        transaction_type="New Business",
        status=RiskNoteStatus.ISSUED,
        effective_date=old_date,
        coverage_start=old_date,
        coverage_end=old_date + timedelta(days=364),
        net_premium=Decimal("10000.00"),
        commission_amount=Decimal("1000.00"),
        total_amount=Decimal("10500.00"),
    )
    db.add(rn_old)

    # 4. Create latest RiskNote (Endorsement)
    new_date = date.today()
    change_log = {"vehicle.value": {"from": 1000000, "to": 1200000}}
    rn_new = RiskNote(
        risk_note_number=random_lower_string(),
        policy_id=policy.id,
        transaction_type="Endorsement",
        status=RiskNoteStatus.ISSUED,
        previous_risk_note_id=rn_old.id,
        effective_date=new_date,
        coverage_start=old_date,
        coverage_end=old_date + timedelta(days=364),
        change_log=change_log,
        net_premium=Decimal("2000.00"),
        commission_amount=Decimal("200.00"),
        total_amount=Decimal("2100.00"),
    )
    db.add(rn_new)

    # Update Policy in-place
    policy.risk_details = {"vehicle": {"value": 1200000}}
    db.add(policy)

    db.commit()
    db.refresh(rn_new)
    db.refresh(policy)

    # 5. Verify
    assert rn_new.previous_risk_note_id == rn_old.id
    assert rn_new.change_log == change_log
    assert policy.risk_details["vehicle"]["value"] == 1200000


def test_policy_has_no_duplicated_data(db: Session) -> None:
    """
    Verify that old columns are gone.
    """
    client = create_random_client(db)
    policy = Policy(
        policy_number=random_lower_string(),
        client_id=client.id,
        status=PolicyStatus.ACTIVE,
    )

    # These should NOT be in the __dict__ (representing DB columns)
    # except for risk_details which IS now a column
    assert "risk_details" in policy.__dict__
    assert "total_premium" not in policy.__dict__
    assert "premium_breakdown" not in policy.__dict__
    assert "start_date" not in policy.__dict__
    assert "end_date" not in policy.__dict__
