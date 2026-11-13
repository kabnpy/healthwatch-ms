import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlmodel import Session, func, select

from app.models import (
    CommissionSchedule,
    CommissionScheduleCreate,
    ProductLine,
)


class CommissionError(Exception):
    """Base domain error for Commission operations."""


class CommissionNotFoundError(CommissionError):
    """Raised when a CommissionSchedule does not exist."""


class CommissionValidationError(CommissionError, ValueError):
    """Raised when Commission calculation or schedule validation fails."""


class CommissionService:
    STATUTORY_WHT_RATE = Decimal("0.0500")  # 5% statutory withholding tax

    # Standard Statutory Commission Rates in Kenya
    DEFAULT_RATES: dict[ProductLine, Decimal] = {
        ProductLine.MOTOR_COMPREHENSIVE: Decimal("0.1000"),
        ProductLine.MOTOR_THIRD_PARTY: Decimal("0.1000"),
        ProductLine.DOMESTIC_PACKAGE: Decimal("0.2000"),
        ProductLine.FIRE: Decimal("0.2000"),
        ProductLine.WIBA: Decimal("0.2000"),
        ProductLine.BURGLARY: Decimal("0.2000"),
        ProductLine.ALL_RISKS: Decimal("0.2000"),
        ProductLine.PERSONAL_ACCIDENT: Decimal("0.2000"),
        ProductLine.GOLFERS: Decimal("0.2000"),
        ProductLine.PROFESSIONAL_INDEMNITY: Decimal("0.2000"),
        ProductLine.PUBLIC_LIABILITY: Decimal("0.2000"),
        ProductLine.MEDICAL: Decimal("0.1000"),
    }

    @staticmethod
    def get_commission_schedule(
        *, session: Session, schedule_id: uuid.UUID
    ) -> CommissionSchedule:
        schedule = session.get(CommissionSchedule, schedule_id)
        if not schedule:
            raise CommissionNotFoundError("Commission schedule not found")
        return schedule

    @staticmethod
    def list_commission_schedules(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        insurer_id: uuid.UUID | None = None,
    ) -> tuple[list[CommissionSchedule], int]:
        statement = select(CommissionSchedule).where(
            CommissionSchedule.is_active.is_(True)  # type: ignore[attr-defined]
        )
        if insurer_id:
            statement = statement.where(CommissionSchedule.insurer_id == insurer_id)

        count_statement = select(func.count()).select_from(statement.subquery())
        count = session.exec(count_statement).one()
        schedules = list(
            session.exec(
                statement.order_by(CommissionSchedule.effective_from.desc())  # type: ignore[attr-defined]
                .offset(skip)
                .limit(limit)
            ).all()
        )
        return schedules, count

    @staticmethod
    def create_commission_schedule(
        *, session: Session, schedule_in: CommissionScheduleCreate
    ) -> CommissionSchedule:
        db_schedule = CommissionSchedule.model_validate(schedule_in)
        session.add(db_schedule)
        session.commit()
        session.refresh(db_schedule)
        return db_schedule

    @staticmethod
    def calculate_commission(
        net_base_premium: Decimal,
        gross_invoice_total: Decimal,
        commission_rate: Decimal | None = None,
        product_line: ProductLine | None = None,
        wht_rate: Decimal = STATUTORY_WHT_RATE,
    ) -> dict[str, Any]:
        """
        Calculates gross commission, 5% withholding tax deduction, net commission,
        and net carrier remittance amount with strict Decimal precision.
        """
        if net_base_premium < 0:
            raise CommissionValidationError("Net base premium must be non-negative.")
        if gross_invoice_total < net_base_premium:
            raise CommissionValidationError(
                "Gross invoice total cannot be less than net base premium."
            )

        if commission_rate is None:
            if product_line and product_line in CommissionService.DEFAULT_RATES:
                commission_rate = CommissionService.DEFAULT_RATES[product_line]
            else:
                commission_rate = Decimal("0.1000")  # fallback 10%

        gross_commission = (net_base_premium * commission_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        withholding_tax = (gross_commission * wht_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        net_commission = gross_commission - withholding_tax

        # Net Carrier Remittance = Gross Invoice Total - Net Commission
        net_carrier_remittance = gross_invoice_total - net_commission

        return {
            "net_base_premium": net_base_premium,
            "gross_invoice_total": gross_invoice_total,
            "commission_rate": commission_rate,
            "withholding_tax_rate": wht_rate,
            "gross_commission": gross_commission,
            "withholding_tax": withholding_tax,
            "net_commission": net_commission,
            "net_carrier_remittance": net_carrier_remittance,
        }
