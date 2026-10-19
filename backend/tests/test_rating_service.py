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


def test_domestic_package_rating():
    product = Product(
        name="Domestic Package",
        class_of_insurance="Domestic Package",
        default_commission_rate=20.0,
    )
    risk_details = {
        "buildings_sum_insured": 10000000.0,
        "contents_sum_insured": 2000000.0,
        "all_risks_valuables": 500000.0,
        "domestic_servants_indoor": 2,
        "domestic_servants_outdoor": 1,
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "domestic"
    assert breakdown.net_premium == Decimal("38000.00")
    assert breakdown.taxes["training_levy"] == Decimal("76.00")
    assert breakdown.taxes["phcf"] == Decimal("95.00")
    assert breakdown.taxes["stamp_duty"] == Decimal("40.00")
    assert breakdown.total_amount == Decimal("38211.00")
    assert breakdown.commission_amount == Decimal("7600.00")
    assert breakdown.section_premiums["buildings"] == Decimal("12000.00")
    assert breakdown.section_premiums["contents"] == Decimal("15000.00")
    assert breakdown.section_premiums["all_risks"] == Decimal("7500.00")
    assert breakdown.section_premiums["domestic_servants"] == Decimal("3500.00")


def test_wiba_rating():
    product = Product(
        name="WIBA Workplace Cover",
        class_of_insurance="WIBA / Employers Liability",
        default_commission_rate=15.0,
    )
    risk_details = {
        "clerical_payroll": 5000000.0,
        "artisan_payroll": 2000000.0,
        "hazardous_payroll": 1000000.0,
        "employee_count": 15,
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "wiba"
    assert breakdown.net_premium == Decimal("90000.00")
    assert breakdown.taxes["training_levy"] == Decimal("180.00")
    assert breakdown.taxes["phcf"] == Decimal("225.00")
    assert breakdown.taxes["stamp_duty"] == Decimal("40.00")
    assert breakdown.total_amount == Decimal("90445.00")
    assert breakdown.commission_amount == Decimal("13500.00")
    assert breakdown.employee_count == 15


def test_fire_perils_rating():
    product = Product(
        name="Commercial Fire Policy",
        class_of_insurance="Fire & Perils",
        default_commission_rate=15.0,
    )
    risk_details = {
        "buildings_sum_insured": 20000000.0,
        "plant_machinery_sum_insured": 10000000.0,
        "stock_sum_insured": 5000000.0,
        "include_special_perils": True,
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "fire"
    assert breakdown.net_premium == Decimal("61250.00")
    assert breakdown.total_sum_insured == Decimal("35000000.00")
    assert breakdown.special_perils_included is True


def test_marine_cargo_rating():
    product = Product(
        name="Marine Cargo Policy",
        class_of_insurance="Marine Cargo",
        default_commission_rate=12.5,
    )
    risk_details = {
        "cif_value": 10000000.0,
        "clause": "Clause A",
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "marine"
    assert breakdown.cif_value == Decimal("10000000.00")
    assert breakdown.uplifted_value == Decimal("11000000.00")
    assert breakdown.net_premium == Decimal("55000.00")
    assert breakdown.commission_amount == Decimal("6875.00")


def test_medical_rating():
    product = Product(
        name="AfyaCare Family Medical",
        class_of_insurance="Medical",
        default_commission_rate=10.0,
    )
    risk_details = {
        "inpatient_limit": 1000000.0,
        "principal_age": 35,
        "has_spouse": True,
        "children_count": 2,
        "include_outpatient": True,
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "medical"
    assert breakdown.inpatient_limit == Decimal("1000000.00")
    # Base 35k + Spouse 28k + 2 Children 24k = 87k inpatient
    assert breakdown.inpatient_premium == Decimal("87000.00")
    assert breakdown.outpatient_premium == Decimal("25000.00")
    assert breakdown.net_premium == Decimal("112000.00")
    assert breakdown.family_size == 4
    assert breakdown.commission_amount == Decimal("11200.00")


def test_motor_third_party_rating():
    product = Product(
        name="Motor Private - Third Party Only (TPO)",
        class_of_insurance="Motor Third Party",
        default_commission_rate=10.0,
        pricing_rules={"flat_annual_tariff": 7500},
    )
    # TPO rating is independent of sum_insured or vehicle market value
    risk_details = {
        "vehicle": {
            "registration_number": "KDC 520Q",
            "make": "Toyota Vitz",
        }
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "motor"
    assert breakdown.net_premium == Decimal("7500.00")
    # Training Levy: 7500 * 0.002 = 15.00
    assert breakdown.taxes["training_levy"] == Decimal("15.00")
    # PHCF: 7500 * 0.0025 = 18.75
    assert breakdown.taxes["phcf"] == Decimal("18.75")
    # Stamp duty: 40.00
    assert breakdown.taxes["stamp_duty"] == Decimal("40.00")
    # Total: 7500 + 15 + 18.75 + 40 = 7573.75
    assert breakdown.total_amount == Decimal("7573.75")
    assert breakdown.commission_amount == Decimal("750.00")
    assert any("Cap 405" in b.name for b in breakdown.benefits)


def test_golfers_package_rating():
    product = Product(
        name="Golfers Comprehensive Package",
        class_of_insurance="Golfers",
        default_commission_rate=20.0,
        pricing_rules={"package_fee": 7500},
    )
    risk_details = {
        "client_name": "Dr. David Kiptoo",
        "home_club": "Muthaiga Golf Club",
    }
    breakdown = RatingService.calculate_breakdown(product, risk_details)

    assert breakdown.type == "base"
    assert breakdown.net_premium == Decimal("7500.00")
    assert breakdown.taxes["training_levy"] == Decimal("15.00")
    assert breakdown.taxes["phcf"] == Decimal("18.75")
    assert breakdown.taxes["stamp_duty"] == Decimal("40.00")
    assert breakdown.total_amount == Decimal("7573.75")
    assert breakdown.commission_amount == Decimal("1500.00")
