import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from app.models import (
    BenefitCalculationType,
    MedicalTier,
    PricingMethod,
    PricingStrategy,
    Product,
    RateBenefit,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
)
from app.services.premium_calculation import (
    PremiumCalculationResult,
    RatingValidationError,
    calculate_premium,
)


def _make_rate_table(
    *,
    pricing_method: PricingMethod,
    class_of_insurance: str = "Motor Private",
    brackets: list[RateBracket] | None = None,
    benefits: list[RateBenefit] | None = None,
) -> RateTableVersion:
    rt_id = uuid.uuid4()
    rt = RateTableVersion(
        id=rt_id,
        insurer_id=uuid.uuid4(),
        class_of_insurance=class_of_insurance,
        pricing_method=pricing_method,
        status=RateTableStatus.PUBLISHED,
        version_number=1,
        effective_from=date(2025, 1, 1),
        source_reference="Test Schedule",
    )
    rt.brackets = brackets or []
    rt.benefits = benefits or []
    rt.medical_tiers = []
    return rt


def test_bracketed_percentage_with_benefits_and_levies() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        class_of_insurance="Motor Private",
        brackets=[
            RateBracket(
                rate_table_version_id=uuid.uuid4(),
                min_value=Decimal("500000.00"),
                max_value=Decimal("1500000.00"),
                rate_percent=Decimal("0.0500"),
                minimum_premium=Decimal("60000.00"),
                display_label="500k - 1.5M",
            )
        ],
        benefits=[
            RateBenefit(
                rate_table_version_id=uuid.uuid4(),
                code="PVT",
                name="Political Violence & Terrorism",
                calculation_type=BenefitCalculationType.PERCENTAGE,
                rate_value=Decimal("0.0025"),
                is_mandatory=False,
            ),
            RateBenefit(
                rate_table_version_id=uuid.uuid4(),
                code="EP",
                name="Excess Protector",
                calculation_type=BenefitCalculationType.PERCENTAGE,
                rate_value=Decimal("0.0025"),
                is_mandatory=False,
            ),
        ],
    )

    result = calculate_premium(
        rate_table=rt,
        inputs={"sum_insured": "1000000.00", "selected_benefits": ["PVT", "EP"]},
        commission_rate=Decimal("10.0"),
    )

    assert isinstance(result, PremiumCalculationResult)
    # 1,000,000 * 0.05 = 50,000 -> min 60,000
    assert result.basic_premium == Decimal("60000.00")
    # PVT: 2,500 + EP: 2,500 -> net = 65,000.00
    assert result.net_premium == Decimal("65000.00")
    # ITL 0.20% = 130.00, PHCF 0.25% = 162.50, Stamp Duty = 40.00
    assert result.training_levy == Decimal("130.00")
    assert result.phcf == Decimal("162.50")
    assert result.stamp_duty == Decimal("40.00")
    assert result.total_taxes == Decimal("332.50")
    assert result.total_premium == Decimal("65332.50")
    assert result.exempt_stamp_duty is False
    assert result.commission_amount == Decimal("6500.00")


def test_bracketed_percentage_halts_on_out_of_range_input() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        brackets=[
            RateBracket(
                rate_table_version_id=uuid.uuid4(),
                min_value=Decimal("500000.00"),
                max_value=Decimal("1500000.00"),
                rate_percent=Decimal("0.0500"),
                minimum_premium=Decimal("60000.00"),
                display_label="500k - 1.5M",
            )
        ],
    )

    # Half-open [min_value, max_value): max_value itself is out of range
    with pytest.raises(RatingValidationError, match="outside configured"):
        calculate_premium(rate_table=rt, inputs={"sum_insured": "1500000.00"})

    with pytest.raises(RatingValidationError, match="outside configured"):
        calculate_premium(rate_table=rt, inputs={"sum_insured": "499999.99"})


def test_fixed_tier_calculation() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.FIXED_TIER,
        class_of_insurance="Motor Private",
        brackets=[
            RateBracket(
                rate_table_version_id=uuid.uuid4(),
                min_value=Decimal("0.00"),
                max_value=None,
                rate_percent=Decimal("0.0000"),
                minimum_premium=Decimal("7500.00"),
                display_label="TPO Annual",
            )
        ],
    )
    result = calculate_premium(rate_table=rt, inputs={})
    assert result.net_premium == Decimal("7500.00")
    assert result.training_levy == Decimal("15.00")
    assert result.phcf == Decimal("18.75")
    assert result.stamp_duty == Decimal("40.00")
    assert result.total_premium == Decimal("7573.75")


def test_multi_component_calculation() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.MULTI_COMPONENT,
        class_of_insurance="Domestic Package",
    )
    result = calculate_premium(
        rate_table=rt,
        inputs={
            "buildings_sum_insured": "5000000",
            "contents_sum_insured": "1000000",
            "all_risks_valuables": "200000",
            "domestic_servants_count": 2,
        },
    )
    # 5M * 0.0012 = 6000; 1M * 0.0075 = 7500; 200k * 0.015 = 3000; 2 * 1000 = 2000 -> 18500
    assert result.net_premium == Decimal("18500.00")
    assert result.total_premium == Decimal("18623.25")


