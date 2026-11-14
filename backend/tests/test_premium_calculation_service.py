import uuid
from datetime import date
from decimal import Decimal

from sqlmodel import Session

from app.models import (
    BusinessEvent,
    Client,
    Insurer,
    Policy,
    PolicyStatus,
    PremiumCalculationCreate,
    Product,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
    Renewal,
)
from app.services.premium_calculation import PremiumCalculationService


def _create_product_and_rate_table(
    db: Session,
    *,
    status: RateTableStatus = RateTableStatus.PUBLISHED,
) -> tuple[Product, RateTableVersion]:
    uid = uuid.uuid4().hex[:8]
    insurer = Insurer(name=f"Insurer {uid}", code=f"INS{uid}")
    db.add(insurer)
    db.flush()

    product = Product(
        name=f"Motor Private {uid}",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        is_active=True,
    )
    db.add(product)
    db.flush()

    rt = RateTableVersion(
        insurer_id=insurer.id,
        class_of_insurance="Motor Private",
        version_number=1,
        effective_from=date(2025, 1, 1),
        status=status,
        source_reference="TEST-REF",
    )
    db.add(rt)
    db.flush()

    bracket = RateBracket(
        rate_table_version_id=rt.id,
        min_value=Decimal("0"),
        max_value=None,
        rate_percent=Decimal("0.04"),
        minimum_premium=Decimal("15000"),
        display_label="Standard",
    )
    db.add(bracket)
    db.commit()
    db.refresh(product)
    db.refresh(rt)
    return product, rt


def test_evaluate_quote_by_rate_table_id_and_product_id(db: Session) -> None:
    product, rt = _create_product_and_rate_table(db)

    inputs = {
        "vehicle": {
            "registration_number": "KAA 123A",
            "make": "Toyota",
            "sum_insured": 1_000_000,
        }
    }
    res_by_rt = PremiumCalculationService.evaluate_quote(
        session=db,
        rate_table_id=rt.id,
        inputs=inputs,
    )
    res_by_product = PremiumCalculationService.evaluate_quote(
        session=db,
        product_id=product.id,
        inputs=inputs,
    )

    assert res_by_rt.net_premium == Decimal("40000.00")
    assert res_by_rt.total_taxes == Decimal("220.00")
    assert res_by_rt.total_premium == Decimal("40220.00")
    assert res_by_rt.rate_table_version_id == rt.id

    assert res_by_product.net_premium == res_by_rt.net_premium
    assert res_by_product.total_taxes == res_by_rt.total_taxes
    assert res_by_product.total_premium == res_by_rt.total_premium
    assert res_by_product.rate_table_version_id == rt.id


def test_evaluate_quote_excludes_tax_rate_rule_helpers_from_service() -> None:
    assert not hasattr(PremiumCalculationService, "create_tax_rate_rule")
    assert not hasattr(PremiumCalculationService, "get_tax_rate_rules")


