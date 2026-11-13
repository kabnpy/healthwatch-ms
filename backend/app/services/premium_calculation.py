from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlmodel import Session, func, select

from app.models import (
    BenefitCalculationType,
    PremiumCalculation,
    PremiumCalculationCreate,
    PricingMethod,
    PricingStrategy,
    Product,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
    Renewal,
    TaxRateRule,
    TaxRateRuleCreate,
)
from app.utils import parse_decimal

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
TRAINING_LEVY_RATE = Decimal("0.0020")
PHCF_RATE = Decimal("0.0025")
STAMP_DUTY_AMOUNT = Decimal("40.00")


class RatingValidationError(ValueError):
    """Raised when rating inputs or rate table configuration fail validation."""


@dataclass(frozen=True)
class PremiumCalculationResult:
    """Typed output of the unified PremiumCalculation rating module."""

    net_premium: Decimal
    basic_premium: Decimal
    training_levy: Decimal
    phcf: Decimal
    stamp_duty: Decimal
    total_taxes: Decimal
    exact_total: Decimal
    total_premium: Decimal
    exempt_stamp_duty: bool
    commission_amount: Decimal | None
    rate_table_version_id: uuid.UUID | None
    pricing_method: PricingMethod | None
    calculation_detail: dict[str, Any]
    rule_provenance: dict[str, Any]
    input_snapshot: dict[str, Any]


