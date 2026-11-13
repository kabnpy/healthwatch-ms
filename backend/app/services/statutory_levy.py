from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class StatutoryLevy:
    """Breakdown of mandatory Kenyan insurance statutory levies and totals."""

    training_levy: Decimal
    phcf: Decimal
    stamp_duty: Decimal
    total_levies: Decimal
    exact_total: Decimal
    total_payable: Decimal
    exempt_stamp_duty: bool

    def to_taxes_dict(self) -> dict[str, Decimal]:
        """Return the 3-key Decimal dict expected by BaseFinancialBreakdown.taxes in RatingService."""
        return {
            "training_levy": self.training_levy,
            "phcf": self.phcf,
            "stamp_duty": self.stamp_duty,
        }

    def to_advisory_taxes_dict(self) -> dict[str, str | bool]:
        """Return the serialized taxes dict expected by AdvisoryRatingService calculation_detail."""
        return {
            "training_levy": str(self.training_levy),
            "phcf": str(self.phcf),
            "stamp_duty": str(self.stamp_duty),
            "total_taxes": str(self.total_levies),
            "stamp_duty_exempt": self.exempt_stamp_duty,
        }



class StatutoryLevyCalculator:
    """Authoritative calculator for Kenyan StatutoryLevy and Decimal quantization."""

    TRAINING_LEVY_RATE = Decimal("0.0020")
    PHCF_RATE = Decimal("0.0025")
    STAMP_DUTY_AMOUNT = Decimal("40.00")
    ZERO = Decimal("0.00")
    CENT = Decimal("0.01")
    # Historical constant preserved from AdvisoryRatingService ("1.00" has exponent -2
    # in Python's decimal module, so quantize retains 2 decimal places / cent precision
    # as required by Spec #48 and existing RatingService / AdvisoryRatingService parity).
    TOTAL_PAYABLE_QUANTUM = Decimal("0.01")
    WHOLE_KES = TOTAL_PAYABLE_QUANTUM

    @classmethod
    def calculate(
        cls,
        net_premium: Decimal,
        exempt_stamp_duty: bool = False,
    ) -> StatutoryLevy:
        training_levy = (net_premium * cls.TRAINING_LEVY_RATE).quantize(
            cls.CENT, rounding=ROUND_HALF_UP
        )
        phcf = (net_premium * cls.PHCF_RATE).quantize(
            cls.CENT, rounding=ROUND_HALF_UP
        )
        stamp_duty = cls.ZERO if exempt_stamp_duty else cls.STAMP_DUTY_AMOUNT
        total_levies = (training_levy + phcf + stamp_duty).quantize(
            cls.CENT, rounding=ROUND_HALF_UP
        )
        exact_total = (net_premium + total_levies).quantize(
            cls.CENT, rounding=ROUND_HALF_UP
        )
        total_payable = exact_total.quantize(
            cls.TOTAL_PAYABLE_QUANTUM, rounding=ROUND_HALF_UP
        )

        return StatutoryLevy(
            training_levy=training_levy,
            phcf=phcf,
            stamp_duty=stamp_duty,
            total_levies=total_levies,
            exact_total=exact_total,
            total_payable=total_payable,
            exempt_stamp_duty=exempt_stamp_duty,
        )
