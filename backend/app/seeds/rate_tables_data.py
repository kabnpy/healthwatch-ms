"""
Idempotent seeder for published RateTableVersion schedules, brackets, benefits, and medical tiers.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any

from sqlmodel import Session, col, select

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

logger = logging.getLogger(__name__)

_DEFAULT_EFFECTIVE_FROM = date(2025, 1, 1)


def _to_decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def _resolve_pricing_method(product: Product) -> PricingMethod:
    cls = product.class_of_insurance
    rules = product.pricing_rules or {}

    if cls == "Medical":
        return PricingMethod.FIXED_TIER
    if cls in ("Motor Third Party", "Motor Commercial Third Party"):
        return PricingMethod.FIXED_TIER
    if cls == "Domestic Package":
        return PricingMethod.MULTI_COMPONENT
    if cls == "WIBA / Employers Liability":
        return PricingMethod.WAGE_ROLL
    if cls in ("Professional Indemnity", "Public Liability"):
        return PricingMethod.LIMIT_OF_INDEMNITY
    if cls in ("Golfers", "Personal Accident"):
        return PricingMethod.PACKAGED
    if "buildings_rate" in rules or "machinery_rate" in rules or "stock_rate" in rules:
        return PricingMethod.MULTI_COMPONENT
    return PricingMethod.BRACKETED_PERCENTAGE


def _populate_schedule_children(
    session: Session, rate_table: RateTableVersion, product: Product
) -> None:
    rules = product.pricing_rules or {}
    cls = product.class_of_insurance

    # 1. Medical inpatient_rates -> MedicalTier
    if "inpatient_rates" in rules:
        for tier_code, tier_val in rules["inpatient_rates"].items():
            if isinstance(tier_val, dict):
                for family_size, premium in tier_val.items():
                    session.add(
                        MedicalTier(
                            rate_table_version_id=rate_table.id,
                            tier_code=f"{tier_code}:{family_size}",
                            benefit_limits={
                                "inpatient_limit": str(tier_code),
                                "family_size": str(family_size),
                            },
                            premium=_to_decimal(premium),
                        )
                    )
            else:
                session.add(
                    MedicalTier(
                        rate_table_version_id=rate_table.id,
                        tier_code=str(tier_code),
                        benefit_limits={"inpatient_limit": str(tier_code)},
                        premium=_to_decimal(tier_val),
                    )
                )
        return

    # 2. Motor Private / tiered -> RateBracket
    if "tiers" in rules:
        tiers = rules["tiers"]
        for idx, tier in enumerate(tiers):
            min_val = _to_decimal(tier.get("min_val", tier.get("min_value", 0)))
            max_raw = tier.get("max_val", tier.get("max_value"))
            max_val = _to_decimal(max_raw) if max_raw is not None else None
            rate_val = _to_decimal(tier.get("rate", tier.get("rate_percent", 0)))
            min_prem = _to_decimal(
                tier.get("min_premium", tier.get("minimum_premium", 0))
            )
            label = tier.get("label") or f"Tier {idx + 1}"
            session.add(
                RateBracket(
                    rate_table_version_id=rate_table.id,
                    min_value=min_val,
                    max_value=max_val,
                    rate_percent=rate_val,
                    minimum_premium=min_prem,
                    display_label=label,
                )
            )
        return

    # 3. Flat annual tariff (Motor TPO / Commercial TPO) -> RateBracket
    if "flat_annual_tariff" in rules:
        session.add(
            RateBracket(
                rate_table_version_id=rate_table.id,
                min_value=Decimal("0.00"),
                max_value=None,
                rate_percent=Decimal("0.0000"),
                minimum_premium=_to_decimal(rules["flat_annual_tariff"]),
                display_label=f"{cls} Flat Annual Tariff",
            )
        )
        return

    # 4. Packaged (Golfers / Personal Accident)
    if "package_fee" in rules:
        session.add(
            RateBenefit(
                rate_table_version_id=rate_table.id,
                code="package_fee",
                name="Package Fee",
                calculation_type=BenefitCalculationType.FIXED_AMOUNT,
                rate_value=_to_decimal(rules["package_fee"]),
                is_mandatory=True,
            )
        )
        return

    if "occupational_tiers" in rules:
        for tier_name, tier_val in rules["occupational_tiers"].items():
            if isinstance(tier_val, dict):
                rate_val = _to_decimal(
                    tier_val.get("rate", tier_val.get("premium", 0))
                )
            else:
                rate_val = _to_decimal(tier_val)
            session.add(
                RateBenefit(
                    rate_table_version_id=rate_table.id,
                    code=str(tier_name).lower().replace(" ", "_"),
                    name=str(tier_name),
                    calculation_type=BenefitCalculationType.FIXED_AMOUNT,
                    rate_value=rate_val,
                    is_mandatory=False,
                )
            )
        return

    # 5. Multi-component / WIBA / Fire & Perils / Domestic Package
    component_keys = [
        ("buildings_rate", "Buildings"),
        ("building_rate", "Buildings"),
        ("contents_rate", "Contents"),
        ("all_risks_rate", "All Risks"),
        ("machinery_rate", "Machinery"),
        ("stock_rate", "Stock"),
        ("clerical_rate", "Clerical Staff"),
        ("artisan_rate", "Artisan Staff"),
        ("manual_rate", "Manual Staff"),
        ("hazardous_rate", "Hazardous Staff"),
    ]
    added_benefit = False
    for key, label in component_keys:
        if key in rules:
            session.add(
                RateBenefit(
                    rate_table_version_id=rate_table.id,
                    code=key.removesuffix("_rate"),
                    name=label,
                    calculation_type=BenefitCalculationType.PERCENTAGE,
                    rate_value=_to_decimal(rules[key]),
                    is_mandatory=False,
                )
            )
            added_benefit = True

    if "servant_flat_fee" in rules:
        session.add(
            RateBenefit(
                rate_table_version_id=rate_table.id,
                code="domestic_servant",
                name="Domestic Servant",
                calculation_type=BenefitCalculationType.FIXED_AMOUNT,
                rate_value=_to_decimal(rules["servant_flat_fee"]),
                is_mandatory=False,
            )
        )
        added_benefit = True

    min_prem_raw = rules.get("min_premium", rules.get("minimum_premium"))
    if added_benefit:
        if min_prem_raw is not None:
            session.add(
                RateBracket(
                    rate_table_version_id=rate_table.id,
                    min_value=Decimal("0.00"),
                    max_value=None,
                    rate_percent=Decimal("0.0000"),
                    minimum_premium=_to_decimal(min_prem_raw),
                    display_label="Minimum Premium",
                )
            )
        return

    # 6. Single-rate Percentage (Motor Commercial, PI, Public Liability, Burglary, All Risks, Fire)
    rate_val = _to_decimal(rules.get("rate", 0))
    min_prem = _to_decimal(min_prem_raw) if min_prem_raw is not None else Decimal("0.00")
    session.add(
        RateBracket(
            rate_table_version_id=rate_table.id,
            min_value=Decimal("0.00"),
            max_value=None,
            rate_percent=rate_val,
            minimum_premium=min_prem,
            display_label=product.name,
        )
    )


def seed_rate_tables(
    session: Session, products: dict[str, Product]
) -> list[RateTableVersion]:
    """
    Idempotently seed PUBLISHED RateTableVersion schedules for all non-manual
    catalog products.
    """
    seeded: list[RateTableVersion] = []

    for product in products.values():
        if product.pricing_strategy == PricingStrategy.MANUAL:
            continue

        existing = session.exec(
            select(RateTableVersion).where(
                RateTableVersion.insurer_id == product.insurer_id,
                RateTableVersion.class_of_insurance == product.class_of_insurance,
                RateTableVersion.status == RateTableStatus.PUBLISHED,
                col(RateTableVersion.deleted_at).is_(None),
            )
        ).first()

        if existing:
            seeded.append(existing)
            continue

        pricing_method = _resolve_pricing_method(product)
        rate_table = RateTableVersion(
            insurer_id=product.insurer_id,
            class_of_insurance=product.class_of_insurance,
            pricing_method=pricing_method,
            currency="KES",
            version_number=1,
            status=RateTableStatus.PUBLISHED,
            effective_from=_DEFAULT_EFFECTIVE_FROM,
            effective_to=None,
            source_reference=f"catalog-seed:{product.name}",
            change_reason="Initial Kenyan market catalog seed",
        )
        session.add(rate_table)
        session.flush()

        _populate_schedule_children(session, rate_table, product)
        session.commit()
        session.refresh(rate_table)
        seeded.append(rate_table)
        logger.info(
            "Seeded PUBLISHED RateTableVersion %s for %s",
            rate_table.id,
            product.name,
        )

    return seeded