def _quantize_cent(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _is_medical_class(class_of_insurance: str) -> bool:
    lowered = class_of_insurance.lower()
    return "medical" in lowered or "health" in lowered


def _find_bracket(brackets: list[RateBracket], value: Decimal) -> RateBracket:
    sorted_brackets = sorted(brackets, key=lambda b: b.min_value)
    for bracket in sorted_brackets:
        if value >= bracket.min_value and (
            bracket.max_value is None or value < bracket.max_value
        ):
            return bracket
    raise RatingValidationError(
        f"Input value {value} falls outside configured [min_value, max_value) brackets."
    )


def _evaluate_benefits(
    rate_table: RateTableVersion,
    sum_insured: Decimal,
    inputs: dict[str, Any],
) -> tuple[Decimal, list[dict[str, Any]]]:
    benefits_list: list[dict[str, Any]] = []
    benefit_total = ZERO
    raw_selected = inputs.get("selected_benefits", [])
    if isinstance(raw_selected, dict):
        selected_codes = {k for k, v in raw_selected.items() if v}
    else:
        selected_codes = set(raw_selected)

    for benefit in rate_table.benefits:
        if not (benefit.is_mandatory or benefit.code in selected_codes):
            continue

        if (
            benefit.is_complimentary
            and benefit.complimentary_threshold is not None
            and sum_insured >= benefit.complimentary_threshold
        ):
            benefits_list.append(
                {
                    "code": benefit.code,
                    "name": benefit.name,
                    "amount": "0.00",
                    "status": "complimentary",
                }
            )
            continue

        if benefit.calculation_type == BenefitCalculationType.PERCENTAGE:
            b_amount = _quantize_cent(sum_insured * benefit.rate_value)
        else:
            b_amount = _quantize_cent(benefit.rate_value)

        benefit_total += b_amount
        benefits_list.append(
            {
                "code": benefit.code,
                "name": benefit.name,
                "amount": str(b_amount),
                "status": "applied",
            }
        )

    return _quantize_cent(benefit_total), benefits_list


def _calculate_bracketed_percentage(
    rate_table: RateTableVersion, inputs: dict[str, Any]
) -> dict[str, Any]:
    sum_insured = parse_decimal(inputs.get("sum_insured", 0))
    if sum_insured < 0:
        raise RatingValidationError("Sum insured must be non-negative.")

    applied_bracket = _find_bracket(rate_table.brackets, sum_insured)
    computed_basic = _quantize_cent(sum_insured * applied_bracket.rate_percent)
    basic_premium = max(computed_basic, _quantize_cent(applied_bracket.minimum_premium))
    bracket_info = {
        "display_label": applied_bracket.display_label,
        "rate_percent": str(applied_bracket.rate_percent),
        "minimum_premium": str(applied_bracket.minimum_premium),
    }

    benefit_total, benefits_list = _evaluate_benefits(rate_table, sum_insured, inputs)
    net_premium = _quantize_cent(basic_premium + benefit_total)

    return {
        "basic_premium": basic_premium,
        "net_premium": net_premium,
        "components": [
            {
                "name": "Basic Comprehensive Premium",
                "sum_insured": str(sum_insured),
                "amount": str(basic_premium),
            }
        ],
        "benefits": benefits_list,
        "applied_bracket": bracket_info,
    }


def _calculate_fixed_tier(
    rate_table: RateTableVersion, _inputs: dict[str, Any]
) -> dict[str, Any]:
    if not rate_table.brackets:
        raise RatingValidationError("Fixed tier rate table has no configured brackets.")
    tariff_amount = _quantize_cent(rate_table.brackets[0].minimum_premium)
    return {
        "basic_premium": tariff_amount,
        "net_premium": tariff_amount,
        "components": [
            {
                "name": "Fixed Tariff Statutory Premium",
                "amount": str(tariff_amount),
            }
        ],
        "benefits": [],
    }


def _calculate_multi_component(
    _rate_table: RateTableVersion, inputs: dict[str, Any]
) -> dict[str, Any]:
    buildings_si = parse_decimal(inputs.get("buildings_sum_insured", 0))
    contents_si = parse_decimal(inputs.get("contents_sum_insured", 0))
    all_risks_si = parse_decimal(inputs.get("all_risks_valuables", 0))
    servants_count = int(inputs.get("domestic_servants_count", 0))

    buildings_premium = _quantize_cent(buildings_si * Decimal("0.0012"))
    contents_premium = _quantize_cent(contents_si * Decimal("0.0075"))
    all_risks_premium = _quantize_cent(all_risks_si * Decimal("0.0150"))
    servants_premium = _quantize_cent(Decimal(str(servants_count)) * Decimal("1000.00"))

    net_premium = _quantize_cent(
        buildings_premium + contents_premium + all_risks_premium + servants_premium
    )
    return {
        "basic_premium": net_premium,
        "net_premium": net_premium,
        "components": [
            {
                "name": "Buildings",
                "sum_insured": str(buildings_si),
                "amount": str(buildings_premium),
            },
            {
                "name": "Contents",
                "sum_insured": str(contents_si),
                "amount": str(contents_premium),
            },
            {
                "name": "All Risks Valuables",
                "sum_insured": str(all_risks_si),
                "amount": str(all_risks_premium),
            },
            {
                "name": "Domestic Servants (WIBA)",
                "count": servants_count,
                "amount": str(servants_premium),
            },
        ],
        "benefits": [],
    }


def _calculate_packaged_medical(
    rate_table: RateTableVersion, inputs: dict[str, Any]
) -> dict[str, Any]:
    tier_code = inputs.get("tier_code")
    census_members = inputs.get("members", [])
    if not tier_code and census_members:
        count = len(census_members)
        tier_code = "M" if count <= 1 else f"M+{count - 1}"

    if not tier_code:
        raise RatingValidationError("Medical tier_code or members census is required.")

    tier_match = next(
        (
            t
            for t in rate_table.medical_tiers
            if t.tier_code.upper() == str(tier_code).upper()
        ),
        None,
    )
    if tier_match is None:
        raise RatingValidationError(
            f"Medical tier '{tier_code}' not found in rate table."
        )

    premium = _quantize_cent(tier_match.premium)
    return {
        "basic_premium": premium,
        "net_premium": premium,
        "components": [
            {
                "name": f"Medical Tier Census: {tier_code}",
                "tier_code": tier_code,
                "amount": str(premium),
                "benefit_limits": tier_match.benefit_limits,
            }
        ],
        "benefits": [],
    }


def _calculate_wage_roll(
    _rate_table: RateTableVersion, inputs: dict[str, Any]
) -> dict[str, Any]:
    clerical_payroll = parse_decimal(inputs.get("clerical_payroll", 0))
    artisan_payroll = parse_decimal(inputs.get("artisan_payroll", 0))
    hazardous_payroll = parse_decimal(inputs.get("hazardous_payroll", 0))

    clerical_p = _quantize_cent(clerical_payroll * Decimal("0.0050"))
    artisan_p = _quantize_cent(artisan_payroll * Decimal("0.0150"))
    hazardous_p = _quantize_cent(hazardous_payroll * Decimal("0.0350"))

    computed = _quantize_cent(clerical_p + artisan_p + hazardous_p)
    net_premium = max(computed, Decimal("25000.00"))
    return {
        "basic_premium": computed,
        "net_premium": net_premium,
        "components": [
            {
                "name": "Clerical Payroll",
                "declared_payroll": str(clerical_payroll),
                "amount": str(clerical_p),
            },
            {
                "name": "Artisan Payroll",
                "declared_payroll": str(artisan_payroll),
                "amount": str(artisan_p),
            },
            {
                "name": "Hazardous Payroll",
                "declared_payroll": str(hazardous_payroll),
                "amount": str(hazardous_p),
            },
        ],
        "benefits": [],
    }


def _calculate_limit_of_indemnity(
    _rate_table: RateTableVersion, inputs: dict[str, Any]
) -> dict[str, Any]:
    limit = parse_decimal(inputs.get("limit_of_indemnity", 10000000))
    rate_percent = parse_decimal(inputs.get("rate_percent", Decimal("0.0040")))
    min_premium = parse_decimal(inputs.get("minimum_premium", Decimal("30000.00")))

    computed = _quantize_cent(limit * rate_percent)
    net_premium = max(computed, _quantize_cent(min_premium))
    return {
        "basic_premium": computed,
        "net_premium": net_premium,
        "components": [
            {
                "name": "Limit of Indemnity Base",
                "limit": str(limit),
                "amount": str(net_premium),
            }
        ],
        "benefits": [],
    }


def _compute_levies_and_result(
    *,
    basic_premium: Decimal,
    net_premium: Decimal,
    class_of_insurance: str,
    components: list[dict[str, Any]],
    benefits: list[dict[str, Any]],
    applied_bracket: dict[str, Any] | None,
    rate_table: RateTableVersion | None,
    inputs: dict[str, Any],
    commission_rate: Decimal | float | None,
) -> PremiumCalculationResult:
    exempt_stamp_duty = _is_medical_class(class_of_insurance)
    training_levy = _quantize_cent(net_premium * TRAINING_LEVY_RATE)
    phcf = _quantize_cent(net_premium * PHCF_RATE)
    stamp_duty = ZERO if exempt_stamp_duty else STAMP_DUTY_AMOUNT
    total_taxes = _quantize_cent(training_levy + phcf + stamp_duty)
    exact_total = _quantize_cent(net_premium + total_taxes)
    total_premium = exact_total

    commission_amount: Decimal | None = None
    if commission_rate is not None:
        rate_dec = parse_decimal(commission_rate)
        commission_amount = _quantize_cent(net_premium * (rate_dec / Decimal("100")))

    taxes_dict = {
        "training_levy": str(training_levy),
        "phcf": str(phcf),
        "stamp_duty": str(stamp_duty),
        "total_taxes": str(total_taxes),
        "stamp_duty_exempt": exempt_stamp_duty,
    }

    calculation_detail = {
        "components": components,
        "benefits": benefits,
        "basic_premium": str(basic_premium),
        "net_premium": str(net_premium),
        "taxes": taxes_dict,
        "exact_total": str(exact_total),
        "total_premium": str(total_premium),
    }

    rule_provenance = {
        "rate_table_version_id": str(rate_table.id) if rate_table and rate_table.id else None,
        "version_number": rate_table.version_number if rate_table else None,
        "pricing_method": rate_table.pricing_method.value if rate_table else "manual",
        "class_of_insurance": class_of_insurance,
        "applied_bracket": applied_bracket,
        "source_reference": rate_table.source_reference if rate_table else "Manual Override",
    }

    return PremiumCalculationResult(
        net_premium=net_premium,
        basic_premium=basic_premium,
        training_levy=training_levy,
        phcf=phcf,
        stamp_duty=stamp_duty,
        total_taxes=total_taxes,
        exact_total=exact_total,
        total_premium=total_premium,
        exempt_stamp_duty=exempt_stamp_duty,
        commission_amount=commission_amount,
        rate_table_version_id=rate_table.id if rate_table else None,
        pricing_method=rate_table.pricing_method if rate_table else None,
        calculation_detail=calculation_detail,
        rule_provenance=rule_provenance,
        input_snapshot=inputs,
    )


def _resolve_rate_table(
    *,
    product: Product,
    session: Session | None,
    as_of_date: date | None,
) -> RateTableVersion:
    if session is None:
        raise RatingValidationError(
            "A database session is required to resolve a published RateTableVersion for a Product."
        )
    if product.insurer_id is None:
        raise RatingValidationError(
            f"Product '{product.name}' has no insurer_id to resolve a RateTableVersion."
        )

    effective_date = as_of_date or date.today()
    stmt = (
        select(RateTableVersion)
        .where(
            RateTableVersion.insurer_id == product.insurer_id,
            RateTableVersion.class_of_insurance == product.class_of_insurance,
            RateTableVersion.status == RateTableStatus.PUBLISHED,
            RateTableVersion.effective_from <= effective_date,
        )
        .order_by(RateTableVersion.version_number.desc())  # type: ignore[attr-defined]
    )
    candidates = session.exec(stmt).all()
    for candidate in candidates:
        if candidate.effective_to is None or candidate.effective_to >= effective_date:
            return candidate

    raise RatingValidationError(
        f"No published RateTableVersion found for insurer_id={product.insurer_id} "
        f"and class_of_insurance='{product.class_of_insurance}' as of {effective_date}."
    )


def calculate_premium(
    *,
    inputs: dict[str, Any],
    rate_table: RateTableVersion | None = None,
    product: Product | None = None,
    session: Session | None = None,
    as_of_date: date | None = None,
    manual_net_premium: Decimal | float | str | None = None,
    commission_rate: Decimal | float | None = None,
    validate_inputs: bool = True,
) -> PremiumCalculationResult:
    """Evaluate a premium calculation using a RateTableVersion or Product."""
    effective_commission_rate = (
        commission_rate
        if commission_rate is not None
        else (product.default_commission_rate if product is not None else None)
    )

    class_of_insurance = (
        rate_table.class_of_insurance
        if rate_table is not None
        else (product.class_of_insurance if product is not None else None)
    )

    working_inputs = inputs
    if validate_inputs and class_of_insurance is not None:
        try:
            working_inputs = validate_risk_details(class_of_insurance, working_inputs)
        except RatingValidationError:
            raise
        except Exception as e:
            raise RatingValidationError(str(e)) from e

    normalized_inputs = normalize_rating_inputs(working_inputs)
    effective_manual_net_premium = (
        manual_net_premium
        if manual_net_premium is not None
        else normalized_inputs.get("manual_net_premium")
    )

    if (
        rate_table is None
        and product is not None
        and product.pricing_strategy == PricingStrategy.MANUAL
    ):
        if effective_manual_net_premium is None:
            raise RatingValidationError(
                "A valid manual net premium is required for MANUAL pricing_strategy products."
            )
        manual_dec = _quantize_cent(parse_decimal(effective_manual_net_premium))
        if manual_dec <= ZERO:
            raise RatingValidationError(
                "A valid positive manual net premium is required for MANUAL pricing_strategy products."
            )
        return _compute_levies_and_result(
            basic_premium=manual_dec,
            net_premium=manual_dec,
            class_of_insurance=product.class_of_insurance,
            components=[{"name": "Manual Net Premium", "amount": str(manual_dec)}],
            benefits=[],
            applied_bracket=None,
            rate_table=None,
            inputs=normalized_inputs,
            commission_rate=effective_commission_rate,
        )

    if rate_table is None:
        if product is None:
            raise RatingValidationError("Either rate_table or product must be provided.")
        rate_table = _resolve_rate_table(
            product=product, session=session, as_of_date=as_of_date
        )

    method = rate_table.pricing_method
    if method == PricingMethod.BRACKETED_PERCENTAGE:
        calc_result = _calculate_bracketed_percentage(rate_table, normalized_inputs)
    elif method == PricingMethod.FIXED_TIER:
        calc_result = _calculate_fixed_tier(rate_table, normalized_inputs)
    elif method == PricingMethod.MULTI_COMPONENT:
        calc_result = _calculate_multi_component(rate_table, normalized_inputs)
    elif method == PricingMethod.PACKAGED:
        calc_result = _calculate_packaged_medical(rate_table, normalized_inputs)
    elif method == PricingMethod.WAGE_ROLL:
        calc_result = _calculate_wage_roll(rate_table, normalized_inputs)
    elif method == PricingMethod.LIMIT_OF_INDEMNITY:
        calc_result = _calculate_limit_of_indemnity(rate_table, normalized_inputs)
    else:
        raise RatingValidationError(f"Unsupported pricing method: {method}")

    return _compute_levies_and_result(
        basic_premium=calc_result["basic_premium"],
        net_premium=calc_result["net_premium"],
        class_of_insurance=rate_table.class_of_insurance,
        components=calc_result["components"],
        benefits=calc_result.get("benefits", []),
        applied_bracket=calc_result.get("applied_bracket"),
        rate_table=rate_table,
        inputs=normalized_inputs,
        commission_rate=effective_commission_rate,
    )


def validate_risk_details(
    class_of_insurance: str, risk_details: dict[str, Any]
) -> dict[str, Any]:
    """Validate class-specific risk details against their Pydantic schema when applicable."""
    class_name = class_of_insurance.lower()
    if "motor private" in class_name:
        from app.schemas import MotorPrivateRiskDetails

        return MotorPrivateRiskDetails(**risk_details).model_dump(mode="python")
    if "domestic" in class_name and any(
        k in risk_details
        for k in (
            "buildings_sum_insured",
            "contents_sum_insured",
            "all_risks_valuables",
        )
    ):
        from app.schemas import DomesticPackageRiskDetails

        return DomesticPackageRiskDetails(**risk_details).model_dump(mode="python")
    if "wiba" in class_name and any(
        k in risk_details
        for k in ("clerical_payroll", "artisan_payroll", "hazardous_payroll")
    ):
        from app.schemas import WIBARiskDetails

        return WIBARiskDetails(**risk_details).model_dump(mode="python")
    if "fire" in class_name and any(
        k in risk_details
        for k in (
            "buildings_sum_insured",
            "plant_machinery_sum_insured",
            "stock_sum_insured",
        )
    ):
        from app.schemas import FirePerilsRiskDetails

        return FirePerilsRiskDetails(**risk_details).model_dump(mode="python")
    if "marine" in class_name and "cif_value" in risk_details:
        from app.schemas import MarineCargoRiskDetails

        return MarineCargoRiskDetails(**risk_details).model_dump(mode="python")
    if "medical" in class_name and any(
        k in risk_details for k in ("inpatient_limit", "principal_age")
    ):
        from app.schemas import MedicalRiskDetails

        return MedicalRiskDetails(**risk_details).model_dump(mode="python")
    return risk_details


def normalize_rating_inputs(inputs: dict[str, Any]) -> dict[str, Any]:
    """Flatten nested vehicle.sum_insured when top-level sum_insured is absent."""
    normalized = dict(inputs)
    if "sum_insured" not in normalized and isinstance(normalized.get("vehicle"), dict):
        vehicle_sum = normalized["vehicle"].get("sum_insured")
        if vehicle_sum is not None:
            normalized["sum_insured"] = vehicle_sum
    return normalized


def _apply_selection(session: Session, calc: PremiumCalculation) -> None:
    """Mark *calc* selected, unselect scoped siblings, and sync Renewal atomically."""
    if calc.renewal_id is not None:
        other_calcs = session.exec(
            select(PremiumCalculation).where(
                PremiumCalculation.renewal_id == calc.renewal_id,
                PremiumCalculation.id != calc.id,
            )
        ).all()
        for other in other_calcs:
            other.is_selected = False
            session.add(other)

        renewal = session.get(Renewal, calc.renewal_id)
        if renewal:
            renewal.selected_calculation_id = calc.id
            renewal.proposed_premium = calc.total_premium
            session.add(renewal)
    elif calc.policy_id is not None:
        other_calcs = session.exec(
            select(PremiumCalculation).where(
                PremiumCalculation.policy_id == calc.policy_id,
                PremiumCalculation.id != calc.id,
            )
        ).all()
        for other in other_calcs:
            other.is_selected = False
            session.add(other)

    calc.is_selected = True
    session.add(calc)


def create_premium_calculation(
    session: Session,
    *,
    calc_in: PremiumCalculationCreate,
    user_id: uuid.UUID | None = None,
) -> PremiumCalculation:
    """Persist a PremiumCalculation and, if is_selected, select it in one transaction."""
    db_calc = PremiumCalculation(**calc_in.model_dump(), created_by_id=user_id)
    session.add(db_calc)
    session.flush()
    if calc_in.is_selected:
        _apply_selection(session, db_calc)
    session.commit()
    session.refresh(db_calc)
    return db_calc


def select_premium_calculation(
    session: Session, *, calc_id: uuid.UUID
) -> PremiumCalculation:
    """Select a persisted PremiumCalculation and sync its scope in one transaction."""
    calc = session.get(PremiumCalculation, calc_id)
    if not calc:
        raise ValueError("Calculation not found")
    _apply_selection(session, calc)
    session.commit()
    session.refresh(calc)
    return calc


def create_tax_rate_rule(
    session: Session, *, rule_in: TaxRateRuleCreate
) -> TaxRateRule:
    """Persist a TaxRateRule atomically."""
    db_obj = TaxRateRule.model_validate(rule_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_tax_rate_rules(session: Session) -> list[TaxRateRule]:
    """List active TaxRateRules ordered by sequence_order."""
    statement = (
        select(TaxRateRule)
        .where(TaxRateRule.is_active.is_(True))
        .order_by(TaxRateRule.sequence_order.asc())
    )
    return list(session.exec(statement).all())


def _premium_calculation_base_query(
    *,
    policy_id: uuid.UUID | None = None,
    renewal_id: uuid.UUID | None = None,
):
    statement = select(PremiumCalculation)
    if policy_id is not None:
        statement = statement.where(PremiumCalculation.policy_id == policy_id)
    if renewal_id is not None:
        statement = statement.where(PremiumCalculation.renewal_id == renewal_id)
    return statement


def get_premium_calculation(
    session: Session, *, calc_id: uuid.UUID
) -> PremiumCalculation | None:
    """Fetch a PremiumCalculation by ID."""
    return session.get(PremiumCalculation, calc_id)


def get_premium_calculations(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
    renewal_id: uuid.UUID | None = None,
) -> list[PremiumCalculation]:
    """List PremiumCalculations ordered newest-first with optional policy/renewal filter."""
    statement = (
        _premium_calculation_base_query(policy_id=policy_id, renewal_id=renewal_id)
        .order_by(PremiumCalculation.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def count_premium_calculations(
    session: Session,
    *,
    policy_id: uuid.UUID | None = None,
    renewal_id: uuid.UUID | None = None,
) -> int:
    """Count PremiumCalculations matching optional policy/renewal filter."""
    statement = _premium_calculation_base_query(
        policy_id=policy_id, renewal_id=renewal_id
    )
    count_statement = select(func.count()).select_from(statement.subquery())
    return session.exec(count_statement).one()
