import logging
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlmodel import Session

from app import crud
from app.models import (
    BusinessEvent,
    Policy,
    PolicyCreate,
    PremiumCalculation,
    Product,
    RiskNote,
    RiskNoteCreate,
    RiskNoteStatus,
    TransactionType,
)
from app.services.premium_calculation import calculate_premium

logger = logging.getLogger(__name__)


def generate_risk_note_number() -> str:
    return f"RN-{uuid.uuid4().hex[:12].upper()}"


class PolicyService:
    @staticmethod
    def normalize_rating_inputs(inputs: dict[str, Any]) -> dict[str, Any]:
        """Flatten nested vehicle.sum_insured when top-level sum_insured is absent."""
        normalized = dict(inputs)
        if "sum_insured" not in normalized and isinstance(normalized.get("vehicle"), dict):
            vehicle_sum = normalized["vehicle"].get("sum_insured")
            if vehicle_sum is not None:
                normalized["sum_insured"] = vehicle_sum
        return normalized

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
        Create a Policy with an initial Risk Note (New Business).
        """
        effective_snapshot = (
            cover_snapshot if cover_snapshot is not None else (risk_details or {})
        )
        product = session.get(Product, policy_in.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        try:
            validated_risk = product.validate_risk_details(effective_snapshot)
            result = calculate_premium(
                inputs=PolicyService.normalize_rating_inputs(validated_risk),
                product=product,
                session=session,
                as_of_date=coverage_start,
                manual_net_premium=validated_risk.get("manual_net_premium"),
            )
        except Exception as e:
            logger.exception("Validation or Rating failure")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid risk details for {product.class_of_insurance}: {str(e)}",
            )

        policy = crud.create_policy(session=session, policy_in=policy_in)

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
            cover_snapshot=PolicyService.to_numeric_dict(validated_risk),
            created_by_id=current_user_id,
        )

        PolicyService.create_risk_note(session=session, risk_note_in=risk_note_in)

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

        return policy

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
        Create a mid-term modification (Endorsement) using a full updated snapshot.
        """
        policy = session.get(Policy, policy_id)
        if not policy or not policy.product:
            raise HTTPException(status_code=404, detail="Policy or Product not found")

        effective_snapshot = (
            updated_cover_snapshot
            if updated_cover_snapshot is not None
            else (updated_risk_details or {})
        )

        # effective_date is already defaulted to date.today() in the controller/schema if null
        # but we re-verify here for service-layer safety.
        effective_date = effective_date or date.today()
        current_rn = next(
            (rn for rn in policy.risk_notes if rn.status == RiskNoteStatus.ISSUED), None
        )
        if not current_rn:
            raise HTTPException(status_code=400, detail="No active risk note found")

        try:
            validated_risk = policy.product.validate_risk_details(effective_snapshot)
            new_inputs = PolicyService.normalize_rating_inputs(validated_risk)
            new_result = calculate_premium(
                inputs=new_inputs,
                product=policy.product,
                session=session,
                as_of_date=effective_date,
                manual_net_premium=new_inputs.get("manual_net_premium"),
            )
            old_inputs = PolicyService.normalize_rating_inputs(current_rn.cover_snapshot)
            old_result = calculate_premium(
                inputs=old_inputs,
                product=policy.product,
                session=session,
                as_of_date=effective_date,
                manual_net_premium=old_inputs.get("manual_net_premium"),
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        total_days = max(1, (current_rn.coverage_end - current_rn.coverage_start).days)
        remaining_days = max(0, (current_rn.coverage_end - effective_date).days)
        prorata_factor = Decimal(str(remaining_days)) / Decimal(str(total_days))

        new_comm = new_result.commission_amount or Decimal("0.00")
        old_comm = old_result.commission_amount or Decimal("0.00")

        delta_net = (
            (new_result.net_premium - old_result.net_premium) * prorata_factor
        ).quantize(Decimal("0.01"))
        delta_comm = ((new_comm - old_comm) * prorata_factor).quantize(Decimal("0.01"))

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
            ).quantize(Decimal("0.01"))
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

        endorsement_rn = PolicyService.create_risk_note(
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

        return endorsement_rn

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
