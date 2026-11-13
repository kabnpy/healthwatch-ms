from decimal import Decimal

from app.services.statutory_levy import StatutoryLevy, StatutoryLevyCalculator


def test_standard_statutory_levies_calculation() -> None:
    """Calculates 0.20% Training Levy, 0.25% PHCF, and KES 40.00 Stamp Duty on standard non-exempt premium."""
    levy = StatutoryLevyCalculator.calculate(Decimal("62500.00"))

    assert isinstance(levy, StatutoryLevy)
    assert levy.training_levy == Decimal("125.00")
    assert levy.phcf == Decimal("156.25")
    assert levy.stamp_duty == Decimal("40.00")
    assert levy.total_levies == Decimal("321.25")
    assert levy.exact_total == Decimal("62821.25")
    assert levy.total_payable == Decimal("62821.25")
    assert levy.exempt_stamp_duty is False


def test_medical_exemption_omits_stamp_duty() -> None:
    """Exempts KES 40.00 Stamp Duty when exempt_stamp_duty is True while applying Training Levy and PHCF."""
    levy = StatutoryLevyCalculator.calculate(
        Decimal("88000.00"), exempt_stamp_duty=True
    )

    assert levy.training_levy == Decimal("176.00")
    assert levy.phcf == Decimal("220.00")
    assert levy.stamp_duty == Decimal("0.00")
    assert levy.total_levies == Decimal("396.00")
    assert levy.exact_total == Decimal("88396.00")
    assert levy.total_payable == Decimal("88396.00")
    assert levy.exempt_stamp_duty is True


def test_to_taxes_dict_and_advisory_taxes_dict_serialization() -> None:
    """Formats statutory levy breakdowns for RatingService and AdvisoryRatingService callers."""
    standard = StatutoryLevyCalculator.calculate(Decimal("65000.00"))
    assert standard.to_taxes_dict() == {
        "training_levy": Decimal("130.00"),
        "phcf": Decimal("162.50"),
        "stamp_duty": Decimal("40.00"),
    }
    assert standard.to_advisory_taxes_dict() == {
        "training_levy": "130.00",
        "phcf": "162.50",
        "stamp_duty": "40.00",
        "total_taxes": "332.50",
        "stamp_duty_exempt": False,
    }

    medical = StatutoryLevyCalculator.calculate(Decimal("88000.00"), True)
    assert medical.to_taxes_dict() == {
        "training_levy": Decimal("176.00"),
        "phcf": Decimal("220.00"),
        "stamp_duty": Decimal("0.00"),
    }
    assert medical.to_advisory_taxes_dict() == {
        "training_levy": "176.00",
        "phcf": "220.00",
        "stamp_duty": "0.00",
        "total_taxes": "396.00",
        "stamp_duty_exempt": True,
    }


def test_round_half_up_quantization_and_fractional_edge_cases() -> None:
    """Enforces ROUND_HALF_UP quantization on halfway cent boundaries and fractional inputs."""
    # For net_premium = 2.00:
    # training_levy = 2.00 * 0.0020 = 0.004 -> 0.00
    # phcf = 2.00 * 0.0025 = 0.005 -> 0.01 under ROUND_HALF_UP (would be 0.00 under ROUND_HALF_EVEN)
    half_cent_phcf = StatutoryLevyCalculator.calculate(Decimal("2.00"))
    assert half_cent_phcf.training_levy == Decimal("0.00")
    assert half_cent_phcf.phcf == Decimal("0.01")
    assert half_cent_phcf.stamp_duty == Decimal("40.00")
    assert half_cent_phcf.total_levies == Decimal("40.01")
    assert half_cent_phcf.exact_total == Decimal("42.01")
    assert half_cent_phcf.total_payable == Decimal("42.01")

    # For net_premium = 2.50:
    # training_levy = 2.50 * 0.0020 = 0.005 -> 0.01 under ROUND_HALF_UP (would be 0.00 under ROUND_HALF_EVEN)
    # phcf = 2.50 * 0.0025 = 0.00625 -> 0.01
    half_cent_itl = StatutoryLevyCalculator.calculate(
        Decimal("2.50"), exempt_stamp_duty=True
    )
    assert half_cent_itl.training_levy == Decimal("0.01")
    assert half_cent_itl.phcf == Decimal("0.01")
    assert half_cent_itl.stamp_duty == Decimal("0.00")
    assert half_cent_itl.total_levies == Decimal("0.02")
    assert half_cent_itl.exact_total == Decimal("2.52")
    assert half_cent_itl.total_payable == Decimal("2.52")

    # For sub-cent net_premium = 1000.005:
    # exact_total = 1000.005 + 44.50 = 1044.505 -> 1044.51 under ROUND_HALF_UP
    sub_cent = StatutoryLevyCalculator.calculate(Decimal("1000.005"))
    assert sub_cent.training_levy == Decimal("2.00")
    assert sub_cent.phcf == Decimal("2.50")
    assert sub_cent.total_levies == Decimal("44.50")
    assert sub_cent.exact_total == Decimal("1044.51")
    assert sub_cent.total_payable == Decimal("1044.51")



