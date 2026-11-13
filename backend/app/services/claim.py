import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlmodel import Session, func, select

from app.models import (
    Claim,
    ClaimCreate,
    ClaimEvent,
    ClaimEventCreate,
    ClaimStatus,
    ClaimUpdate,
    Policy,
    RiskNote,
    get_datetime_utc,
)


class ClaimError(Exception):
    """Base domain error for Claim operations."""


class ClaimNotFoundError(ClaimError):
    """Raised when a requested Claim does not exist or is soft-deleted."""


class ClaimValidationError(ClaimError, ValueError):
    """Raised when a Claim invariant or status transition fails."""


class ClaimService:
    ALLOWED_TRANSITIONS: dict[ClaimStatus, set[ClaimStatus]] = {
        ClaimStatus.INTIMATED: {
            ClaimStatus.DOCUMENTS_PENDING,
            ClaimStatus.ADJUSTER_APPOINTED,
            ClaimStatus.DECLINED,
            ClaimStatus.CLOSED,
        },
        ClaimStatus.DOCUMENTS_PENDING: {
            ClaimStatus.ADJUSTER_APPOINTED,
            ClaimStatus.REPAIRS_AUTHORIZED,
            ClaimStatus.DISCHARGE_VOUCHER,
            ClaimStatus.DECLINED,
            ClaimStatus.CLOSED,
        },
        ClaimStatus.ADJUSTER_APPOINTED: {
            ClaimStatus.REPAIRS_AUTHORIZED,
            ClaimStatus.DISCHARGE_VOUCHER,
            ClaimStatus.SETTLED,
            ClaimStatus.DECLINED,
            ClaimStatus.CLOSED,
        },
        ClaimStatus.REPAIRS_AUTHORIZED: {
            ClaimStatus.DISCHARGE_VOUCHER,
            ClaimStatus.SETTLED,
            ClaimStatus.CLOSED,
        },
        ClaimStatus.DISCHARGE_VOUCHER: {
            ClaimStatus.SETTLED,
            ClaimStatus.CLOSED,
        },
        ClaimStatus.SETTLED: {
            ClaimStatus.CLOSED,
        },
        ClaimStatus.DECLINED: {
            ClaimStatus.CLOSED,
        },
        ClaimStatus.CLOSED: set(),
    }

    @staticmethod
    def get_claim(*, session: Session, claim_id: uuid.UUID) -> Claim:
        claim = session.exec(
            select(Claim).where(
                Claim.id == claim_id,
                Claim.deleted_at.is_(None),  # type: ignore[union-attr]
            )
        ).first()
        if not claim:
            raise ClaimNotFoundError("Claim not found")
        return claim

    @staticmethod
    def list_claims(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        policy_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
    ) -> tuple[list[Claim], int]:
        statement = select(Claim).where(Claim.deleted_at.is_(None))  # type: ignore[union-attr]
        if policy_id:
            statement = statement.where(Claim.policy_id == policy_id)
        if client_id:
            statement = statement.join(Policy).where(Policy.client_id == client_id)

        count_statement = select(func.count()).select_from(statement.subquery())
        count = session.exec(count_statement).one()
        claims = list(session.exec(statement.offset(skip).limit(limit)).all())
        return claims, count

    @staticmethod
    def create_claim(*, session: Session, claim_in: ClaimCreate) -> Claim:
        db_obj = Claim.model_validate(claim_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def update_claim(
        *, session: Session, claim_id: uuid.UUID, claim_in: ClaimUpdate
    ) -> Claim:
        db_claim = ClaimService.get_claim(session=session, claim_id=claim_id)
        if claim_in.status is not None and claim_in.status != db_claim.status:
            if not ClaimService.validate_transition(db_claim.status, claim_in.status):
                raise ClaimValidationError(
                    f"Invalid claim status transition from {db_claim.status.value} to {claim_in.status.value}"
                )

        claim_data = claim_in.model_dump(exclude_unset=True)
        db_claim.sqlmodel_update(claim_data)
        session.add(db_claim)
        session.commit()
        session.refresh(db_claim)
        return db_claim

    @staticmethod
    def delete_claim(*, session: Session, claim_id: uuid.UUID) -> None:
        db_claim = ClaimService.get_claim(session=session, claim_id=claim_id)
        db_claim.deleted_at = get_datetime_utc()
        session.add(db_claim)
        session.commit()

    @staticmethod
    def create_claim_event(
        *, session: Session, claim_event_in: ClaimEventCreate
    ) -> ClaimEvent:
        ClaimService.get_claim(session=session, claim_id=claim_event_in.claim_id)
        db_obj = ClaimEvent.model_validate(claim_event_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def validate_transition(
        current_status: ClaimStatus, target_status: ClaimStatus
    ) -> bool:
        if current_status == target_status:
            return True
        allowed = ClaimService.ALLOWED_TRANSITIONS.get(current_status, set())
        return target_status in allowed

    @staticmethod
    def calculate_policy_loss_ratio(
        session: Session, policy_id: uuid.UUID
    ) -> dict[str, Any]:
        """
        Calculates historical loss ratio and advocacy metrics for renewal negotiations.
        Loss Ratio = (Total Settled + Open Estimated Reserves) / Total Net Earned Premium
        """
        # 1. Total Net Premium from active risk notes
        risk_notes = session.exec(
            select(RiskNote).where(RiskNote.policy_id == policy_id)
        ).all()
        total_earned_premium = sum(
            (rn.net_premium for rn in risk_notes if rn.net_premium),
            Decimal("0.00"),
        )

        # 2. Claims aggregation
        claims = session.exec(
            select(Claim).where(
                Claim.policy_id == policy_id,
                Claim.deleted_at.is_(None),  # type: ignore[union-attr]
            )
        ).all()

        total_settled = Decimal("0.00")
        total_open_reserves = Decimal("0.00")
        closed_or_declined_count = 0
        active_claims_count = 0

        for c in claims:
            if c.status == ClaimStatus.SETTLED:
                total_settled += c.settled_amount or Decimal("0.00")
            elif c.status in (ClaimStatus.DECLINED, ClaimStatus.CLOSED):
                closed_or_declined_count += 1
            else:
                active_claims_count += 1
                total_open_reserves += (
                    c.estimated_reserve
                    if c.estimated_reserve is not None
                    else (c.reserve_amount or Decimal("0.00"))
                )

        total_incurred_claims = total_settled + total_open_reserves

        if total_earned_premium > 0:
            loss_ratio_percent = (
                (total_incurred_claims / total_earned_premium) * Decimal("100.00")
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            loss_ratio_percent = Decimal("0.00")

        # Advocacy assessment
        if loss_ratio_percent <= Decimal("40.00"):
            advocacy_rating = "EXCELLENT"
            advocacy_note = (
                "Strong candidate for renewal discount and carrier concessions."
            )
        elif loss_ratio_percent <= Decimal("65.00"):
            advocacy_rating = "GOOD"
            advocacy_note = (
                "Standard renewal rates; protect existing commission and terms."
            )
        else:
            advocacy_rating = "HIGH_RISK"
            advocacy_note = "High loss ratio; anticipate carrier loaded rates or deductible revisions."

        return {
            "policy_id": str(policy_id),
            "total_earned_premium": str(total_earned_premium),
            "total_settled": str(total_settled),
            "total_open_reserves": str(total_open_reserves),
            "total_incurred_claims": str(total_incurred_claims),
            "loss_ratio_percent": str(loss_ratio_percent),
            "claims_count": len(claims),
            "active_claims_count": active_claims_count,
            "closed_or_declined_count": closed_or_declined_count,
            "advocacy_rating": advocacy_rating,
            "advocacy_note": advocacy_note,
        }


ClaimAdvocacyService = ClaimService
