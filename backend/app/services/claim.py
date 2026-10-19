import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlmodel import Session, select

from app.models import Claim, ClaimStatus, RiskNote


class ClaimAdvocacyService:
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
    def validate_transition(
        current_status: ClaimStatus, target_status: ClaimStatus
    ) -> bool:
        if current_status == target_status:
            return True
        allowed = ClaimAdvocacyService.ALLOWED_TRANSITIONS.get(current_status, set())
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
        claims = session.exec(select(Claim).where(Claim.policy_id == policy_id)).all()

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
