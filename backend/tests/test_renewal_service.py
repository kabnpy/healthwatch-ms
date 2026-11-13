import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import (
    Client,
    Insurer,
    InvitationCreate,
    Policy,
    PolicyStatus,
    PremiumCalculation,
    PricingMethod,
    Product,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
    RenewalCreate,
    RenewalStatus,
    RenewalTransition,
    RenewalUpdate,
    get_datetime_utc,
)
from app.services.renewal import (
    RenewalConflictError,
    RenewalNotFoundError,
    RenewalService,
    RenewalValidationError,
)


def _create_policy_fixture(db: Session) -> tuple[Policy, RateTableVersion]:
    client = Client(
        name=f"Client-{uuid.uuid4().hex[:6]}",
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        phone="0700000000",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}Z",
    )
    db.add(client)

    insurer = Insurer(
        name=f"Insurer-{uuid.uuid4().hex[:6]}",
        email=f"insurer-{uuid.uuid4().hex[:6]}@example.com",
    )
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name=f"Product-{uuid.uuid4().hex[:6]}",
        class_of_insurance="Motor Private",
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

    policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:8].upper()}",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        coverage_start=date.today(),
        coverage_end=date.today() + timedelta(days=365),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    db.refresh(rtv)
    return policy, rtv


def test_create_renewal_raises_domain_not_found_for_missing_policy(db: Session) -> None:
    with pytest.raises(RenewalNotFoundError):
        RenewalService.create_renewal(
            session=db,
            renewal_in=RenewalCreate(
                policy_id=uuid.uuid4(),
                renewal_period_start=date.today(),
                renewal_period_end=date.today() + timedelta(days=365),
            ),
        )


def test_create_renewal_enforces_single_active_renewal_with_domain_error(
    db: Session,
) -> None:
    policy, _ = _create_policy_fixture(db)
    renewal_in = RenewalCreate(
        policy_id=policy.id,
        renewal_period_start=date.today() + timedelta(days=365),
        renewal_period_end=date.today() + timedelta(days=730),
        previous_premium=Decimal("50000.00"),
        proposed_premium=Decimal("52500.00"),
    )
    first = RenewalService.create_renewal(session=db, renewal_in=renewal_in)
    assert first.status == RenewalStatus.AWAITING_CARRIER
    assert first.version == 1

    with pytest.raises(RenewalValidationError, match="already has an active renewal"):
        RenewalService.create_renewal(session=db, renewal_in=renewal_in)


def test_terminal_renewal_allows_subsequent_active_renewal(db: Session) -> None:
    policy, _ = _create_policy_fixture(db)
    first = RenewalService.create_renewal(
        session=db,
        renewal_in=RenewalCreate(
            policy_id=policy.id,
            renewal_period_start=date.today() + timedelta(days=365),
            renewal_period_end=date.today() + timedelta(days=730),
        ),
    )
    cancelled = RenewalService.transition_renewal(
        session=db,
        renewal_id=first.id,
        transition_in=RenewalTransition(
            target_status=RenewalStatus.CANCELLED,
            expected_version=1,
            notes="Client opted out",
        ),
    )
    assert cancelled.status == RenewalStatus.CANCELLED
    assert (
        RenewalService.get_active_renewal_by_policy(session=db, policy_id=policy.id)
        is None
    )

    second = RenewalService.create_renewal(
        session=db,
        renewal_in=RenewalCreate(
            policy_id=policy.id,
            renewal_period_start=date.today() + timedelta(days=365),
            renewal_period_end=date.today() + timedelta(days=730),
        ),
    )
    assert second.id != first.id
    assert (
        RenewalService.get_active_renewal_by_policy(session=db, policy_id=policy.id).id
        == second.id
    )


def test_get_list_count_and_soft_delete_exclusion(db: Session) -> None:
    policy1, _ = _create_policy_fixture(db)
    policy2, _ = _create_policy_fixture(db)

    r1 = RenewalService.create_renewal(
        session=db,
        renewal_in=RenewalCreate(
            policy_id=policy1.id,
            renewal_period_start=date.today() + timedelta(days=100),
            renewal_period_end=date.today() + timedelta(days=465),
        ),
    )
    r2 = RenewalService.create_renewal(
        session=db,
        renewal_in=RenewalCreate(
            policy_id=policy2.id,
            renewal_period_start=date.today() + timedelta(days=200),
            renewal_period_end=date.today() + timedelta(days=565),
        ),
    )
    RenewalService.transition_renewal(
        session=db,
        renewal_id=r2.id,
        transition_in=RenewalTransition(
            target_status=RenewalStatus.CARRIER_RECEIVED, expected_version=1
        ),
    )

    assert RenewalService.get_renewal(session=db, renewal_id=r1.id).id == r1.id
    assert RenewalService.count_renewals(session=db, policy_id=policy1.id) == 1
    assert (
        RenewalService.count_renewals(
            session=db, status=RenewalStatus.CARRIER_RECEIVED
        )
        >= 1
    )
    listed = RenewalService.get_renewals(
        session=db, policy_id=policy2.id, status=RenewalStatus.CARRIER_RECEIVED
    )
    assert [item.id for item in listed] == [r2.id]

    # Soft-delete r1 and verify it is excluded from all reads
    r1.deleted_at = get_datetime_utc()
    db.add(r1)
    db.commit()

    with pytest.raises(RenewalNotFoundError):
        RenewalService.get_renewal(session=db, renewal_id=r1.id)
    assert RenewalService.count_renewals(session=db, policy_id=policy1.id) == 0
    assert RenewalService.get_renewals(session=db, policy_id=policy1.id) == []
    assert (
        RenewalService.get_active_renewal_by_policy(session=db, policy_id=policy1.id)
        is None
    )