def test_policy_and_renewal_is_selected_scoping(db: Session) -> None:
    product, rt = _create_product_and_rate_table(db)
    uid = uuid.uuid4().hex[:8]
    client = Client(
        name=f"Client {uid}",
        kra_pin=f"A{uid}Z",
        email=f"c_{uid}@example.com",
        phone="0700000000",
    )
    db.add(client)
    db.flush()

    policy = Policy(
        policy_number=f"POL-{uid}",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date(2025, 1, 1),
        expiry_date=date(2025, 12, 31),
    )
    db.add(policy)
    db.flush()

    renewal = Renewal(
        policy_id=policy.id,
        renewal_period_start=date(2026, 1, 1),
        renewal_period_end=date(2026, 12, 31),
    )
    db.add(renewal)
    db.commit()
    db.refresh(policy)
    db.refresh(renewal)

    # 1. Record Policy-level calc 1 (selected)
    pol_calc_1 = PremiumCalculationService.record_calculation(
        db,
        calc_in=PremiumCalculationCreate(
            policy_id=policy.id,
            business_event=BusinessEvent.NEW_BUSINESS,
            rating_date=date(2025, 1, 1),
            rate_table_version_id=rt.id,
            total_premium=Decimal("40220.00"),
            is_selected=True,
        ),
    )
    # 2. Record Renewal-level calc 1 (selected) -> should NOT unselect pol_calc_1
    ren_calc_1 = PremiumCalculationService.record_calculation(
        db,
        calc_in=PremiumCalculationCreate(
            policy_id=policy.id,
            renewal_id=renewal.id,
            business_event=BusinessEvent.RENEWAL,
            rating_date=date(2025, 12, 31),
            rate_table_version_id=rt.id,
            total_premium=Decimal("45000.00"),
            is_selected=True,
        ),
    )
    db.refresh(pol_calc_1)
    db.refresh(renewal)
    assert pol_calc_1.is_selected is True
    assert ren_calc_1.is_selected is True
    assert renewal.selected_calculation_id == ren_calc_1.id
    assert renewal.proposed_premium == Decimal("45000.00")

    # 3. Record Policy-level calc 2 (selected) -> unselects pol_calc_1, keeps ren_calc_1 selected!
    pol_calc_2 = PremiumCalculationService.record_calculation(
        db,
        calc_in=PremiumCalculationCreate(
            policy_id=policy.id,
            business_event=BusinessEvent.COVER_CHANGE,
            rating_date=date(2025, 6, 1),
            rate_table_version_id=rt.id,
            total_premium=Decimal("50000.00"),
            is_selected=True,
        ),
    )
    db.refresh(pol_calc_1)
    db.refresh(ren_calc_1)
    assert pol_calc_1.is_selected is False
    assert pol_calc_2.is_selected is True
    assert ren_calc_1.is_selected is True

    # 4. Record Renewal-level calc 2 (unselected) then select_calculation -> unselects ren_calc_1, syncs Renewal, keeps pol_calc_2 selected
    ren_calc_2 = PremiumCalculationService.record_calculation(
        db,
        calc_in=PremiumCalculationCreate(
            policy_id=policy.id,
            renewal_id=renewal.id,
            business_event=BusinessEvent.RENEWAL,
            rating_date=date(2025, 12, 31),
            rate_table_version_id=rt.id,
            total_premium=Decimal("48000.00"),
            is_selected=False,
        ),
    )
    PremiumCalculationService.select_calculation(db, calc_id=ren_calc_2.id)
    db.refresh(ren_calc_1)
    db.refresh(ren_calc_2)
    db.refresh(pol_calc_2)
    db.refresh(renewal)
    assert ren_calc_1.is_selected is False
    assert ren_calc_2.is_selected is True
    assert pol_calc_2.is_selected is True
    assert renewal.selected_calculation_id == ren_calc_2.id
    assert renewal.proposed_premium == Decimal("48000.00")


def test_policy_service_create_and_endorse_keep_single_selected_policy_calc(
    db: Session,
) -> None:
    from sqlmodel import select

    from app.models import PolicyCreate, PremiumCalculation
    from app.services.policy import PolicyService

    product, _rt = _create_product_and_rate_table(db)
    uid = uuid.uuid4().hex[:8]
    client = Client(
        name=f"Client {uid}",
        kra_pin=f"A{uid}Z",
        email=f"c_{uid}@example.com",
        phone="0700000000",
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    policy = PolicyService.create_policy(
        session=db,
        policy_in=PolicyCreate(
            policy_number=f"POL-{uid}",
            client_id=client.id,
            product_id=product.id,
            status=PolicyStatus.ACTIVE,
            inception_date=date(2025, 1, 1),
            expiry_date=date(2025, 12, 31),
        ),
        risk_details={
            "vehicle": {
                "registration_number": "KAA 123A",
                "make": "Toyota",
                "sum_insured": 1_000_000,
            }
        },
        coverage_start=date(2025, 1, 1),
        coverage_end=date(2025, 12, 31),
    )

    PolicyService.create_endorsement(
        session=db,
        policy_id=policy.id,
        effective_date=date(2025, 6, 1),
        change_description="Increase sum insured",
        updated_cover_snapshot={
            "vehicle": {
                "registration_number": "KAA 123A",
                "make": "Toyota",
                "sum_insured": 1_500_000,
            }
        },
    )

    calcs = db.exec(
        select(PremiumCalculation).where(
            PremiumCalculation.policy_id == policy.id,
            PremiumCalculation.renewal_id.is_(None),  # type: ignore[union-attr]
        )
    ).all()
    assert len(calcs) == 2
    selected = [c for c in calcs if c.is_selected]
    assert len(selected) == 1
    assert selected[0].business_event == BusinessEvent.COVER_CHANGE
