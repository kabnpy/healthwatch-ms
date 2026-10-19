import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.models import (
    BenefitCalculationType,
    BusinessEvent,
    PricingMethod,
    RateTableVersion,
)
from app.utils import parse_decimal


class AdvisoryRatingService:
    @staticmethod
    def calculate_quote(
        rate_table: RateTableVersion,
        inputs: dict[str, Any],
        business_event: BusinessEvent = BusinessEvent.NEW_BUSINESS,
        policy_id: uuid.UUID | None = None,
        renewal_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """
        Executes advisory rating across the 6 rating paradigms with strict Decimal precision,
        applies statutory levies and tax exemptions, and builds complete audit provenance.
        """
        method = rate_table.pricing_method
        class_name = rate_table.class_of_insurance.lower()

        if method == PricingMethod.BRACKETED_PERCENTAGE:
            calc_result = AdvisoryRatingService._calculate_bracketed_percentage(
                rate_table, inputs
            )
        elif method == PricingMethod.FIXED_TIER:
            calc_result = AdvisoryRatingService._calculate_fixed_tariff(
                rate_table, inputs
            )
        elif method == PricingMethod.MULTI_COMPONENT:
            calc_result = AdvisoryRatingService._calculate_multi_component(
                rate_table, inputs
            )
        elif (
            method == PricingMethod.PACKAGED
            or "medical" in class_name
            or "health" in class_name
        ):
            calc_result = AdvisoryRatingService._calculate_census_medical(
                rate_table, inputs
            )
        elif method == PricingMethod.WAGE_ROLL:
            calc_result = AdvisoryRatingService._calculate_payroll(rate_table, inputs)
        elif method == PricingMethod.LIMIT_OF_INDEMNITY:
            calc_result = AdvisoryRatingService._calculate_indemnity_limit(
                rate_table, inputs
            )
        else:
            raise ValueError(f"Unsupported pricing method: {method}")

        net_premium = calc_result["net_premium"]

        # Statutory Levies & Taxes
        # Training Levy: 0.20% (0.0020)
        training_levy = (net_premium * Decimal("0.0020")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        # Policyholders Compensation Fund: 0.25% (0.0025)
        phcf = (net_premium * Decimal("0.0025")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # Stamp Duty: KES 40.00 flat per contract slip. Medical / Healthcare policies are strictly exempt!
        is_medical = "medical" in class_name or "health" in class_name
        stamp_duty = Decimal("0.00") if is_medical else Decimal("40.00")

        total_taxes = training_levy + phcf + stamp_duty
        exact_total = net_premium + total_taxes

        # Whole KES integer rounding
        rounded_total = exact_total.quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)

        taxes_dict = {
            "training_levy": str(training_levy),
            "phcf": str(phcf),
            "stamp_duty": str(stamp_duty),
            "total_taxes": str(total_taxes),
            "stamp_duty_exempt": is_medical,
        }

        calculation_detail = {
            "components": calc_result["components"],
            "benefits": calc_result.get("benefits", []),
            "basic_premium": str(calc_result.get("basic_premium", net_premium)),
            "net_premium": str(net_premium),
            "taxes": taxes_dict,
            "exact_total": str(exact_total),
            "total_premium": str(rounded_total),
        }

        rule_provenance = {
            "rate_table_version_id": str(rate_table.id) if rate_table.id else None,
            "version_number": rate_table.version_number,
            "pricing_method": rate_table.pricing_method.value,
            "class_of_insurance": rate_table.class_of_insurance,
            "applied_bracket": calc_result.get("applied_bracket"),
            "source_reference": rate_table.source_reference,
        }

        return {
            "net_premium": net_premium,
            "total_taxes": total_taxes,
            "total_premium": rounded_total,
            "calculation_detail": calculation_detail,
            "rule_provenance": rule_provenance,
            "input_snapshot": inputs,
        }

    @staticmethod
    def _calculate_bracketed_percentage(
        rate_table: RateTableVersion, inputs: dict[str, Any]
    ) -> dict[str, Any]:
        raw_si = inputs.get("sum_insured", 0)
        sum_insured = parse_decimal(raw_si)
        if sum_insured < 0:
            raise ValueError("Sum insured must be non-negative.")

        # Find matching bracket
        brackets = sorted(rate_table.brackets, key=lambda b: b.min_value)
        applied_bracket = None
        for b in brackets:
            if sum_insured >= b.min_value and (
                b.max_value is None or sum_insured <= b.max_value
            ):
                applied_bracket = b
                break
        if not applied_bracket and brackets:
            applied_bracket = brackets[-1]

        if applied_bracket:
            rate_dec = applied_bracket.rate_percent
            computed_basic = (sum_insured * rate_dec).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            basic_premium = max(computed_basic, applied_bracket.minimum_premium)
            bracket_info = {
                "display_label": applied_bracket.display_label,
                "rate_percent": str(applied_bracket.rate_percent),
                "minimum_premium": str(applied_bracket.minimum_premium),
            }
        else:
            basic_premium = Decimal("0.00")
            bracket_info = None

        components = [
            {
                "name": "Basic Comprehensive Premium",
                "sum_insured": str(sum_insured),
                "amount": str(basic_premium),
            }
        ]

        # Process benefits
        benefits_list = []
        benefit_total = Decimal("0.00")
        selected_codes = inputs.get("selected_benefits", [])
        if isinstance(selected_codes, dict):
            selected_codes = [k for k, v in selected_codes.items() if v]

        for benefit in rate_table.benefits:
            is_selected = benefit.is_mandatory or (benefit.code in selected_codes)
            if not is_selected:
                continue

            # Check if complimentary
            if benefit.is_complimentary and benefit.complimentary_threshold:
                if sum_insured >= benefit.complimentary_threshold:
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
                b_amount = (sum_insured * benefit.rate_value).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            elif benefit.calculation_type == BenefitCalculationType.FIXED_AMOUNT:
                b_amount = benefit.rate_value
            else:
                b_amount = benefit.rate_value

            benefit_total += b_amount
            benefits_list.append(
                {
                    "code": benefit.code,
                    "name": benefit.name,
                    "amount": str(b_amount),
                    "status": "applied",
                }
            )

        net_premium = basic_premium + benefit_total

        return {
            "basic_premium": basic_premium,
            "net_premium": net_premium,
            "components": components,
            "benefits": benefits_list,
            "applied_bracket": bracket_info,
        }

    @staticmethod
    def _calculate_fixed_tariff(
        rate_table: RateTableVersion, inputs: dict[str, Any]
    ) -> dict[str, Any]:
        tariff_amount = None
        if rate_table.brackets:
            tariff_amount = rate_table.brackets[0].minimum_premium
        if tariff_amount is None:
            tariff_amount = parse_decimal(inputs.get("fixed_amount", 7500))

        components = [
            {
                "name": "Fixed Tariff Statutory Premium",
                "amount": str(tariff_amount),
            }
        ]
        return {
            "basic_premium": tariff_amount,
            "net_premium": tariff_amount,
            "components": components,
            "benefits": [],
        }

    @staticmethod
    def _calculate_multi_component(
        rate_table: RateTableVersion, inputs: dict[str, Any]
    ) -> dict[str, Any]:
        buildings_si = parse_decimal(inputs.get("buildings_sum_insured", 0))
        contents_si = parse_decimal(inputs.get("contents_sum_insured", 0))
        all_risks_si = parse_decimal(inputs.get("all_risks_valuables", 0))
        servants_count = int(inputs.get("domestic_servants_count", 0))

        buildings_rate = Decimal("0.0012")  # 0.12%
        contents_rate = Decimal("0.0075")  # 0.75%
        all_risks_rate = Decimal("0.0150")  # 1.50%
        servant_cost = Decimal("1000.00")  # KES 1,000 per servant

        buildings_premium = (buildings_si * buildings_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        contents_premium = (contents_si * contents_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        all_risks_premium = (all_risks_si * all_risks_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        servants_premium = (Decimal(str(servants_count)) * servant_cost).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        components = [
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
        ]
        net_premium = (
            buildings_premium + contents_premium + all_risks_premium + servants_premium
        )
        return {
            "basic_premium": net_premium,
            "net_premium": net_premium,
            "components": components,
            "benefits": [],
        }

    @staticmethod
    def _calculate_census_medical(
        rate_table: RateTableVersion, inputs: dict[str, Any]
    ) -> dict[str, Any]:
        tier_code = inputs.get("tier_code")
        census_members = inputs.get("members", [])
        if not tier_code and census_members:
            count = len(census_members)
            tier_code = "M" if count <= 1 else f"M+{count - 1}"

        tier_match = None
        for t in rate_table.medical_tiers:
            if t.tier_code.upper() == str(tier_code).upper():
                tier_match = t
                break

        if tier_match:
            premium = tier_match.premium
            limits = tier_match.benefit_limits
        else:
            premium = parse_decimal(inputs.get("custom_premium", 45000))
            limits = {}

        components = [
            {
                "name": f"Medical Tier Census: {tier_code}",
                "tier_code": tier_code,
                "amount": str(premium),
                "benefit_limits": limits,
            }
        ]
        return {
            "basic_premium": premium,
            "net_premium": premium,
            "components": components,
            "benefits": [],
        }

    @staticmethod
    def _calculate_payroll(
        rate_table: RateTableVersion, inputs: dict[str, Any]
    ) -> dict[str, Any]:
        clerical_payroll = parse_decimal(inputs.get("clerical_payroll", 0))
        artisan_payroll = parse_decimal(inputs.get("artisan_payroll", 0))
        hazardous_payroll = parse_decimal(inputs.get("hazardous_payroll", 0))

        clerical_rate = Decimal("0.0050")  # 0.50%
        artisan_rate = Decimal("0.0150")  # 1.50%
        hazardous_rate = Decimal("0.0350")  # 3.50%
        min_premium = Decimal("25000.00")

        clerical_p = (clerical_payroll * clerical_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        artisan_p = (artisan_payroll * artisan_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        hazardous_p = (hazardous_payroll * hazardous_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        computed = clerical_p + artisan_p + hazardous_p
        net_premium = max(computed, min_premium)

        components = [
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
        ]
        return {
            "basic_premium": computed,
            "net_premium": net_premium,
            "components": components,
            "benefits": [],
        }

    @staticmethod
    def _calculate_indemnity_limit(
        rate_table: RateTableVersion, inputs: dict[str, Any]
    ) -> dict[str, Any]:
        limit = parse_decimal(inputs.get("limit_of_indemnity", 10000000))
        rate_percent = parse_decimal(inputs.get("rate_percent", Decimal("0.0040")))
        min_premium = parse_decimal(inputs.get("minimum_premium", Decimal("30000.00")))

        computed = (limit * rate_percent).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        net_premium = max(computed, min_premium)

        components = [
            {
                "name": "Limit of Indemnity Base",
                "limit": str(limit),
                "amount": str(net_premium),
            }
        ]
        return {
            "basic_premium": computed,
            "net_premium": net_premium,
            "components": components,
            "benefits": [],
        }
