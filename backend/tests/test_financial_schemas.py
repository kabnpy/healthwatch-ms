from decimal import Decimal

from app.schemas import (
    BaseFinancialBreakdown,
    FinancialBreakdown,
    MotorFinancialBreakdown,
)


def test_base_financial_breakdown_valid():
    data = {
        "type": "base",
        "net_premium": Decimal("10000.00"),
        "taxes": {
            "training_levy": Decimal("20.00"),
            "phcf": Decimal("25.00"),
            "stamp_duty": Decimal("40.00"),
        },
        "total_amount": Decimal("10085.00"),
        "commission_amount": Decimal("1000.00"),
    }
    breakdown = BaseFinancialBreakdown(**data)
    assert breakdown.net_premium == Decimal("10000.00")
    assert breakdown.total_amount == Decimal("10085.00")


def test_motor_financial_breakdown_valid():
    data = {
        "type": "motor",
        "net_premium": Decimal("10000.00"),
        "taxes": {
            "training_levy": Decimal("20.00"),
            "phcf": Decimal("25.00"),
            "stamp_duty": Decimal("40.00"),
        },
        "total_amount": Decimal("10585.00"),
        "commission_amount": Decimal("1000.00"),
        "benefits": [
            {"name": "PVT", "amount": Decimal("250.00")},
            {"name": "Excess Protector", "amount": Decimal("250.00")},
        ],
    }
    breakdown = MotorFinancialBreakdown(**data)
    assert len(breakdown.benefits) == 2
    assert breakdown.benefits[0].name == "PVT"


def test_polymorphic_financial_breakdown():
    # Test that we can use a discriminator to load the right schema
    motor_data = {
        "product_class": "Motor Private",
        "breakdown": {
            "type": "motor",
            "net_premium": Decimal("10000.00"),
            "taxes": {"training_levy": Decimal("20.00")},
            "total_amount": Decimal("10020.00"),
            "commission_amount": Decimal("1000.00"),
            "benefits": [{"name": "PVT", "amount": Decimal("250.00")}],
        },
    }
    fb = FinancialBreakdown(**motor_data)
    assert isinstance(fb.breakdown, MotorFinancialBreakdown)
    assert fb.breakdown.type == "motor"

    base_data = {
        "product_class": "Generic",
        "breakdown": {
            "type": "base",
            "net_premium": Decimal("5000.00"),
            "total_amount": Decimal("5000.00"),
            "commission_amount": Decimal("500.00"),
        },
    }
    fb_base = FinancialBreakdown(**base_data)
    assert isinstance(fb_base.breakdown, BaseFinancialBreakdown)
    assert fb_base.breakdown.type == "base"
