import logging
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlmodel import Session

from app import crud
from app.models import (
    Policy,
    PolicyCreate,
    Product,
    RiskNote,
    RiskNoteCreate,
    RiskNoteStatus,
    TransactionType,
)
from app.services.rating import RatingService

logger = logging.getLogger(__name__)


def generate_risk_note_number() -> str:
    return f"RN-{uuid.uuid4().hex[:12].upper()}"


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
        cover_snapshot: dict[str, Any],
        coverage_start: date,
        coverage_end: date,
        current_user_id: uuid.UUID | None = None,
    ) -> Policy:
        """
        Create a Policy with an initial Risk Note (New Business).
        """
        product = session.get(Product, policy_in.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        try:
            validated_risk = product.validate_risk_details(cover_snapshot)
            breakdown = RatingService.calculate_breakdown(product, validated_risk)
        except Exception as e:
            logger.exception("Validation or Rating failure")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid risk details for {product.class_of_insurance}: {str(e)}",
            )

        policy = crud.create_policy(session=session, policy_in=policy_in)

        risk_note_in = RiskNoteCreate(
            policy_id=policy.id,
            transaction_type=TransactionType.NEW_BUSINESS,
            status=RiskNoteStatus.ISSUED,
            effective_date=coverage_start,
            coverage_start=coverage_start,
            coverage_end=coverage_end,
            net_premium=breakdown.net_premium,
            financial_breakdown=PolicyService.to_numeric_dict(breakdown.model_dump()),
            commission_amount=breakdown.commission_amount,
            total_amount=breakdown.total_amount,
            cover_snapshot=PolicyService.to_numeric_dict(validated_risk),
            created_by_id=current_user_id,
        )

        PolicyService.create_risk_note(session=session, risk_note_in=risk_note_in)

        return policy

    @staticmethod
    def create_endorsement(
        *,
        session: Session,
        policy_id: uuid.UUID,
        updated_cover_snapshot: dict[str, Any],
        change_description: str,
        effective_date: date | None = None,
        current_user_id: uuid.UUID | None = None,
    ) -> RiskNote:
        """
        Create a mid-term modification (Endorsement) using a full updated snapshot.
        """
        policy = session.get(Policy, policy_id)
        if not policy or not policy.product:
            raise HTTPException(status_code=404, detail="Policy or Product not found")

        # effective_date is already defaulted to date.today() in the controller/schema if null
        # but we re-verify here for service-layer safety.
        effective_date = effective_date or date.today()
        current_rn = next(
            (rn for rn in policy.risk_notes if rn.status == RiskNoteStatus.ISSUED), None
        )
        if not current_rn:
            raise HTTPException(status_code=400, detail="No active risk note found")

        try:
            validated_risk = policy.product.validate_risk_details(
                updated_cover_snapshot
            )
            full_breakdown = RatingService.calculate_breakdown(
                policy.product, validated_risk
            )
            old_full_breakdown = RatingService.calculate_breakdown(
                policy.product, current_rn.cover_snapshot
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        total_days = max(1, (current_rn.coverage_end - current_rn.coverage_start).days)
        remaining_days = max(0, (current_rn.coverage_end - effective_date).days)
        prorata_factor = Decimal(str(remaining_days)) / Decimal(str(total_days))

        delta_net = (
            (full_breakdown.net_premium - old_full_breakdown.net_premium)
            * prorata_factor
        ).quantize(Decimal("0.01"))
        delta_comm = (
            (full_breakdown.commission_amount - old_full_breakdown.commission_amount)
            * prorata_factor
        ).quantize(Decimal("0.01"))

        new_levies = full_breakdown.taxes
        old_levies = old_full_breakdown.taxes
        all_levy_keys = set(new_levies.keys()) | set(old_levies.keys())
        delta_levies = {
            k: (
                (new_levies.get(k, Decimal("0")) - old_levies.get(k, Decimal("0")))
                * prorata_factor
            ).quantize(Decimal("0.01"))
            for k in all_levy_keys
        }

        # Calculate delta for post-levy benefits (e.g., OM Rescue Plus)
        old_post_levy = (
            old_full_breakdown.total_amount
            - old_full_breakdown.net_premium
            - sum(old_levies.values())
        )
        new_post_levy = (
            full_breakdown.total_amount
            - full_breakdown.net_premium
            - sum(new_levies.values())
        )
        delta_post_levy = ((new_post_levy - old_post_levy) * prorata_factor).quantize(
            Decimal("0.01")
        )

        delta_total = delta_net + sum(delta_levies.values()) + delta_post_levy

        financial_breakdown = PolicyService.to_numeric_dict(
            {
                "new_state": full_breakdown.model_dump(),
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

        risk_note_in = RiskNoteCreate(
            policy_id=policy.id,
            transaction_type=TransactionType.ENDORSEMENT,
            previous_risk_note_id=current_rn.id,
            status=RiskNoteStatus.ISSUED,
            effective_date=effective_date,
            coverage_start=current_rn.coverage_start,
            coverage_end=current_rn.coverage_end,
            net_premium=delta_net,
            financial_breakdown=financial_breakdown,
            commission_amount=delta_comm,
            total_amount=delta_total,
            cover_snapshot=PolicyService.to_numeric_dict(validated_risk),
            special_clauses=[change_description],
            created_by_id=current_user_id,
        )

        current_rn.status = RiskNoteStatus.REPLACED
        session.add(current_rn)

        return PolicyService.create_risk_note(
            session=session, risk_note_in=risk_note_in
        )

    @staticmethod
    def create_risk_note(
        *,
        session: Session,
        risk_note_in: RiskNoteCreate,
        created_by_id: uuid.UUID | None = None,
    ) -> RiskNote:
        if created_by_id:
            risk_note_in.created_by_id = created_by_id

        if not risk_note_in.risk_note_number:
            risk_note_in.risk_note_number = generate_risk_note_number()

        risk_note = crud.create_risk_note(session=session, risk_note_in=risk_note_in)

        return risk_note


policy_service = PolicyService()
