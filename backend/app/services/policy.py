import logging
import uuid
from collections.abc import Sequence
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, cast

from sqlalchemy.orm import selectinload
from sqlmodel import Session, func, select

from app.models import (
    BusinessEvent,
    Policy,
    PolicyCreate,
    PolicyUpdate,
    PremiumCalculation,
    Product,
    RiskNote,
    RiskNoteCreate,
    RiskNoteRevisionCreate,
    RiskNoteStatus,
    TransactionType,
    get_datetime_utc,
)
from app.services.premium_calculation import (
    PremiumCalculationResult,
    calculate_premium,
)

logger = logging.getLogger(__name__)


class PolicyError(Exception):
    """Base domain error for Policy and RiskNote operations."""


class PolicyNotFoundError(PolicyError):
    """Raised when a requested policy, product, or risk note does not exist."""


class PolicyConflictError(PolicyError):
    """Raised when a policy operation conflicts with existing state or uniqueness."""


class PolicyValidationError(PolicyError):
    """Raised when policy or risk note input or rating validation fails."""


def generate_risk_note_number() -> str:
    return f"RN-{uuid.uuid4().hex[:12].upper()}"


def calculate_endorsement_prorata(
    *,
    old_result: PremiumCalculationResult,
    new_result: PremiumCalculationResult,
    coverage_start: date,
    coverage_end: date,
    effective_date: date,
) -> dict[str, Any]:
    """Compute pro-rata endorsement deltas and financial breakdown without DB access."""
    total_days = max(1, (coverage_end - coverage_start).days)
    remaining_days = max(0, (coverage_end - effective_date).days)
    prorata_factor = Decimal(str(remaining_days)) / Decimal(str(total_days))

    new_comm = new_result.commission_amount or Decimal("0.00")
    old_comm = old_result.commission_amount or Decimal("0.00")

    delta_net = (
        (new_result.net_premium - old_result.net_premium) * prorata_factor
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    delta_comm = ((new_comm - old_comm) * prorata_factor).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    new_levies = {
        "Training Levy": new_result.training_levy,
        "PHCF": new_result.phcf,
        "Stamp Duty": new_result.stamp_duty,
    }
    old_levies = {
        "Training Levy": old_result.training_levy,
        "PHCF": old_result.phcf,
        "Stamp Duty": old_result.stamp_duty,
    }
    all_levy_keys = set(new_levies.keys()) | set(old_levies.keys())
    delta_levies = {
        k: (
            (new_levies.get(k, Decimal("0")) - old_levies.get(k, Decimal("0")))
            * prorata_factor
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        for k in all_levy_keys
    }

    delta_total = delta_net + sum(delta_levies.values())

    new_state_breakdown = {
        "type": "base",
        "net_premium": new_result.net_premium,
        "taxes": new_levies,
        "commission_amount": new_comm,
        "total_amount": new_result.total_premium,
    }

    financial_breakdown = PolicyService.to_numeric_dict(
        {
            "new_state": new_state_breakdown,
            "delta": {
                "net_premium": delta_net,
                "total_amount": delta_total,
                "commission_amount": delta_comm,
                "levies": delta_levies,
            },
            "prorata_info": {
                "remaining_days": remaining_days,
                "total_days": total_days,
                "factor": prorata_factor,
            },
        }
    )

    return {
        "delta_net": delta_net,
        "delta_comm": delta_comm,
        "delta_levies": delta_levies,
        "delta_total": delta_total,
        "financial_breakdown": financial_breakdown,
    }


class PolicyService:
    @staticmethod
    def to_numeric_dict(data: Any) -> Any:
        """Recursively convert Decimals to strings for JSON serialization."""
        if isinstance(data, dict):
            return {k: PolicyService.to_numeric_dict(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [PolicyService.to_numeric_dict(v) for v in data]
        elif isinstance(data, Decimal):
            return str(data)
        return data

    @staticmethod
    def create_policy(
        *,
        session: Session,
        policy_in: PolicyCreate,
        cover_snapshot: dict[str, Any] | None = None,
        risk_details: dict[str, Any] | None = None,
        coverage_start: date,
        coverage_end: date,
        current_user_id: uuid.UUID | None = None,
    ) -> Policy:
        """
        Create a Policy with an initial Risk Note (New Business) in a single atomic transaction.
        """
        existing = PolicyService.get_policy_by_policy_number(
            session=session, policy_number=policy_in.policy_number
        )
        if existing:
            raise PolicyConflictError(
                "The policy with this number already exists in the system."
            )

        effective_snapshot = (
            cover_snapshot if cover_snapshot is not None else (risk_details or {})
        )
        product = session.get(Product, policy_in.product_id)
        if not product or product.deleted_at is not None:
            raise PolicyNotFoundError("Product not found")

        try:
            result = calculate_premium(
                inputs=effective_snapshot,
                product=product,
                session=session,
                as_of_date=coverage_start,
            )
        except Exception as e:
            logger.exception("Validation or Rating failure")
            raise PolicyValidationError(
                f"Invalid risk details for {product.class_of_insurance}: {str(e)}"
            ) from e

        policy = Policy.model_validate(policy_in)
        session.add(policy)
        session.flush()

        financial_breakdown = PolicyService.to_numeric_dict(
            {
                "type": "base",
                "net_premium": result.net_premium,
                "taxes": {
                    "Training Levy": result.training_levy,
                    "PHCF": result.phcf,
                    "Stamp Duty": result.stamp_duty,
                },
                "commission_amount": result.commission_amount or Decimal("0.00"),
                "total_amount": result.total_premium,
            }
        )

        risk_note_in = RiskNoteCreate(
            policy_id=policy.id,
            transaction_type=TransactionType.NEW_BUSINESS,
            status=RiskNoteStatus.ISSUED,
            effective_date=coverage_start,
            coverage_start=coverage_start,
            coverage_end=coverage_end,
            net_premium=result.net_premium,
            financial_breakdown=financial_breakdown,
            commission_amount=result.commission_amount or Decimal("0.00"),
            total_amount=result.total_premium,
            cover_snapshot=PolicyService.to_numeric_dict(result.input_snapshot),
            created_by_id=current_user_id,
        )

        PolicyService._add_risk_note(session=session, risk_note_in=risk_note_in)

        calc = PremiumCalculation(
            policy_id=policy.id,
            business_event=BusinessEvent.NEW_BUSINESS,
            rating_date=coverage_start,
            rate_table_version_id=result.rate_table_version_id,
            input_snapshot=PolicyService.to_numeric_dict(result.input_snapshot),
            rule_provenance=PolicyService.to_numeric_dict(result.rule_provenance),
            calculation_detail=PolicyService.to_numeric_dict(result.calculation_detail),
            total_premium=result.total_premium,
            is_selected=True,
            created_by_id=current_user_id,
        )
        session.add(calc)
        session.commit()
        session.refresh(policy)

        return policy

    @staticmethod
    def create_policy_container(*, session: Session, policy_in: PolicyCreate) -> Policy:
        """Persist a Policy container without rating or RiskNote generation (e.g., Medical or seeded policies)."""
        existing = PolicyService.get_policy_by_policy_number(
            session=session, policy_number=policy_in.policy_number
        )
        if existing:
            raise PolicyConflictError(
                "The policy with this number already exists in the system."
            )
        policy = Policy.model_validate(policy_in)
        session.add(policy)
        session.commit()
        session.refresh(policy)
        return policy

    @staticmethod
    def get_policy(*, session: Session, policy_id: uuid.UUID) -> Policy:
        statement = (
            select(Policy)
            .where(Policy.id == policy_id)
            .where(Policy.deleted_at == None)
            .options(selectinload(cast(Any, Policy.product)))
        )
        policy = session.exec(statement).first()
        if not policy:
            raise PolicyNotFoundError("Policy not found")
        return policy

    @staticmethod
    def get_policies_by_client_id(
        *, session: Session, client_id: uuid.UUID
    ) -> Sequence[Policy]:
        statement = (
            select(Policy)
            .where(Policy.client_id == client_id)
            .where(Policy.deleted_at == None)
            .options(selectinload(cast(Any, Policy.product)))
        )
        return session.exec(statement).all()

    @staticmethod
    def list_policies(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        client_id: uuid.UUID | None = None,
    ) -> tuple[list[Policy], int]:
        base = select(Policy).where(Policy.deleted_at == None)
        if client_id:
            base = base.where(Policy.client_id == client_id)
        count_stmt = select(func.count()).select_from(base.subquery())
        count = session.exec(count_stmt).one()
        items_stmt = (
            base.options(selectinload(cast(Any, Policy.product)))
            .offset(skip)
            .limit(limit)
        )
        items = list(session.exec(items_stmt).all())
        return items, count

    @staticmethod
    def update_policy(
        *, session: Session, policy_id: uuid.UUID, policy_in: PolicyUpdate
    ) -> Policy:
        db_policy = PolicyService.get_policy(session=session, policy_id=policy_id)
        policy_data = policy_in.model_dump(exclude_unset=True)
        new_number = policy_data.get("policy_number")
        if new_number and new_number != db_policy.policy_number:
            existing = PolicyService.get_policy_by_policy_number(
                session=session, policy_number=new_number
            )
            if existing and existing.id != db_policy.id:
                raise PolicyConflictError(
                    "The policy with this number already exists in the system."
                )
        db_policy.sqlmodel_update(policy_data)
        session.add(db_policy)
        session.commit()
        session.refresh(db_policy)
        return db_policy

    @staticmethod
    def delete_policy(*, session: Session, policy_id: uuid.UUID) -> None:
        db_policy = PolicyService.get_policy(session=session, policy_id=policy_id)
        db_policy.deleted_at = get_datetime_utc()
        session.add(db_policy)
        session.commit()

    @staticmethod
    def create_endorsement(
        *,
        session: Session,
        policy_id: uuid.UUID,
        updated_cover_snapshot: dict[str, Any] | None = None,
        updated_risk_details: dict[str, Any] | None = None,
        change_description: str,
        effective_date: date | None = None,
        current_user_id: uuid.UUID | None = None,
    ) -> RiskNote:
        """
        Create a mid-term modification (Endorsement) using a full updated snapshot in a single atomic transaction.
        """
        policy = session.exec(
            select(Policy)
            .where(Policy.id == policy_id)
            .where(Policy.deleted_at == None)
            .options(selectinload(cast(Any, Policy.product)))
        ).first()
        if not policy or not policy.product:
            raise PolicyNotFoundError("Policy or Product not found")

        effective_snapshot = (
            updated_cover_snapshot
            if updated_cover_snapshot is not None
            else (updated_risk_details or {})
        )

        # effective_date is already defaulted to date.today() in the controller/schema if null
        # but we re-verify here for service-layer safety.
        effective_date = effective_date or date.today()
        current_rn = next(
            (
                rn
                for rn in policy.risk_notes
                if rn.status == RiskNoteStatus.ISSUED and rn.deleted_at is None
            ),
            None,
        )
        if not current_rn:
            raise PolicyValidationError("No active risk note found")

        try:
            new_result = calculate_premium(
                inputs=effective_snapshot,
                product=policy.product,
                session=session,
                as_of_date=effective_date,
            )
            old_result = calculate_premium(
                inputs=current_rn.cover_snapshot,
                product=policy.product,
                session=session,
                as_of_date=effective_date,
                validate_inputs=False,
            )
        except Exception as e:
            raise PolicyValidationError(str(e)) from e

        prorata = calculate_endorsement_prorata(
            old_result=old_result,
            new_result=new_result,
            coverage_start=current_rn.coverage_start,
            coverage_end=current_rn.coverage_end,
            effective_date=effective_date,
        )

        risk_note_in = RiskNoteCreate(
            policy_id=policy.id,
            transaction_type=TransactionType.ENDORSEMENT,
            previous_risk_note_id=current_rn.id,
            status=RiskNoteStatus.ISSUED,
            effective_date=effective_date,
            coverage_start=current_rn.coverage_start,
            coverage_end=current_rn.coverage_end,
            net_premium=prorata["delta_net"],
            financial_breakdown=prorata["financial_breakdown"],
            commission_amount=prorata["delta_comm"],
            total_amount=prorata["delta_total"],
            cover_snapshot=PolicyService.to_numeric_dict(new_result.input_snapshot),
            special_clauses=[change_description],
            created_by_id=current_user_id,
        )

        current_rn.status = RiskNoteStatus.REPLACED
        session.add(current_rn)

        endorsement_rn = PolicyService._add_risk_note(
            session=session, risk_note_in=risk_note_in
        )

        endorsement_calc = PremiumCalculation(
            policy_id=policy.id,
            business_event=BusinessEvent.COVER_CHANGE,
            rating_date=effective_date,
            rate_table_version_id=new_result.rate_table_version_id,
            input_snapshot=PolicyService.to_numeric_dict(new_result.input_snapshot),
            rule_provenance=PolicyService.to_numeric_dict(new_result.rule_provenance),
            calculation_detail=PolicyService.to_numeric_dict(
                new_result.calculation_detail
            ),
            total_premium=new_result.total_premium,
            is_selected=True,
            created_by_id=current_user_id,
        )
        session.add(endorsement_calc)
        session.commit()
        session.refresh(endorsement_rn)

        return endorsement_rn

    @staticmethod
    def get_policy_by_policy_number(
        *, session: Session, policy_number: str
    ) -> Policy | None:
        statement = (
            select(Policy)
            .where(Policy.policy_number == policy_number)
            .where(Policy.deleted_at == None)
        )
        return session.exec(statement).first()

    @staticmethod
    def _add_risk_note(
        *,
        session: Session,
        risk_note_in: RiskNoteCreate,
        created_by_id: uuid.UUID | None = None,
    ) -> RiskNote:
        if created_by_id:
            risk_note_in.created_by_id = created_by_id
        if not risk_note_in.risk_note_number:
            risk_note_in.risk_note_number = generate_risk_note_number()

        risk_note = RiskNote.model_validate(risk_note_in)
        session.add(risk_note)
        return risk_note

    @staticmethod
    def create_risk_note(
        *,
        session: Session,
        risk_note_in: RiskNoteCreate,
        created_by_id: uuid.UUID | None = None,
    ) -> RiskNote:
        """Persist a standalone RiskNote and commit atomically."""
        risk_note = PolicyService._add_risk_note(
            session=session, risk_note_in=risk_note_in, created_by_id=created_by_id
        )
        session.commit()
        session.refresh(risk_note)
        return risk_note

    @staticmethod
    def get_risk_note(*, session: Session, risk_note_id: uuid.UUID) -> RiskNote:
        risk_note = session.exec(
            select(RiskNote)
            .where(RiskNote.id == risk_note_id)
            .where(RiskNote.deleted_at == None)
        ).first()
        if not risk_note:
            raise PolicyNotFoundError("Risk note not found")
        return risk_note

    @staticmethod
    def list_risk_notes(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        policy_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        uninvoiced_only: bool = False,
    ) -> tuple[list[RiskNote], int]:
        statement = select(RiskNote).where(RiskNote.deleted_at == None)
        if policy_id:
            statement = statement.where(RiskNote.policy_id == policy_id)
        if client_id:
            statement = statement.join(Policy).where(
                Policy.client_id == client_id, Policy.deleted_at == None
            )
        if uninvoiced_only:
            statement = statement.where(~RiskNote.invoice_line_items.any())  # type: ignore[attr-defined]
            statement = statement.where(RiskNote.status != RiskNoteStatus.DRAFT)
        count_stmt = select(func.count()).select_from(statement.subquery())
        count = session.exec(count_stmt).one()
        items = list(session.exec(statement.offset(skip).limit(limit)).all())
        return items, count

    @staticmethod
    def create_risk_note_revision(
        *,
        session: Session,
        risk_note_id: uuid.UUID,
        revision_in: RiskNoteRevisionCreate,
        created_by_id: uuid.UUID,
    ) -> RiskNote:
        """Append a non-financial clause revision and mark the prior risk note as REPLACED atomically."""
        current_rn = PolicyService.get_risk_note(
            session=session, risk_note_id=risk_note_id
        )
        if current_rn.status == RiskNoteStatus.REPLACED:
            raise PolicyValidationError("Risk note has already been replaced")

        risk_note_in = RiskNoteCreate(
            policy_id=current_rn.policy_id,
            transaction_type=current_rn.transaction_type,
            status=RiskNoteStatus.ISSUED,
            previous_risk_note_id=current_rn.id,
            effective_date=current_rn.effective_date,
            coverage_start=current_rn.coverage_start,
            coverage_end=current_rn.coverage_end,
            net_premium=current_rn.net_premium,
            financial_breakdown=current_rn.financial_breakdown,
            commission_amount=current_rn.commission_amount,
            total_amount=current_rn.total_amount,
            cover_snapshot=(
                revision_in.cover_snapshot
                if revision_in.cover_snapshot is not None
                else current_rn.cover_snapshot
            ),
            special_clauses=revision_in.special_clauses,
            created_by_id=created_by_id,
        )

        current_rn.status = RiskNoteStatus.REPLACED
        session.add(current_rn)

        revised_rn = PolicyService._add_risk_note(
            session=session, risk_note_in=risk_note_in
        )
        session.commit()
        session.refresh(revised_rn)
        return revised_rn


policy_service = PolicyService()
