from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any

from app.models import PricingStrategy, Product
from app.schemas import (
    BaseFinancialBreakdown,
    BenefitLineItem,
    CommercialFireFinancialBreakdown,
    DomesticFinancialBreakdown,
    MarineFinancialBreakdown,
    MedicalFinancialBreakdown,
    MotorFinancialBreakdown,
    WIBAFinancialBreakdown,
)


class RatingStrategy(ABC):
    @abstractmethod
    def calculate(self, product: Product, risk_details: dict[str, Any]) -> Any:
        pass

    @staticmethod
    def parse_decimal(value: Any) -> Decimal:
        """
        Robustly parse a value into a Decimal.
        """
        from app.utils import parse_decimal

        return parse_decimal(value)

    @staticmethod
    def _calculate_standard_levies(net_premium: Decimal) -> dict[str, Decimal]:
        return {
            "training_levy": (net_premium * Decimal("0.002")).quantize(Decimal("0.01")),
            "phcf": (net_premium * Decimal("0.0025")).quantize(Decimal("0.01")),
            "stamp_duty": Decimal("40.00"),
        }


class MotorPrivateRatingStrategy(RatingStrategy):
    DEFAULT_TIERS = [
        {"max": Decimal("1500000"), "rate": Decimal("0.05"), "min": Decimal("60000")},
        {"max": Decimal("2500000"), "rate": Decimal("0.04"), "min": Decimal("75000")},
        {"max": Decimal("3000000"), "rate": Decimal("0.035"), "min": Decimal("100000")},
        {"max": Decimal("5000000"), "rate": Decimal("0.0325"), "min": Decimal("0")},
        {"max": Decimal("Infinity"), "rate": Decimal("0.03"), "min": Decimal("0")},
    ]

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> MotorFinancialBreakdown:
        vehicle = risk_details.get("vehicle") or risk_details.get("vehicle_details", {})
        si_raw = (
            vehicle.get("sum_insured")
            if isinstance(vehicle, dict) and "sum_insured" in vehicle
            else risk_details.get("sum_insured", 0)
        )
        value = RatingStrategy.parse_decimal(si_raw)

        if value < 0:
            raise ValueError(
                "Sum insured must be non-negative for Motor Private insurance."
            )

        product_tiers = (
            product.pricing_rules.get("tiers") if product.pricing_rules else None
        )
        if product_tiers:
            tiers = []
            for t in product_tiers:
                tiers.append(
                    {
                        "max": Decimal(str(t["max"]))
                        if t["max"] is not None
                        else Decimal("Infinity"),
                        "rate": Decimal(str(t["rate"])) / Decimal("100"),
                        "min": Decimal(str(t.get("min", 0))),
                    }
                )
            # Tiers should ideally be stored sorted, but we ensure sorting here once.
            tiers.sort(key=lambda x: x["max"])
        else:
            tiers = self.DEFAULT_TIERS

        applicable_tier = next((t for t in tiers if value <= t["max"]), tiers[-1])
        basic_rate = applicable_tier["rate"]
        basic_premium = max(
            applicable_tier["min"], (value * basic_rate).quantize(Decimal("0.01"))
        )

        raw_ext = (
            risk_details.get("extensions")
            or risk_details.get("added_benefits")
            or risk_details.get("EXTENSIONS")
            or {}
        )
        extensions = (
            {k.lower(): v for k, v in raw_ext.items()}
            if isinstance(raw_ext, dict)
            else {}
        )
        benefits = []
        net_premium = basic_premium
        high_end_threshold = Decimal(
            str(product.pricing_rules.get("high_end_threshold", "3000000"))
            if product.pricing_rules
            else "3000000"
        )
        is_high_end = value >= high_end_threshold

        # Benefits logic
        for ext, rate, name in [
            ("pvt", Decimal("0.0025"), "PVT"),
            ("excess_protector", Decimal("0.0025"), "Excess Protector"),
        ]:
            if extensions.get(ext):
                amount = (
                    Decimal("0.00")
                    if is_high_end
                    else (value * rate).quantize(Decimal("0.01"))
                )
                benefits.append(BenefitLineItem(name=name, amount=amount))
                net_premium += amount

        if extensions.get("passenger_liability"):
            pl_amount = Decimal("500.00")
            benefits.append(
                BenefitLineItem(name="Passenger Liability", amount=pl_amount)
            )
            net_premium += pl_amount

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        post_levy_total = Decimal("0.00")
        if extensions.get("om_rescue_plus"):
            om_amount = Decimal("1000.00")
            benefits.append(BenefitLineItem(name="OM Rescue Plus", amount=om_amount))
            post_levy_total += om_amount

        commission_rate = Decimal(str(product.default_commission_rate / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return MotorFinancialBreakdown(
            type="motor",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies + post_levy_total,
            benefits=benefits,
            basic_rate=basic_rate,
            is_high_end=is_high_end,
        )

    def _calculate_standard_levies(self, net_premium: Decimal) -> dict[str, Decimal]:
        return {
            "training_levy": (net_premium * Decimal("0.002")).quantize(Decimal("0.01")),
            "phcf": (net_premium * Decimal("0.0025")).quantize(Decimal("0.01")),
            "stamp_duty": Decimal("40.00"),
        }


class MotorThirdPartyRatingStrategy(RatingStrategy):
    """
    Rating strategy for statutory Motor Third Party Only (TPO) covers under Cap 405.
    Rated as a flat annual statutory tariff independent of vehicle market value.
    """

    DEFAULT_TARIFF = Decimal("7500.00")

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> MotorFinancialBreakdown:
        rules = product.pricing_rules or {}
        tariff_raw = (
            risk_details.get("tariff")
            or risk_details.get("flat_annual_tariff")
            or rules.get("flat_annual_tariff")
            or self.DEFAULT_TARIFF
        )
        net_premium = self.parse_decimal(tariff_raw)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 10.0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return MotorFinancialBreakdown(
            type="motor",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
            benefits=[
                BenefitLineItem(
                    name="Third Party Property Damage (Statutory)",
                    amount=Decimal("0.00"),
                    is_complimentary=True,
                ),
                BenefitLineItem(
                    name="Third Party Bodily Injury / Death (Cap 405)",
                    amount=Decimal("0.00"),
                    is_complimentary=True,
                ),
            ],
            basic_rate=None,
            is_high_end=False,
        )


class FixedPackageRatingStrategy(RatingStrategy):
    """
    Rating strategy for fixed-fee retail packages such as Golfers Insurance and Personal Accident.
    """

    DEFAULT_FEE = Decimal("7500.00")

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> BaseFinancialBreakdown:
        rules = product.pricing_rules or {}
        fee_raw = (
            risk_details.get("package_fee")
            or rules.get("package_fee")
            or self.DEFAULT_FEE
        )
        net_premium = self.parse_decimal(fee_raw)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 20.0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return BaseFinancialBreakdown(
            type="base",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
        )


class ManualRatingStrategy(RatingStrategy):
    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> BaseFinancialBreakdown:
        financials = risk_details.get("financials", {})
        premium_raw = (
            financials.get("rate")
            or risk_details.get("vehicle", {}).get("sum_insured")
            or risk_details.get("sum_insured", 0)
        )
        net_premium = self.parse_decimal(premium_raw)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str(product.default_commission_rate / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return BaseFinancialBreakdown(
            type="base",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
        )


class DomesticPackageRatingStrategy(RatingStrategy):
    DEFAULT_BUILDINGS_RATE = Decimal("0.0012")  # 0.12%
    DEFAULT_CONTENTS_RATE = Decimal("0.0075")  # 0.75%
    DEFAULT_ALL_RISKS_RATE = Decimal("0.0150")  # 1.50%
    INDOOR_SERVANT_FEE = Decimal("1000.00")
    OUTDOOR_SERVANT_FEE = Decimal("1500.00")
    MINIMUM_PREMIUM = Decimal("10000.00")

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> DomesticFinancialBreakdown:
        rules = product.pricing_rules or {}
        b_rate = Decimal(str(rules.get("buildings_rate", self.DEFAULT_BUILDINGS_RATE)))
        c_rate = Decimal(str(rules.get("contents_rate", self.DEFAULT_CONTENTS_RATE)))
        ar_rate = Decimal(str(rules.get("all_risks_rate", self.DEFAULT_ALL_RISKS_RATE)))
        min_prem = Decimal(str(rules.get("minimum_premium", self.MINIMUM_PREMIUM)))

        b_si = self.parse_decimal(risk_details.get("buildings_sum_insured", 0))
        c_si = self.parse_decimal(risk_details.get("contents_sum_insured", 0))
        ar_si = self.parse_decimal(risk_details.get("all_risks_valuables", 0))
        servants_in = int(risk_details.get("domestic_servants_indoor", 0) or 0)
        servants_out = int(risk_details.get("domestic_servants_outdoor", 0) or 0)

        prem_b = (b_si * b_rate).quantize(Decimal("0.01"))
        prem_c = (c_si * c_rate).quantize(Decimal("0.01"))
        prem_ar = (ar_si * ar_rate).quantize(Decimal("0.01"))
        prem_servants = (servants_in * self.INDOOR_SERVANT_FEE) + (
            servants_out * self.OUTDOOR_SERVANT_FEE
        )

        calculated_net = prem_b + prem_c + prem_ar + prem_servants
        net_premium = max(min_prem, calculated_net)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 20.0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return DomesticFinancialBreakdown(
            type="domestic",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
            section_premiums={
                "buildings": prem_b,
                "contents": prem_c,
                "all_risks": prem_ar,
                "domestic_servants": prem_servants,
            },
            buildings_sum_insured=b_si,
            contents_sum_insured=c_si,
            all_risks_valuables=ar_si,
        )


class WIBARatingStrategy(RatingStrategy):
    DEFAULT_CLERICAL_RATE = Decimal("0.0050")  # 0.50%
    DEFAULT_ARTISAN_RATE = Decimal("0.0150")  # 1.50%
    DEFAULT_HAZARDOUS_RATE = Decimal("0.0350")  # 3.50%
    MINIMUM_PREMIUM = Decimal("25000.00")

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> WIBAFinancialBreakdown:
        rules = product.pricing_rules or {}
        clerical_rate = Decimal(
            str(rules.get("clerical_rate", self.DEFAULT_CLERICAL_RATE))
        )
        artisan_rate = Decimal(
            str(rules.get("artisan_rate", self.DEFAULT_ARTISAN_RATE))
        )
        hazard_rate = Decimal(
            str(rules.get("hazardous_rate", self.DEFAULT_HAZARDOUS_RATE))
        )
        min_prem = Decimal(str(rules.get("minimum_premium", self.MINIMUM_PREMIUM)))

        c_pay = self.parse_decimal(risk_details.get("clerical_payroll", 0))
        a_pay = self.parse_decimal(risk_details.get("artisan_payroll", 0))
        h_pay = self.parse_decimal(risk_details.get("hazardous_payroll", 0))
        emp_count = int(risk_details.get("employee_count", 1) or 1)

        prem_c = (c_pay * clerical_rate).quantize(Decimal("0.01"))
        prem_a = (a_pay * artisan_rate).quantize(Decimal("0.01"))
        prem_h = (h_pay * hazard_rate).quantize(Decimal("0.01"))

        calculated_net = prem_c + prem_a + prem_h
        net_premium = max(min_prem, calculated_net)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 15.0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return WIBAFinancialBreakdown(
            type="wiba",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
            payroll_totals={
                "clerical": prem_c,
                "artisan": prem_a,
                "hazardous": prem_h,
            },
            employee_count=emp_count,
        )


class FirePerilsRatingStrategy(RatingStrategy):
    DEFAULT_FIRE_RATE = Decimal("0.00125")  # 0.125%
    DEFAULT_PERILS_RATE = Decimal("0.00050")  # 0.05%
    MINIMUM_PREMIUM = Decimal("15000.00")

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> CommercialFireFinancialBreakdown:
        rules = product.pricing_rules or {}
        fire_rate = Decimal(str(rules.get("fire_rate", self.DEFAULT_FIRE_RATE)))
        perils_rate = Decimal(str(rules.get("perils_rate", self.DEFAULT_PERILS_RATE)))
        min_prem = Decimal(str(rules.get("minimum_premium", self.MINIMUM_PREMIUM)))

        b_si = self.parse_decimal(risk_details.get("buildings_sum_insured", 0))
        pm_si = self.parse_decimal(risk_details.get("plant_machinery_sum_insured", 0))
        st_si = self.parse_decimal(risk_details.get("stock_sum_insured", 0))
        include_perils = bool(risk_details.get("include_special_perils", True))

        total_si = b_si + pm_si + st_si
        fire_prem = (total_si * fire_rate).quantize(Decimal("0.01"))
        perils_prem = (
            (total_si * perils_rate).quantize(Decimal("0.01"))
            if include_perils
            else Decimal("0.00")
        )

        calculated_net = fire_prem + perils_prem
        net_premium = max(min_prem, calculated_net)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 15.0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return CommercialFireFinancialBreakdown(
            type="fire",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
            total_sum_insured=total_si,
            special_perils_included=include_perils,
        )


class MarineCargoRatingStrategy(RatingStrategy):
    UPLIFT_FACTOR = Decimal("1.10")  # 10% statutory CIF uplift
    MINIMUM_PREMIUM = Decimal("5000.00")
    CLAUSE_RATES = {
        "Clause A": Decimal("0.0050"),  # 0.50% All Risks
        "Clause B": Decimal("0.0035"),  # 0.35%
        "Clause C": Decimal("0.0025"),  # 0.25%
    }

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> MarineFinancialBreakdown:
        rules = product.pricing_rules or {}
        min_prem = Decimal(str(rules.get("minimum_premium", self.MINIMUM_PREMIUM)))

        cif_raw = risk_details.get("cif_value", 0)
        cif_val = self.parse_decimal(cif_raw)
        clause = str(risk_details.get("clause", "Clause A"))
        rate = self.CLAUSE_RATES.get(clause, Decimal("0.0050"))

        uplifted = (cif_val * self.UPLIFT_FACTOR).quantize(Decimal("0.01"))
        calc_net = (uplifted * rate).quantize(Decimal("0.01"))
        net_premium = max(min_prem, calc_net)

        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 12.5) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return MarineFinancialBreakdown(
            type="marine",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
            cif_value=cif_val,
            uplifted_value=uplifted,
            clause=clause,
        )


class MedicalRatingStrategy(RatingStrategy):
    BASE_TIERS = {
        Decimal("500000"): Decimal("25000.00"),
        Decimal("1000000"): Decimal("35000.00"),
        Decimal("2000000"): Decimal("50000.00"),
        Decimal("5000000"): Decimal("75000.00"),
    }
    OUTPATIENT_FEE = Decimal("25000.00")
    CHILD_RATE = Decimal("12000.00")

    def calculate(
        self, product: Product, risk_details: dict[str, Any]
    ) -> MedicalFinancialBreakdown:
        ip_limit = self.parse_decimal(risk_details.get("inpatient_limit", 1000000))
        base_ip = next(
            (v for k, v in self.BASE_TIERS.items() if ip_limit <= k),
            Decimal("75000.00"),
        )

        age = int(risk_details.get("principal_age", 30) or 30)
        age_multiplier = (
            Decimal("1.40")
            if age >= 60
            else (Decimal("1.20") if age >= 50 else Decimal("1.00"))
        )
        principal_prem = (base_ip * age_multiplier).quantize(Decimal("0.01"))

        spouse_prem = (
            (base_ip * Decimal("0.80")).quantize(Decimal("0.01"))
            if risk_details.get("has_spouse")
            else Decimal("0.00")
        )
        children = int(risk_details.get("children_count", 0) or 0)
        children_prem = (Decimal(str(children)) * self.CHILD_RATE).quantize(
            Decimal("0.01")
        )

        inpatient_total = principal_prem + spouse_prem + children_prem
        outpatient_total = (
            self.OUTPATIENT_FEE
            if risk_details.get("include_outpatient")
            else Decimal("0.00")
        )

        net_premium = inpatient_total + outpatient_total
        # Medical in Kenya is VAT-exempt, but ITL, PHCF, and Stamp Duty still apply under IRA rules
        levies = self._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 10.0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        family_count = 1 + (1 if risk_details.get("has_spouse") else 0) + children

        return MedicalFinancialBreakdown(
            type="medical",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
            inpatient_limit=ip_limit,
            inpatient_premium=inpatient_total,
            outpatient_premium=outpatient_total,
            family_size=family_count,
        )


class RatingService:
    @classmethod
    def calculate_breakdown(cls, product: Product, clean_risk: dict[str, Any]) -> Any:
        # 1. Manual rating strategy
        if product.pricing_strategy == PricingStrategy.MANUAL:
            return ManualRatingStrategy().calculate(product, clean_risk)

        class_name = product.class_of_insurance.lower()
        product_name = (product.name or "").lower()

        # 2. Motor Third Party Only (TPO) statutory cover (Cap 405)
        if (
            "third party" in class_name
            or "tpo" in product_name
            or "third party" in product_name
        ):
            return MotorThirdPartyRatingStrategy().calculate(product, clean_risk)

        # 3. Motor private & commercial comprehensive strategy
        if "motor private" in class_name or "motor commercial" in class_name:
            return MotorPrivateRatingStrategy().calculate(product, clean_risk)

        # 4. Domestic package strategy
        if "domestic" in class_name:
            return DomesticPackageRatingStrategy().calculate(product, clean_risk)

        # 5. WIBA / Employers Liability strategy
        if "wiba" in class_name:
            return WIBARatingStrategy().calculate(product, clean_risk)

        # 6. Golfers & Personal Accident fixed retail packages
        if (
            "golf" in class_name
            or "golf" in product_name
            or "personal accident" in class_name
            or "personal accident" in product_name
        ):
            return FixedPackageRatingStrategy().calculate(product, clean_risk)

        # 7. Commercial Fire & Perils (when detailed fields provided)
        if "fire" in class_name and any(
            k in clean_risk
            for k in (
                "buildings_sum_insured",
                "plant_machinery_sum_insured",
                "stock_sum_insured",
            )
        ):
            return FirePerilsRatingStrategy().calculate(product, clean_risk)

        # 8. Marine Cargo (when cif_value provided)
        if "marine" in class_name and "cif_value" in clean_risk:
            return MarineCargoRatingStrategy().calculate(product, clean_risk)

        # 9. Medical strategy
        if "medical" in class_name and any(
            k in clean_risk for k in ("inpatient_limit", "principal_age", "has_spouse")
        ):
            return MedicalRatingStrategy().calculate(product, clean_risk)

        # 8. Generic fallback
        return cls._calculate_generic(product, clean_risk)

    @classmethod
    def _calculate_generic(
        cls, product: Product, risk_details: dict[str, Any]
    ) -> BaseFinancialBreakdown:
        motor_strategy = MotorPrivateRatingStrategy()

        # Extract sum insured if present
        vehicle = risk_details.get("vehicle") or risk_details.get("vehicle_details", {})
        financials = risk_details.get("financials", {})
        si_raw = (
            vehicle.get("sum_insured")
            or financials.get("sumInsured")
            or financials.get("sum_insured")
            or risk_details.get("sum_insured")
        )

        sum_insured = (
            motor_strategy.parse_decimal(si_raw)
            if si_raw is not None
            else Decimal("0.00")
        )

        pricing_rules = product.pricing_rules or {}
        rate_val = pricing_rules.get("rate", 0)
        rate = Decimal(str(rate_val)) / Decimal("100") if rate_val else Decimal("0.00")

        net_premium = (sum_insured * rate).quantize(Decimal("0.01"))
        levies = motor_strategy._calculate_standard_levies(net_premium)
        total_levies = sum(levies.values())

        commission_rate = Decimal(str((product.default_commission_rate or 0) / 100))
        commission_amount = (net_premium * commission_rate).quantize(Decimal("0.01"))

        return BaseFinancialBreakdown(
            type="base",
            net_premium=net_premium,
            taxes=levies,
            commission_amount=commission_amount,
            total_amount=net_premium + total_levies,
        )
