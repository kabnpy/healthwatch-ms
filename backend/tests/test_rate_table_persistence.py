from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    BenefitCalculationType,
    Client,
    Insurer,
    MedicalTierCreate,
    Policy,
    PolicyStatus,
    PremiumCalculationCreate,
    PricingMethod,
    Product,
    RateBenefitCreate,
    RateBracketCreate,
    RateTableStatus,
    RateTableVersionCreate,
    RateTableVersionUpdate,
    Renewal,
    RenewalStatus,
    TaxRateRuleCreate,
)
from app.services.premium_calculation import (
    count_premium_calculations,
    count_rate_table_versions,
    create_medical_tier,
    create_premium_calculation,
    create_rate_benefit,
    create_rate_bracket,
    create_rate_table_version,
    create_tax_rate_rule,
    get_premium_calculation,
    get_premium_calculations,
    get_rate_table_version,
    get_rate_table_versions,
    get_tax_rate_rules,
    update_rate_table_version,
)


def test_rate_table_version_and_children_persistence(db: Session) -> None:
    insurer = Insurer(name="Persistence Test Insurer")
    db.add(insurer)
    db.commit()
    db.refresh(insurer)

    rt_v1 = create_rate_table_version(
        session=db,
        rate_table_in=RateTableVersionCreate(
            insurer_id=insurer.id,
            class_of_insurance="Motor Private",
            pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
            version_number=1,
            source_reference="Tariff v1",
        ),
    )
    rt_v2 = create_rate_table_version(
        session=db,
        rate_table_in=RateTableVersionCreate(
            insurer_id=insurer.id,
            class_of_insurance="Medical",
            pricing_method=PricingMethod.PACKAGED,
            version_number=2,
            source_reference="Tariff v2",
        ),
    )

    create_rate_bracket(
        session=db,
        bracket_in=RateBracketCreate(
            rate_table_version_id=rt_v1.id,
            min_value=Decimal("0.00"),
            max_value=Decimal("1000000.00"),
            rate_percent=Decimal("0.0400"),
            minimum_premium=Decimal("30000.00"),
            display_label="0 - 1M",
        ),
    )
    create_rate_benefit(
        session=db,
        benefit_in=RateBenefitCreate(
            rate_table_version_id=rt_v1.id,
            code="PVT",
            name="Political Violence & Terrorism",
            calculation_type=BenefitCalculationType.PERCENTAGE,
            rate_value=Decimal("0.0025"),
        ),
    )
    create_medical_tier(
        session=db,
        tier_in=MedicalTierCreate(
            rate_table_version_id=rt_v2.id,
            tier_code="M+1",
            premium=Decimal("45000.00"),
            benefit_limits={"inpatient": "1000000"},
        ),
    )

    fetched_v1 = get_rate_table_version(session=db, rate_table_id=rt_v1.id)
    assert fetched_v1 is not None
    assert len(fetched_v1.brackets) == 1
    assert len(fetched_v1.benefits) == 1

    fetched_v2 = get_rate_table_version(session=db, rate_table_id=rt_v2.id)
    assert fetched_v2 is not None
    assert len(fetched_v2.medical_tiers) == 1

    updated_v1 = update_rate_table_version(
        session=db,
        db_rate_table=fetched_v1,
        rate_table_in=RateTableVersionUpdate(status=RateTableStatus.PUBLISHED),
    )
    assert updated_v1.status == RateTableStatus.PUBLISHED

    # Filter & count
    all_for_insurer = get_rate_table_versions(session=db, insurer_id=insurer.id)
    assert [rt.version_number for rt in all_for_insurer] == [2, 1]
    assert count_rate_table_versions(session=db, insurer_id=insurer.id) == 2
    assert (
        count_rate_table_versions(
            session=db, insurer_id=insurer.id, status=RateTableStatus.PUBLISHED
        )
        == 1
    )

    # Soft-deleted rate table is excluded from get and count
    rt_v2.deleted_at = datetime.now(UTC)
    db.add(rt_v2)
    db.commit()

    assert get_rate_table_version(session=db, rate_table_id=rt_v2.id) is None
    assert count_rate_table_versions(session=db, insurer_id=insurer.id) == 1


def test_tax_rate_rule_persistence_and_ordering(db: Session) -> None:
    create_tax_rate_rule(
        session=db,
        rule_in=TaxRateRuleCreate(
            code="PHCF_TEST",
            name="PHCF",
            rate_percent=Decimal("0.0025"),
            sequence_order=2,
            is_active=True,
        ),
    )
    create_tax_rate_rule(
        session=db,
        rule_in=TaxRateRuleCreate(
            code="TL_TEST",
            name="Training Levy",
            rate_percent=Decimal("0.0020"),
            sequence_order=1,
            is_active=True,
        ),
    )
    create_tax_rate_rule(
        session=db,
        rule_in=TaxRateRuleCreate(
            code="INACTIVE_TEST",
            name="Inactive Levy",
            rate_percent=Decimal("0.0100"),
            sequence_order=0,
            is_active=False,
        ),
    )

    active_rules = get_tax_rate_rules(session=db)
    codes = [r.code for r in active_rules if r.code.endswith("_TEST")]
    assert codes == ["TL_TEST", "PHCF_TEST"]


