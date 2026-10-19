import logging
import uuid

from fastapi import HTTPException, status
from sqlmodel import Session

from app import crud
from app.models import (
    Policy,
    Renewal,
    RenewalCreate,
    RenewalStatus,
    RenewalTransition,
    RenewalUpdate,
    get_datetime_utc,
)

logger = logging.getLogger(__name__)

# Valid state machine transitions
ALLOWED_TRANSITIONS: dict[RenewalStatus, set[RenewalStatus]] = {
    RenewalStatus.AWAITING_CARRIER: {
        RenewalStatus.CARRIER_RECEIVED,
        RenewalStatus.CANCELLED,
    },
    RenewalStatus.CARRIER_RECEIVED: {
        RenewalStatus.CLIENT_INVITED,
        RenewalStatus.CANCELLED,
    },
    RenewalStatus.CLIENT_INVITED: {
        RenewalStatus.CHANGES_REQUESTED,
        RenewalStatus.PAID,
        RenewalStatus.CANCELLED,
    },
    RenewalStatus.CHANGES_REQUESTED: {
        RenewalStatus.CLIENT_INVITED,
        RenewalStatus.CANCELLED,
    },
    RenewalStatus.PAID: {
        RenewalStatus.COMPLETED,
        RenewalStatus.CANCELLED,
    },
    RenewalStatus.COMPLETED: set(),  # Terminal
    RenewalStatus.CANCELLED: set(),  # Terminal
}


class RenewalService:
    @staticmethod
    def create_renewal(
        *,
        session: Session,
        renewal_in: RenewalCreate,
    ) -> Renewal:
        """Create a new renewal enforcing the single-active-renewal invariant."""
        policy = session.get(Policy, renewal_in.policy_id)
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")

        active_renewal = crud.get_active_renewal_by_policy(
            session, policy_id=renewal_in.policy_id
        )
        if active_renewal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Policy {policy.policy_number} already has an active renewal ({active_renewal.id}) in state '{active_renewal.status}'.",
            )

        return crud.create_renewal(session=session, renewal_in=renewal_in)

    @staticmethod
    def transition_renewal(
        *,
        session: Session,
        renewal_id: uuid.UUID,
        transition_in: RenewalTransition,
    ) -> Renewal:
        """
        Transition a renewal to a new status under Optimistic Concurrency Control (OCC).
        """
        renewal = crud.get_renewal(session=session, renewal_id=renewal_id)
        if not renewal:
            raise HTTPException(status_code=404, detail="Renewal not found")

        # 1. Optimistic Concurrency Control Check
        if renewal.version != transition_in.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "renewal_modified_concurrently",
                    "message": "Renewal was modified concurrently by another process. Please reload and try again.",
                    "current_version": renewal.version,
                    "provided_version": transition_in.version,
                },
            )

        # 2. State Machine Validation
        target = transition_in.target_status
        allowed = ALLOWED_TRANSITIONS.get(renewal.status, set())
        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid renewal transition from '{renewal.status}' to '{target}'. Permitted: {[s.value for s in allowed]}",
            )

        # 3. Apply state and tracking timestamps
        now = get_datetime_utc()
        renewal.status = target
        renewal.version += 1

        if target == RenewalStatus.CARRIER_RECEIVED:
            renewal.carrier_received_at = now
        elif target == RenewalStatus.CLIENT_INVITED:
            renewal.invited_at = now
        elif target == RenewalStatus.PAID:
            renewal.paid_at = now
        elif target == RenewalStatus.COMPLETED:
            renewal.completed_at = now

        if transition_in.agreed_premium is not None:
            renewal.agreed_premium = transition_in.agreed_premium

        if transition_in.notes:
            renewal.notes = (
                f"{renewal.notes}\n[{now.isoformat()}] {transition_in.notes}"
                if renewal.notes
                else f"[{now.isoformat()}] {transition_in.notes}"
            )

        session.add(renewal)
        session.commit()
        session.refresh(renewal)
        return renewal

    @staticmethod
    def update_renewal(
        *,
        session: Session,
        renewal_id: uuid.UUID,
        renewal_in: RenewalUpdate,
    ) -> Renewal:
        """Update renewal metadata with OCC verification."""
        renewal = crud.get_renewal(session=session, renewal_id=renewal_id)
        if not renewal:
            raise HTTPException(status_code=404, detail="Renewal not found")

        if renewal.version != renewal_in.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "renewal_modified_concurrently",
                    "message": "Renewal was modified concurrently. Please reload.",
                    "current_version": renewal.version,
                    "provided_version": renewal_in.version,
                },
            )

        return crud.update_renewal(
            session=session, db_renewal=renewal, renewal_in=renewal_in
        )
