import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from app.models import (
    Client,
    Insurer,
    Policy,
    PolicyCreate,
    PolicyStatus,
    PremiumCalculation,
    PricingMethod,
    PricingStrategy,
    Product,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
    RiskNote,
)
from app.services.policy import (
    PolicyConflictError,
    PolicyNotFoundError,
    PolicyValidationError,
    policy_service,
)


def _seed_rating_product(db: Session) -> tuple[Client, Product]:
    insurer = Insurer(name=f"Insurer-{uuid.uuid4().hex[:6]}")
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name=f"Product-{uuid.uuid4().hex[:6]}",
        class_of_insurance="Motor Private",
        pricing_strategy=PricingStrategy.PERCENTAGE,
        default_commission_rate=Decimal("10.00"),
    )
    db.add(product)
    db.flush()

    rtv = RateTableVersion(
        insurer_id=insurer.id,
        class_of_insurance="Motor Private",
        version_number=1,
        status=RateTableStatus.PUBLISHED,
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        effective_from=date(2025, 1, 1),
        source_reference="Test schedule",
    )
    db.add(rtv)
    db.flush()

    bracket = RateBracket(
        rate_table_version_id=rtv.id,
        min_value=Decimal("0.00"),
        max_value=None,
        rate_percent=Decimal("0.04"),
        minimum_premium=Decimal("37500.00"),
        display_label="All values",
    )
    db.add(bracket)

    client = Client(
        name=f"Client-{uuid.uuid4().hex[:6]}",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        phone="0711000000",
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    db.refresh(product)
    return client, product


def test_create_policy_raises_not_found_when_product_missing(db: Session) -> None:
    client = Client(
        name="Missing Product Client",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        phone="0711000001",
    )
    db.add(client)
    db.commit()

    policy_in = PolicyCreate(
        policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
        client_id=client.id,
        product_id=uuid.uuid4(),
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )

    with pytest.raises(PolicyNotFoundError, match="Product not found"):
        policy_service.create_policy(
            session=db,
            policy_in=policy_in,
            cover_snapshot={"vehicle": {"sum_insured": "1000000"}},
            coverage_start=date.today(),
            coverage_end=date.today() + timedelta(days=365),
        )


def test_create_policy_raises_validation_error_when_rating_fails(db: Session) -> None:
    insurer = Insurer(name=f"NoRate-{uuid.uuid4().hex[:6]}")
    db.add(insurer)
    db.flush()
    product = Product(
        insurer_id=insurer.id,
        name=f"NoRateProd-{uuid.uuid4().hex[:6]}",
        class_of_insurance="Motor Private",
    )
    db.add(product)
    client = Client(
        name="Validation Client",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        phone="0711000002",
    )
    db.add(client)
    db.commit()

    policy_in = PolicyCreate(
        policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )

    with pytest.raises(PolicyValidationError):
        policy_service.create_policy(
            session=db,
            policy_in=policy_in,
            cover_snapshot={"vehicle": {"sum_insured": "1000000"}},
            coverage_start=date.today(),
            coverage_end=date.today() + timedelta(days=365),
        )


def test_create_policy_raises_conflict_on_duplicate_policy_number(db: Session) -> None:
    client, product = _seed_rating_product(db)
    policy_number = f"POL-{uuid.uuid4().hex[:6].upper()}"
    policy_in = PolicyCreate(
        policy_number=policy_number,
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )
    snapshot = {
        "vehicle": {
            "registration_number": "KAA 100A",
            "make": "Toyota",
            "sum_insured": "1000000",
        }
    }

    created = policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        cover_snapshot=snapshot,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
    )
    assert created.policy_number == policy_number

    with pytest.raises(PolicyConflictError):
        policy_service.create_policy(
            session=db,
            policy_in=policy_in,
            cover_snapshot=snapshot,
            coverage_start=date.today(),
            coverage_end=date.today() + timedelta(days=365),
        )


def test_create_policy_persists_policy_risk_note_and_calculation_atomically(
    db: Session,
) -> None:
    client, product = _seed_rating_product(db)
    policy_number = f"POL-{uuid.uuid4().hex[:6].upper()}"
    policy_in = PolicyCreate(
        policy_number=policy_number,
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )
    snapshot = {
        "vehicle": {
            "registration_number": "KAA 200B",
            "make": "Mazda",
            "sum_insured": "1000000",
        }
    }

    policy = policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        cover_snapshot=snapshot,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
    )

    persisted_policy = db.exec(
        select(Policy).where(Policy.id == policy.id)
    ).first()
    persisted_rns = db.exec(
        select(RiskNote).where(RiskNote.policy_id == policy.id)
    ).all()
    persisted_calcs = db.exec(
        select(PremiumCalculation).where(PremiumCalculation.policy_id == policy.id)
    ).all()

    assert persisted_policy is not None
    assert len(persisted_rns) == 1
    assert len(persisted_calcs) == 1
    assert persisted_rns[0].total_amount == Decimal("40220.00")


