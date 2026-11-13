import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlmodel import Session, func, select

from app.models import (
    IPFAgreement,
    IPFAgreementCreate,
    IPFAgreementUpdate,
    IPFStatus,
)


class IPFError(Exception):
    """Base domain error for IPF operations."""


class IPFNotFoundError(IPFError):
    """Raised when an IPF agreement does not exist or is soft-deleted."""


class IPFValidationError(IPFError, ValueError):
    """Raised when IPF terms or status transition invariants fail."""


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
            raise IPFValidationError("Total financed amount must be greater than zero.")
        if number_of_installments <= 0:
            raise IPFValidationError("Number of installments must be at least 1.")

        min_deposit = (total_financed_amount * IPFService.MIN_DEPOSIT_PERCENT).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if deposit_amount < min_deposit:
            raise IPFValidationError(
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

    @staticmethod
    def get_ipf_agreement(*, session: Session, ipf_id: uuid.UUID) -> IPFAgreement:
        agreement = session.exec(
            select(IPFAgreement).where(
                IPFAgreement.id == ipf_id,
                IPFAgreement.deleted_at.is_(None),  # type: ignore[union-attr]
            )
        ).first()
        if not agreement:
            raise IPFNotFoundError("IPF agreement not found")
        return agreement

    @staticmethod
    def list_ipf_agreements(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        client_id: uuid.UUID | None = None,
        policy_id: uuid.UUID | None = None,
    ) -> tuple[list[IPFAgreement], int]:
        statement = select(IPFAgreement).where(IPFAgreement.deleted_at.is_(None))  # type: ignore[union-attr]
        if client_id:
            statement = statement.where(IPFAgreement.client_id == client_id)
        if policy_id:
            statement = statement.where(IPFAgreement.policy_id == policy_id)

        count_statement = select(func.count()).select_from(statement.subquery())
        count = session.exec(count_statement).one()
        agreements = list(
            session.exec(
                statement.order_by(IPFAgreement.created_at.desc())  # type: ignore[attr-defined]
                .offset(skip)
                .limit(limit)
            ).all()
        )
        return agreements, count

    @staticmethod
    def create_ipf_agreement(
        *, session: Session, ipf_in: IPFAgreementCreate
    ) -> IPFAgreement:
        terms = IPFService.validate_and_calculate_terms(
            total_financed_amount=ipf_in.total_financed_amount,
            deposit_amount=ipf_in.deposit_amount,
            number_of_installments=ipf_in.number_of_installments,
        )
        db_ipf = IPFAgreement.model_validate(
            ipf_in, update={"monthly_installment": terms["monthly_installment"]}
        )
        session.add(db_ipf)
        session.commit()
        session.refresh(db_ipf)
        return db_ipf

    @staticmethod
    def update_ipf_agreement(
        *, session: Session, ipf_id: uuid.UUID, ipf_in: IPFAgreementUpdate
    ) -> IPFAgreement:
        db_ipf = IPFService.get_ipf_agreement(session=session, ipf_id=ipf_id)

        if ipf_in.status is not None and ipf_in.status != db_ipf.status:
            has_doc = bool(
                ipf_in.commitment_letter_document_id
                or db_ipf.commitment_letter_document_id
            )
            if not IPFService.can_transition(db_ipf.status, ipf_in.status, has_doc):
                raise IPFValidationError(
                    f"Invalid IPF status transition from {db_ipf.status.value} to {ipf_in.status.value}"
                    + (
                        " (verified commitment letter document required for GUARANTEE)"
                        if ipf_in.status == IPFStatus.GUARANTEED
                        else ""
                    )
                )

        update_data = ipf_in.model_dump(exclude_unset=True)
        db_ipf.sqlmodel_update(update_data)
        session.add(db_ipf)
        session.commit()
        session.refresh(db_ipf)
        return db_ipf
