from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.models import (
    IPFStatus,
)


class IPFService:
    MIN_DEPOSIT_PERCENT = Decimal("0.20")  # Minimum 20% deposit

    @staticmethod
    def validate_and_calculate_terms(
        total_financed_amount: Decimal,
        deposit_amount: Decimal,
        number_of_installments: int,
    ) -> dict[str, Any]:
        """
        Validates the 20% minimum deposit invariant and calculates equal monthly installments.
        """
        if total_financed_amount <= 0:
            raise ValueError("Total financed amount must be greater than zero.")
        if number_of_installments <= 0:
            raise ValueError("Number of installments must be at least 1.")

        min_deposit = (total_financed_amount * IPFService.MIN_DEPOSIT_PERCENT).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if deposit_amount < min_deposit:
            raise ValueError(
                f"Deposit amount ({deposit_amount}) is less than the statutory minimum 20% ({min_deposit})."
            )

        principal_financed = total_financed_amount - deposit_amount
        monthly_installment = (
            principal_financed / Decimal(str(number_of_installments))
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "total_financed_amount": total_financed_amount,
            "deposit_amount": deposit_amount,
            "min_required_deposit": min_deposit,
            "principal_financed": principal_financed,
            "number_of_installments": number_of_installments,
            "monthly_installment": monthly_installment,
        }

    @staticmethod
    def can_transition(
        current_status: IPFStatus, target_status: IPFStatus, has_commitment_letter: bool
    ) -> bool:
        """
        Validates allowed IPF status transitions according to Section 156A compliance.
        """
        valid_transitions = {
            IPFStatus.PENDING_DEPOSIT: [IPFStatus.GUARANTEED, IPFStatus.CANCELLED],
            IPFStatus.GUARANTEED: [IPFStatus.DISBURSED, IPFStatus.CANCELLED],
            IPFStatus.DISBURSED: [],
            IPFStatus.CANCELLED: [],
        }
        if target_status not in valid_transitions.get(current_status, []):
            return False

        # Transitioning to GUARANTEED requires verified bank commitment letter
        if target_status == IPFStatus.GUARANTEED and not has_commitment_letter:
            return False

        return True