def test_policy_reads_update_and_soft_delete(db: Session) -> None:
    from app.models import PolicyUpdate

    client, product = _seed_rating_product(db)
    snapshot = {
        "vehicle": {
            "registration_number": "KAA 300C",
            "make": "Subaru",
            "sum_insured": "1000000",
        }
    }
    p1 = policy_service.create_policy(
        session=db,
        policy_in=PolicyCreate(
            policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
            client_id=client.id,
            product_id=product.id,
            status=PolicyStatus.ACTIVE,
            inception_date=date.today(),
        ),
        cover_snapshot=snapshot,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
    )
    p2 = policy_service.create_policy(
        session=db,
        policy_in=PolicyCreate(
            policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
            client_id=client.id,
            product_id=product.id,
            status=PolicyStatus.ACTIVE,
            inception_date=date.today(),
        ),
        cover_snapshot=snapshot,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
    )

    fetched = policy_service.get_policy(session=db, policy_id=p1.id)
    assert fetched.id == p1.id
    assert fetched.product is not None

    items, total = policy_service.list_policies(session=db, client_id=client.id)
    assert total == 2
    assert {item.id for item in items} == {p1.id, p2.id}

    # Updating p2's policy_number to p1's should raise PolicyConflictError
    with pytest.raises(PolicyConflictError):
        policy_service.update_policy(
            session=db,
            policy_id=p2.id,
            policy_in=PolicyUpdate(policy_number=p1.policy_number),
        )

    new_num = f"POL-UPD-{uuid.uuid4().hex[:5].upper()}"
    updated = policy_service.update_policy(
        session=db,
        policy_id=p1.id,
        policy_in=PolicyUpdate(policy_number=new_num),
    )
    assert updated.policy_number == new_num

    # Soft delete p1
    policy_service.delete_policy(session=db, policy_id=p1.id)

    with pytest.raises(PolicyNotFoundError):
        policy_service.get_policy(session=db, policy_id=p1.id)

    with pytest.raises(PolicyNotFoundError):
        policy_service.update_policy(
            session=db,
            policy_id=p1.id,
            policy_in=PolicyUpdate(policy_number="IGNORED"),
        )

    with pytest.raises(PolicyNotFoundError):
        policy_service.delete_policy(session=db, policy_id=p1.id)

    remaining, remaining_total = policy_service.list_policies(
        session=db, client_id=client.id
    )
    assert remaining_total == 1
    assert [item.id for item in remaining] == [p2.id]


def test_endorsement_and_risk_note_revision_domain_errors_and_queries(
    db: Session,
) -> None:
    from app.models import RiskNoteRevisionCreate, RiskNoteStatus

    client, product = _seed_rating_product(db)
    snapshot = {
        "vehicle": {
            "registration_number": "KAA 400D",
            "make": "Nissan",
            "sum_insured": "1000000",
        }
    }
    policy = policy_service.create_policy(
        session=db,
        policy_in=PolicyCreate(
            policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
            client_id=client.id,
            product_id=product.id,
            status=PolicyStatus.ACTIVE,
            inception_date=date.today(),
        ),
        cover_snapshot=snapshot,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
    )

    with pytest.raises(PolicyNotFoundError):
        policy_service.create_endorsement(
            session=db,
            policy_id=uuid.uuid4(),
            updated_cover_snapshot=snapshot,
            change_description="Missing policy",
        )

    updated_snapshot = {
        "vehicle": {
            "registration_number": "KAA 400D",
            "make": "Nissan",
            "sum_insured": "1500000",
        }
    }
    endorsed_rn = policy_service.create_endorsement(
        session=db,
        policy_id=policy.id,
        updated_cover_snapshot=updated_snapshot,
        change_description="Increased sum insured",
        effective_date=date.today(),
    )
    assert endorsed_rn.status == RiskNoteStatus.ISSUED

    rns, rn_count = policy_service.list_risk_notes(session=db, policy_id=policy.id)
    assert rn_count == 2
    assert len(rns) == 2

    fetched_rn = policy_service.get_risk_note(session=db, risk_note_id=endorsed_rn.id)
    assert fetched_rn.id == endorsed_rn.id

    from tests.utils.user import create_random_user

    actor = create_random_user(db)
    revised_rn = policy_service.create_risk_note_revision(
        session=db,
        risk_note_id=endorsed_rn.id,
        revision_in=RiskNoteRevisionCreate(special_clauses=["Clause A"]),
        created_by_id=actor.id,
    )
    assert revised_rn.previous_risk_note_id == endorsed_rn.id

    # Revising an already REPLACED risk note raises PolicyValidationError
    with pytest.raises(PolicyValidationError, match="already been replaced"):
        policy_service.create_risk_note_revision(
            session=db,
            risk_note_id=endorsed_rn.id,
            revision_in=RiskNoteRevisionCreate(special_clauses=["Clause B"]),
            created_by_id=actor.id,
        )

    with pytest.raises(PolicyNotFoundError):
        policy_service.get_risk_note(session=db, risk_note_id=uuid.uuid4())
