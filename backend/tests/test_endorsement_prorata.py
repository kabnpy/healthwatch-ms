from datetime import date
from decimal import Decimal

from app.services.policy import calculate_endorsement_prorata
from app.services.premium_calculation import (
    PremiumCalculationResult,
    normalize_rating_inputs,
    validate_risk_details,
)


def _make_result(
    *,
    net_premium: str,
    training_levy: str,
    phcf: str,
    stamp_duty: str,
    total_premium: str,
    commission_amount: str | None = "0.00",
) -> PremiumCalculationResult:
    return PremiumCalculationResult(
        basic_premium=Decimal(net_premium),
        net_premium=Decimal(net_premium),
        training_levy=Decimal(training_levy),
        phcf=Decimal(phcf),
        stamp_duty=Decimal(stamp_duty),
        total_taxes=Decimal(training_levy) + Decimal(phcf) + Decimal(stamp_duty),
        exact_total=Decimal(total_premium),
        total_premium=Decimal(total_premium),
        exempt_stamp_duty=False,
        pricing_method="PERCENTAGE",
        commission_amount=Decimal(commission_amount)
        if commission_amount is not None
        else None,
        rate_table_version_id=None,
        input_snapshot={},
        rule_provenance={},
        calculation_detail={},
    )


def test_prorata_midterm_increase():
    old_res = _make_result(
        net_premium="10000.00",
        training_levy="20.00",
        phcf="25.00",
        stamp_duty="40.00",
        total_premium="10085.00",
        commission_amount="1000.00",
    )
    new_res = _make_result(
        net_premium="20000.00",
        training_levy="40.00",
        phcf="50.00",
        stamp_duty="40.00",
        total_premium="20130.00",
        commission_amount="2000.00",
    )
    # 180 / 360 = 0.5 exact
    res = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=date(2026, 1, 1),
        coverage_end=date(2026, 12, 27),  # 360 days
        effective_date=date(2026, 6, 30),  # 180 days remaining
    )
    assert res["delta_net"] == Decimal("5000.00")
    assert res["delta_comm"] == Decimal("500.00")
    assert res["delta_levies"]["Training Levy"] == Decimal("10.00")
    assert res["delta_levies"]["PHCF"] == Decimal("12.50")
    assert res["delta_levies"]["Stamp Duty"] == Decimal("0.00")
    assert res["delta_total"] == Decimal("5022.50")
    assert res["financial_breakdown"]["prorata_info"]["remaining_days"] == "180" or res["financial_breakdown"]["prorata_info"]["remaining_days"] == 180


def test_prorata_boundary_day_counts():
    old_res = _make_result(
        net_premium="10000.00",
        training_levy="20.00",
        phcf="25.00",
        stamp_duty="40.00",
        total_premium="10085.00",
        commission_amount="1000.00",
    )
    new_res = _make_result(
        net_premium="15000.00",
        training_levy="30.00",
        phcf="37.50",
        stamp_duty="40.00",
        total_premium="15107.50",
        commission_amount="1500.00",
    )
    start = date(2026, 1, 1)
    end = date(2027, 1, 1)

    # Full term: effective_date == coverage_start
    full = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=start,
        coverage_end=end,
        effective_date=start,
    )
    assert full["delta_net"] == Decimal("5000.00")
    assert full["delta_comm"] == Decimal("500.00")

    # Zero remaining days: effective_date == coverage_end
    zero = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=start,
        coverage_end=end,
        effective_date=end,
    )
    assert zero["delta_net"] == Decimal("0.00")
    assert zero["delta_comm"] == Decimal("0.00")
    assert zero["delta_total"] == Decimal("0.00")

    # Past coverage_end: clamped to 0
    past = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=start,
        coverage_end=end,
        effective_date=date(2027, 2, 1),
    )
    assert past["delta_net"] == Decimal("0.00")
    assert past["delta_total"] == Decimal("0.00")

    # Zero-day policy: total_days clamped to 1
    same_day = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=start,
        coverage_end=start,
        effective_date=start,
    )
    assert same_day["delta_net"] == Decimal("0.00")


def test_prorata_coverage_reduction():
    old_res = _make_result(
        net_premium="20000.00",
        training_levy="40.00",
        phcf="50.00",
        stamp_duty="40.00",
        total_premium="20130.00",
        commission_amount="2000.00",
    )
    new_res = _make_result(
        net_premium="10000.00",
        training_levy="20.00",
        phcf="25.00",
        stamp_duty="40.00",
        total_premium="10085.00",
        commission_amount="1000.00",
    )
    res = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=date(2026, 1, 1),
        coverage_end=date(2026, 12, 27),  # 360 days
        effective_date=date(2026, 6, 30),  # 180 days remaining
    )
    assert res["delta_net"] == Decimal("-5000.00")
    assert res["delta_comm"] == Decimal("-500.00")
    assert res["delta_levies"]["Training Levy"] == Decimal("-10.00")
    assert res["delta_levies"]["PHCF"] == Decimal("-12.50")
    assert res["delta_total"] == Decimal("-5022.50")


def test_prorata_round_half_up():
    # 1 / 2 = 0.5; 0.01 * 0.5 = 0.005 -> ROUND_HALF_UP -> 0.01
    old_res = _make_result(
        net_premium="100.00",
        training_levy="0.00",
        phcf="0.00",
        stamp_duty="0.00",
        total_premium="100.00",
        commission_amount="0.00",
    )
    new_res = _make_result(
        net_premium="100.01",
        training_levy="0.00",
        phcf="0.00",
        stamp_duty="0.00",
        total_premium="100.01",
        commission_amount="0.00",
    )
    res = calculate_endorsement_prorata(
        old_result=old_res,
        new_result=new_res,
        coverage_start=date(2026, 1, 1),
        coverage_end=date(2026, 1, 3),  # 2 days
        effective_date=date(2026, 1, 2),  # 1 day remaining -> factor 0.5
    )
    assert res["delta_net"] == Decimal("0.01")


def test_normalize_rating_inputs_flattens_vehicle_sum_insured():
    inputs = {"vehicle": {"sum_insured": "1500000", "make": "Toyota"}}
    normalized = normalize_rating_inputs(inputs)
    assert normalized["sum_insured"] == "1500000"
    assert "sum_insured" not in inputs  # does not mutate caller dict


def test_validate_risk_details_passthrough_unknown_class():
    details = {"custom_field": "abc"}
    assert validate_risk_details("Unknown Class", details) == details
