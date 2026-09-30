from decimal import Decimal

from app.models import Product
from app.schemas import MotorFinancialBreakdown
from app.services.rating import RatingService


def test_motor_private_rating_logic():
    # Setup a mock or real product
    product = Product(
        name="Motor Private - Comprehensive",
        class_of_insurance="Motor Private",
        default_commission_rate=10.0,
    )

    risk_details = {
        "vehicle": {
            "sum_insured": 1000000.0,  # 1M
        },
        "extensions": {"pvt": True, "excess_protector": True},
    }

    # Expected math:
    # Tier for 1M: 5.0%, min 60,000
    # Basic Premium: 1M * 0.05 = 50,000.00 -> Min applied: 60,000.00
    # PVT: 1M * 0.0025 = 2,500.00
    # Excess Protector: 1M * 0.0025 = 2,500.00
    # Net Premium: 60,000 + 2,500 + 2,500 = 65,000.00

    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert isinstance(breakdown, MotorFinancialBreakdown)
    assert breakdown.net_premium == Decimal("65000.00")
    assert breakdown.taxes["training_levy"] == Decimal("130.00")
    assert breakdown.taxes["phcf"] == Decimal("162.50")
    assert breakdown.taxes["stamp_duty"] == Decimal("40.00")
    assert breakdown.total_amount == Decimal("65332.50")


def test_motor_private_om_rescue_plus():
    product = Product(
        name="Motor Private - Comprehensive",
        class_of_insurance="Motor Private",
        default_commission_rate=10.0,
    )

    risk_details = {
        "vehicle": {
            "sum_insured": 1000000.0,
        },
        "extensions": {"om_rescue_plus": True},
    }

    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.net_premium == Decimal("60000.00")
    assert breakdown.total_amount == Decimal("61310.00")
    assert any(b.name == "OM Rescue Plus" for b in breakdown.benefits)


def test_motor_private_high_end_inclusive():
    product = Product(
        name="Motor Private - Comprehensive",
        class_of_insurance="Motor Private",
        default_commission_rate=10.0,
    )

    risk_details = {
        "vehicle": {
            "sum_insured": 4000000.0,  # 4M
        },
        "extensions": {"pvt": True, "excess_protector": True},
    }

    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.is_high_end is True
    assert breakdown.net_premium == Decimal("130000.00")
    assert breakdown.total_amount == Decimal("130625.00")


def test_rating_service_robust_parsing():
    product = Product(
        name="Motor Private - Comprehensive",
        class_of_insurance="Motor Private",
        default_commission_rate=10.0,
    )

    # Test with formatted currency string
    risk_details_formatted = {
        "vehicle": {
            "sum_insured": "1,500,000.00",
        }
    }

    breakdown = RatingService.calculate_breakdown(product, risk_details_formatted)
    assert breakdown.net_premium == Decimal("75000.00")

    # Test with empty placeholder
    risk_details_empty = {
        "vehicle": {
            "sum_insured": "[ EMPTY ]",
        }
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details_empty)
    # Value is 0, so basic premium is 0, but min is 60,000.
    assert breakdown.net_premium == Decimal("60000.00")


def test_motor_private_tier_sorting():
    product = Product(
        name="Motor Private - Comprehensive",
        class_of_insurance="Motor Private",
        default_commission_rate=10.0,
        pricing_rules={
            "tiers": [
                {"max": 5000000, "rate": 3.25, "min": 0},
                {"max": 1500000, "rate": 5.0, "min": 60000},
                {"max": 2500000, "rate": 4.0, "min": 75000},
            ]
        },
    )

    risk_details = {"vehicle": {"sum_insured": 1000000.0}}
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.net_premium == Decimal("60000.00")
    assert breakdown.basic_rate == Decimal("0.05")


def test_manual_rating_strategy():
    from app.models import PricingStrategy

    product = Product(
        name="Special Product",
        class_of_insurance="Special",
        pricing_strategy=PricingStrategy.MANUAL,
        default_commission_rate=15.0,
    )

    risk_details = {
        "vehicle": {
            "sum_insured": 5000.0,
        }
    }

    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.net_premium == Decimal("5000.00")
    assert breakdown.total_amount > Decimal("5000.00")


def test_generic_fallback_with_rate():
    product = Product(
        name="Fire Insurance",
        class_of_insurance="Fire",
        pricing_rules={
            "rate": 0.5  # 0.5%
        },
    )

    risk_details = {
        "vehicle": {
            "sum_insured": 10000000.0  # 10M
        }
    }

    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.net_premium == Decimal("50000.00")


def test_rating_breakdown_types():
    product = Product(
        name="Motor Private - Comprehensive",
        class_of_insurance="Motor Private",
        default_commission_rate=10.0,
    )
    risk_details = {
        "vehicle": {
            "sum_insured": 1000000.0,
        },
        "extensions": {"pvt": True, "om_rescue_plus": True},
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert isinstance(breakdown.net_premium, Decimal)
    assert isinstance(breakdown.total_amount, Decimal)
    assert isinstance(breakdown.commission_amount, Decimal)
    for levy_val in breakdown.taxes.values():
        assert isinstance(levy_val, Decimal)
    for benefit in breakdown.benefits:
        assert isinstance(benefit.amount, Decimal)


def test_rating_fails_with_legacy_keys():
    product = Product(
        name="Fire Insurance", class_of_insurance="Fire", pricing_rules={"rate": 0.5}
    )

    # Using legacy key from old schema
    risk_details = {"Value Kshs.": 10000000.0}

    breakdown = RatingService.calculate_breakdown(product, risk_details)

    # Should result in 0 premium because sum_insured was not found
    assert breakdown.net_premium == Decimal("0.00")