def test_packaged_medical_exempts_stamp_duty_and_halts_on_missing_tier() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.PACKAGED,
        class_of_insurance="Medical",
    )
    rt.medical_tiers = [
        MedicalTier(
            rate_table_version_id=rt.id,
            tier_code="M+2",
            benefit_limits={"inpatient": 1000000},
            premium=Decimal("88000.00"),
        )
    ]

    result = calculate_premium(
        rate_table=rt,
        inputs={"members": [{"role": "principal"}, {"role": "spouse"}, {"role": "child"}]},
    )
    assert result.net_premium == Decimal("88000.00")
    assert result.stamp_duty == Decimal("0.00")
    assert result.exempt_stamp_duty is True
    assert result.total_premium == Decimal("88396.00")

    with pytest.raises(RatingValidationError, match="Medical tier"):
        calculate_premium(rate_table=rt, inputs={"tier_code": "M+5"})


def test_wage_roll_calculation() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.WAGE_ROLL,
        class_of_insurance="WIBA / Employers Liability",
    )
    result = calculate_premium(
        rate_table=rt,
        inputs={
            "clerical_payroll": "2000000",
            "artisan_payroll": "1000000",
            "hazardous_payroll": "500000",
        },
    )
    # 2M * 0.005 = 10000; 1M * 0.015 = 15000; 500k * 0.035 = 17500 -> 42500
    assert result.net_premium == Decimal("42500.00")
    assert result.total_premium == Decimal("42731.25")


def test_limit_of_indemnity_calculation() -> None:
    rt = _make_rate_table(
        pricing_method=PricingMethod.LIMIT_OF_INDEMNITY,
        class_of_insurance="Fire & Perils",
    )
    result = calculate_premium(
        rate_table=rt,
        inputs={
            "limit_of_indemnity": "10000000",
            "rate_percent": "0.0040",
            "minimum_premium": "30000.00",
        },
    )
    assert result.net_premium == Decimal("40000.00")
    assert result.total_premium == Decimal("40220.00")


def test_manual_override_path_and_validation() -> None:
    manual_product = Product(
        name="Bespoke Commercial",
        class_of_insurance="Fire & Perils",
        pricing_strategy=PricingStrategy.MANUAL,
        default_commission_rate=12.5,
    )

    result = calculate_premium(
        product=manual_product,
        inputs={"manual_net_premium": "100000.00"},
        manual_net_premium=Decimal("100000.00"),
    )
    assert result.net_premium == Decimal("100000.00")
    assert result.training_levy == Decimal("200.00")
    assert result.phcf == Decimal("250.00")
    assert result.stamp_duty == Decimal("40.00")
    assert result.total_premium == Decimal("100490.00")
    assert result.commission_amount == Decimal("12500.00")
    assert result.rate_table_version_id is None

    with pytest.raises(RatingValidationError, match="manual net premium"):
        calculate_premium(product=manual_product, inputs={})

    with pytest.raises(RatingValidationError, match="manual net premium"):
        calculate_premium(
            product=manual_product,
            inputs={},
            manual_net_premium=Decimal("-500.00"),
        )


def test_product_resolution_selects_latest_published_within_effective_dates(
    db: Any,
) -> None:
    from app.models import Insurer

    insurer = Insurer(name="Resolution Test Insurer")
    db.add(insurer)
    db.commit()
    db.refresh(insurer)

    product = Product(
        name="Motor Private Comprehensive",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        pricing_strategy=PricingStrategy.PERCENTAGE,
        default_commission_rate=10.0,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # No published rate table yet -> must halt
    with pytest.raises(RatingValidationError, match="No published RateTableVersion"):
        calculate_premium(
            product=product,
            inputs={"sum_insured": "1000000.00"},
            session=db,
            as_of_date=date(2025, 6, 1),
        )

    # Add v1 PUBLISHED, v2 DRAFT, v3 PUBLISHED (future effective_from)
    rt_v1 = RateTableVersion(
        insurer_id=insurer.id,
        class_of_insurance="Motor Private",
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        status=RateTableStatus.PUBLISHED,
        version_number=1,
        effective_from=date(2025, 1, 1),
        source_reference="v1",
    )
    rt_v2_draft = RateTableVersion(
        insurer_id=insurer.id,
        class_of_insurance="Motor Private",
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        status=RateTableStatus.DRAFT,
        version_number=2,
        effective_from=date(2025, 1, 1),
        source_reference="v2 draft",
    )
    rt_v3_future = RateTableVersion(
        insurer_id=insurer.id,
        class_of_insurance="Motor Private",
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        status=RateTableStatus.PUBLISHED,
        version_number=3,
        effective_from=date(2026, 1, 1),
        source_reference="v3 future",
    )
    db.add_all([rt_v1, rt_v2_draft, rt_v3_future])
    db.commit()
    db.refresh(rt_v1)

    bracket_v1 = RateBracket(
        rate_table_version_id=rt_v1.id,
        min_value=Decimal("500000.00"),
        max_value=Decimal("2000000.00"),
        rate_percent=Decimal("0.0450"),
        minimum_premium=Decimal("50000.00"),
        display_label="500k - 2M",
    )
    db.add(bracket_v1)
    db.commit()

    result = calculate_premium(
        product=product,
        inputs={"sum_insured": "1000000.00"},
        session=db,
        as_of_date=date(2025, 6, 1),
    )
    assert result.rate_table_version_id == rt_v1.id
    assert result.net_premium == Decimal("50000.00")
    assert result.commission_amount == Decimal("5000.00")