def test_premium_calculation_read_list_and_count(db: Session) -> None:
    insurer = Insurer(name="Calc Persistence Insurer")
    db.add(insurer)
    db.commit()
    db.refresh(insurer)

    client_obj = Client(
        name="Calc Test Client",
        kra_pin="A001234567B",
        phone="+254700000001",
    )
    product = Product(
        name="Motor Private",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
    )
    db.add_all([client_obj, product])
    db.commit()
    db.refresh(client_obj)
    db.refresh(product)

    policy = Policy(
        policy_number="POL-CALC-001",
        client_id=client_obj.id,
        product_id=product.id,
        inception_date=date(2026, 1, 1),
        expiry_date=date(2026, 12, 31),
        status=PolicyStatus.ACTIVE,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    renewal = Renewal(
        policy_id=policy.id,
        renewal_period_start=date(2027, 1, 1),
        renewal_period_end=date(2027, 12, 31),
        status=RenewalStatus.AWAITING_CARRIER,
    )
    db.add(renewal)
    db.commit()
    db.refresh(renewal)

    c1 = create_premium_calculation(
        session=db,
        calc_in=PremiumCalculationCreate(
            policy_id=policy.id,
            total_premium=Decimal("50000.00"),
            is_selected=True,
        ),
    )
    c2 = create_premium_calculation(
        session=db,
        calc_in=PremiumCalculationCreate(
            policy_id=policy.id,
            renewal_id=renewal.id,
            total_premium=Decimal("55000.00"),
            is_selected=False,
        ),
    )

    assert get_premium_calculation(session=db, calc_id=c1.id) is not None
    assert count_premium_calculations(session=db, policy_id=policy.id) == 2
    assert count_premium_calculations(session=db, renewal_id=renewal.id) == 1

    policy_calcs = get_premium_calculations(session=db, policy_id=policy.id)
    assert len(policy_calcs) == 2
    renewal_calcs = get_premium_calculations(session=db, renewal_id=renewal.id)
    assert [c.id for c in renewal_calcs] == [c2.id]


def test_rate_tables_and_calculations_routes_without_crud(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    insurer = Insurer(name="Route Test Insurer")
    client_obj = Client(
        name="Route Test Client",
        kra_pin="A009876543B",
        phone="+254700000002",
    )
    db.add_all([insurer, client_obj])
    db.commit()
    db.refresh(insurer)
    db.refresh(client_obj)

    product = Product(
        name="Medical Packaged",
        class_of_insurance="Medical",
        insurer_id=insurer.id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    policy = Policy(
        policy_number="POL-ROUTE-001",
        client_id=client_obj.id,
        product_id=product.id,
        inception_date=date(2026, 1, 1),
        expiry_date=date(2026, 12, 31),
        status=PolicyStatus.ACTIVE,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    # Create rate table via route
    rt_resp = client.post(
        f"{settings.API_V1_STR}/rate-tables/",
        headers=superuser_token_headers,
        json={
            "insurer_id": str(insurer.id),
            "class_of_insurance": "Medical",
            "pricing_method": PricingMethod.PACKAGED.value,
            "currency": "KES",
            "version_number": 1,
            "source_reference": "Route Tariff 2026",
        },
    )
    assert rt_resp.status_code == 201
    rt_id = rt_resp.json()["id"]

    # Add medical tier via route
    tier_resp = client.post(
        f"{settings.API_V1_STR}/rate-tables/{rt_id}/medical-tiers",
        headers=superuser_token_headers,
        json={
            "rate_table_version_id": rt_id,
            "tier_code": "M",
            "premium": 30000.00,
            "benefit_limits": {"inpatient": 500000},
        },
    )
    assert tier_resp.status_code == 201

    # Publish via PATCH
    patch_resp = client.patch(
        f"{settings.API_V1_STR}/rate-tables/{rt_id}",
        headers=superuser_token_headers,
        json={"status": RateTableStatus.PUBLISHED.value},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == RateTableStatus.PUBLISHED.value

    # List and get single rate table
    list_resp = client.get(
        f"{settings.API_V1_STR}/rate-tables/?insurer_id={insurer.id}",
        headers=superuser_token_headers,
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["count"] == 1

    get_resp = client.get(
        f"{settings.API_V1_STR}/rate-tables/{rt_id}",
        headers=superuser_token_headers,
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == rt_id

    # Quote preview via calculations route
    quote_resp = client.post(
        f"{settings.API_V1_STR}/calculations/quote",
        headers=superuser_token_headers,
        json={"rate_table_id": rt_id, "inputs": {"tier_code": "M"}},
    )
    assert quote_resp.status_code == 200
    assert Decimal(str(quote_resp.json()["net_premium"])) == Decimal("30000.00")

    # Persist calculation, list, get, select
    create_calc_resp = client.post(
        f"{settings.API_V1_STR}/calculations/",
        headers=superuser_token_headers,
        json={
            "rate_table_id": rt_id,
            "policy_id": str(policy.id),
            "inputs": {"tier_code": "M"},
            "is_selected": False,
        },
    )
    assert create_calc_resp.status_code == 201
    calc_id = create_calc_resp.json()["id"]

    list_calc_resp = client.get(
        f"{settings.API_V1_STR}/calculations/?policy_id={policy.id}",
        headers=superuser_token_headers,
    )
    assert list_calc_resp.status_code == 200
    assert list_calc_resp.json()["count"] == 1

    get_calc_resp = client.get(
        f"{settings.API_V1_STR}/calculations/{calc_id}",
        headers=superuser_token_headers,
    )
    assert get_calc_resp.status_code == 200

    select_resp = client.post(
        f"{settings.API_V1_STR}/calculations/{calc_id}/select",
        headers=superuser_token_headers,
    )
    assert select_resp.status_code == 200
    assert select_resp.json()["is_selected"] is True
