import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlmodel import Session

from app.models import (
    Client,
    Insurer,
    Policy,
    PolicyStatus,
    PricingStrategy,
    Product,
    Renewal,
    RenewalStatus,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)
from app.services.dashboard import get_dashboard_summary
from app.services.policy import policy_service
from app.services.renewal import TERMINAL_STATUSES, RenewalService


def _seed_client_and_product(db: Session, *, class_of_insurance: str = "Motor Private") -> tuple[Client, Product]:
    insurer = Insurer(name=f"Insurer-{uuid.uuid4().hex[:6]}")
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name=f"Product-{uuid.uuid4().hex[:6]}",
        class_of_insurance=class_of_insurance,
        pricing_strategy=PricingStrategy.PERCENTAGE,
        default_commission_rate=Decimal("10.00"),
    )
    db.add(product)
    db.flush()

    client = Client(
        name=f"Client-{uuid.uuid4().hex[:6]}",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        phone="+254700000000",
    )
    db.add(client)
    db.flush()
    return client, product


def test_get_active_policy_expirations_returns_latest_risk_note_and_utc_days_left(
    db: Session,
) -> None:
    client, motor_product = _seed_client_and_product(db, class_of_insurance="Motor Private")
    _, medical_product = _seed_client_and_product(db, class_of_insurance="Medical")
    as_of = date(2026, 11, 27)

    # Active motor policy with two risk notes (older and newer)
    active_policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:8]}",
        client_id=client.id,
        product_id=motor_product.id,
        status=PolicyStatus.ACTIVE,
        risk_details={"registration": "KAA 123A"},
    )
    db.add(active_policy)
    db.flush()

    older_rn = RiskNote(
        policy_id=active_policy.id,
        risk_note_number=f"RN-{uuid.uuid4().hex[:8]}",
        status=RiskNoteStatus.REPLACED,
        transaction_type=TransactionType.NEW_BUSINESS,
        coverage_start=as_of - timedelta(days=360),
        coverage_end=as_of + timedelta(days=5),
        net_premium=Decimal("10000.00"),
        total_amount=Decimal("10040.00"),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    newer_rn = RiskNote(
        policy_id=active_policy.id,
        risk_note_number=f"RN-{uuid.uuid4().hex[:8]}",
        status=RiskNoteStatus.ACTIVE,
        transaction_type=TransactionType.NEW_BUSINESS,
        coverage_start=as_of - timedelta(days=350),
        coverage_end=as_of + timedelta(days=15),
        net_premium=Decimal("12000.00"),
        total_amount=Decimal("12040.00"),
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    db.add(older_rn)
    db.add(newer_rn)

    # RiskNote-exempt Medical policy (active, no RiskNote) -> must not be synthesized
    medical_policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:8]}",
        client_id=client.id,
        product_id=medical_product.id,
        status=PolicyStatus.ACTIVE,
        risk_details={},
    )
    db.add(medical_policy)

    # Lapsed policy with a RiskNote -> must be excluded
    lapsed_policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:8]}",
        client_id=client.id,
        product_id=motor_product.id,
        status=PolicyStatus.LAPSED,
        risk_details={"registration": "KBB 456B"},
    )
    db.add(lapsed_policy)
    db.flush()

    lapsed_rn = RiskNote(
        policy_id=lapsed_policy.id,
        risk_note_number=f"RN-{uuid.uuid4().hex[:8]}",
        status=RiskNoteStatus.ACTIVE,
        transaction_type=TransactionType.NEW_BUSINESS,
        coverage_start=as_of - timedelta(days=350),
        coverage_end=as_of + timedelta(days=10),
        net_premium=Decimal("10000.00"),
        total_amount=Decimal("10040.00"),
    )
    db.add(lapsed_rn)
    db.commit()

    projections = policy_service.get_active_policy_expirations(session=db, as_of=as_of)
    by_id = {p.policy.id: p for p in projections}

    assert active_policy.id in by_id
    assert medical_policy.id not in by_id
    assert lapsed_policy.id not in by_id

    proj = by_id[active_policy.id]
    assert proj.coverage_end == as_of + timedelta(days=15)
    assert proj.days_left == 15
    assert proj.client_name == client.name


def test_horizon_and_dashboard_produce_identical_expirations_and_delegate_renewals(
    db: Session,
) -> None:
    client, motor_product = _seed_client_and_product(db, class_of_insurance="Motor Private")
    as_of = date(2026, 11, 27)

    policy_10d = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:8]}",
        client_id=client.id,
        product_id=motor_product.id,
        status=PolicyStatus.ACTIVE,
        risk_details={"registration": "KCC 789C"},
    )
    db.add(policy_10d)
    db.flush()

    db.add(
        RiskNote(
            policy_id=policy_10d.id,
            risk_note_number=f"RN-{uuid.uuid4().hex[:8]}",
            status=RiskNoteStatus.ACTIVE,
            transaction_type=TransactionType.NEW_BUSINESS,
            coverage_start=as_of - timedelta(days=355),
            coverage_end=as_of + timedelta(days=10),
            net_premium=Decimal("10000.00"),
            total_amount=Decimal("10040.00"),
        )
    )

    in_flight_renewal = Renewal(
        policy_id=policy_10d.id,
        renewal_period_start=as_of + timedelta(days=11),
        renewal_period_end=as_of + timedelta(days=375),
        status=RenewalStatus.AWAITING_CARRIER,
    )
    completed_renewal = Renewal(
        policy_id=policy_10d.id,
        renewal_period_start=as_of - timedelta(days=355),
        renewal_period_end=as_of + timedelta(days=10),
        status=RenewalStatus.COMPLETED,
    )
    db.add(in_flight_renewal)
    db.add(completed_renewal)
    db.commit()

    horizon = RenewalService.get_horizon(session=db, as_of=as_of)
    dashboard = get_dashboard_summary(session=db, as_of=as_of)

    horizon_0_30 = {item.policy_id: item for item in horizon.bucket_0_30}
    dash_0_30 = {item.policy.id: item for item in dashboard.expiring_30}

    assert set(horizon_0_30.keys()) == set(dash_0_30.keys())
    assert policy_10d.id in dash_0_30
    assert horizon_0_30[policy_10d.id].days_left == dash_0_30[policy_10d.id].days_left == 10
    assert horizon_0_30[policy_10d.id].coverage_end == as_of + timedelta(days=10)

    in_flight_ids = {item.renewal.id for item in dashboard.in_flight_renewals}
    assert in_flight_renewal.id in in_flight_ids
    assert completed_renewal.id not in in_flight_ids
    assert dashboard.in_flight_renewals_count == len(dashboard.in_flight_renewals)
    for item in dashboard.in_flight_renewals:
        assert item.renewal.status not in TERMINAL_STATUSES