def test_transition_and_update_raise_domain_errors(db: Session) -> None:
    policy, _ = _create_policy_fixture(db)
    renewal = RenewalService.create_renewal(
        session=db,
        renewal_in=RenewalCreate(
            policy_id=policy.id,
            renewal_period_start=date.today() + timedelta(days=365),
            renewal_period_end=date.today() + timedelta(days=730),
        ),
    )

    with pytest.raises(RenewalNotFoundError):
        RenewalService.transition_renewal(
            session=db,
            renewal_id=uuid.uuid4(),
            transition_in=RenewalTransition(
                target_status=RenewalStatus.CARRIER_RECEIVED, expected_version=1
            ),
        )

    with pytest.raises(RenewalConflictError) as exc_info:
        RenewalService.transition_renewal(
            session=db,
            renewal_id=renewal.id,
            transition_in=RenewalTransition(
                target_status=RenewalStatus.CARRIER_RECEIVED, expected_version=99
            ),
        )
    assert exc_info.value.current_version == 1
    assert exc_info.value.provided_version == 99

    with pytest.raises(RenewalValidationError, match="Invalid renewal transition"):
        RenewalService.transition_renewal(
            session=db,
            renewal_id=renewal.id,
            transition_in=RenewalTransition(
                target_status=RenewalStatus.COMPLETED, expected_version=1
            ),
        )

    updated = RenewalService.update_renewal(
        session=db,
        renewal_id=renewal.id,
        renewal_in=RenewalUpdate(expected_version=1, notes="Checked terms"),
    )
    assert updated.version == 2
    assert updated.notes == "Checked terms"

    with pytest.raises(RenewalConflictError) as upd_exc:
        RenewalService.update_renewal(
            session=db,
            renewal_id=renewal.id,
            renewal_in=RenewalUpdate(expected_version=1, notes="Stale"),
        )
    assert upd_exc.value.current_version == 2
    assert upd_exc.value.provided_version == 1


def test_create_and_list_invitations_for_renewal(db: Session) -> None:
    policy, rtv = _create_policy_fixture(db)
    renewal = RenewalService.create_renewal(
        session=db,
        renewal_in=RenewalCreate(
            policy_id=policy.id,
            renewal_period_start=date.today() + timedelta(days=365),
            renewal_period_end=date.today() + timedelta(days=730),
        ),
    )
    calc = PremiumCalculation(
        policy_id=policy.id,
        renewal_id=renewal.id,
        rate_table_version_id=rtv.id,
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        basic_premium=Decimal("40000.00"),
        levies_total=Decimal("180.00"),
        total_premium=Decimal("40180.00"),
    )
    db.add(calc)
    db.commit()
    db.refresh(calc)

    with pytest.raises(RenewalNotFoundError):
        RenewalService.create_invitation(
            session=db,
            invitation_in=InvitationCreate(
                renewal_id=uuid.uuid4(),
                calculation_id=calc.id,
                rendered_snapshot={"html": "<p>Test</p>"},
            ),
        )

    with pytest.raises(RenewalNotFoundError):
        RenewalService.create_invitation(
            session=db,
            invitation_in=InvitationCreate(
                renewal_id=renewal.id,
                calculation_id=uuid.uuid4(),
                rendered_snapshot={"html": "<p>Test</p>"},
            ),
        )

    inv1 = RenewalService.create_invitation(
        session=db,
        invitation_in=InvitationCreate(
            renewal_id=renewal.id,
            calculation_id=calc.id,
            rendered_snapshot={"version": 1},
            storage_key="invitations/v1.pdf",
        ),
    )
    # Force distinct timestamp for deterministic desc ordering check
    inv1.generated_at = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    db.add(inv1)
    db.commit()

    inv2 = RenewalService.create_invitation(
        session=db,
        invitation_in=InvitationCreate(
            renewal_id=renewal.id,
            calculation_id=calc.id,
            rendered_snapshot={"version": 2},
            storage_key="invitations/v2.pdf",
        ),
    )
    inv2.generated_at = datetime(2026, 1, 2, 10, 0, tzinfo=UTC)
    db.add(inv2)
    db.commit()

    invitations = RenewalService.get_invitations_for_renewal(
        session=db, renewal_id=renewal.id
    )
    assert [inv.id for inv in invitations] == [inv2.id, inv1.id]
    assert invitations[0].storage_key == "invitations/v2.pdf"
