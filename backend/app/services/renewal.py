import logging
import uuid
from datetime import date

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, func, select

from app.models import (
    Client,
    Invitation,
    InvitationCreate,
    Policy,
    PolicyPublic,
    PolicyStatus,
    PremiumCalculation,
    Renewal,
    RenewalCreate,
    RenewalHorizonItem,
    RenewalHorizonResponse,
    RenewalPublic,
    RenewalStatus,
    RenewalTransition,
    RenewalUpdate,
    get_datetime_utc,
)

logger = logging.getLogger(__name__)


class RenewalError(Exception):
    """Base domain error for Renewal and Invitation operations."""


class RenewalNotFoundError(RenewalError):
    """Raised when a requested renewal, policy, or calculation does not exist."""


class RenewalValidationError(RenewalError):
    """Raised when a renewal invariant or state transition is invalid."""


class RenewalConflictError(RenewalError):
    """Raised on optimistic concurrency version mismatch."""

    def __init__(
        self,
        message: str,
        *,
        current_version: int,
        provided_version: int,
    ) -> None:
        super().__init__(message)
        self.current_version = current_version
        self.provided_version = provided_version


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

TERMINAL_STATUSES = [RenewalStatus.COMPLETED, RenewalStatus.CANCELLED]


class RenewalService:
    @staticmethod
    def _get_active_renewal_row(
        *, session: Session, renewal_id: uuid.UUID
    ) -> Renewal:
        statement = select(Renewal).where(
            Renewal.id == renewal_id,
            Renewal.deleted_at.is_(None),
        )
        renewal = session.exec(statement).first()
        if not renewal:
            raise RenewalNotFoundError("Renewal not found")
        return renewal

    @staticmethod
    def get_renewal(*, session: Session, renewal_id: uuid.UUID) -> Renewal:
        """Retrieve a non-deleted renewal by ID or raise RenewalNotFoundError."""
        return RenewalService._get_active_renewal_row(
            session=session, renewal_id=renewal_id
        )

    @staticmethod
    def get_active_renewal_by_policy(
        *, session: Session, policy_id: uuid.UUID
    ) -> Renewal | None:
        """Return the active (non-terminal, non-deleted) renewal for a policy, if any."""
        statement = (
            select(Renewal)
            .where(Renewal.policy_id == policy_id)
            .where(col(Renewal.status).notin_(TERMINAL_STATUSES))
            .where(Renewal.deleted_at.is_(None))
        )
        return session.exec(statement).first()

    @staticmethod
    def get_horizon(*, session: Session) -> RenewalHorizonResponse:
        """Compute overdue, 0_30, 31_60, and 61_90 expiration buckets across all active policies."""
        today = date.today()
        statement = (
            select(Policy, Client.name)
            .join(Client, Policy.client_id == Client.id)
            .where(Policy.deleted_at.is_(None))
            .where(Policy.status == PolicyStatus.ACTIVE)
            .options(selectinload(Policy.risk_notes), selectinload(Policy.renewals))  # type: ignore[arg-type]
        )
        rows = session.exec(statement).all()

        overdue: list[RenewalHorizonItem] = []
        bucket_0_30: list[RenewalHorizonItem] = []
        bucket_31_60: list[RenewalHorizonItem] = []
        bucket_61_90: list[RenewalHorizonItem] = []

        for policy, client_name in rows:
            active_notes = [
                n for n in policy.risk_notes if n.deleted_at is None and n.coverage_end
            ]
            if not active_notes:
                continue
            active_notes.sort(key=lambda n: n.created_at, reverse=True)
            active_note = active_notes[0]

            days_left = (active_note.coverage_end - today).days
            if days_left > 90:
                continue

            active_renewals = [r for r in policy.renewals if r.deleted_at is None]
            non_terminal = [
                r for r in active_renewals if r.status not in TERMINAL_STATUSES
            ]
            chosen_renewal = (
                non_terminal[0]
                if non_terminal
                else (active_renewals[0] if active_renewals else None)
            )

            item = RenewalHorizonItem(
                policy_id=policy.id,
                policy_number=policy.policy_number,
                client_id=policy.client_id,
                client_name=client_name,
                coverage_end=active_note.coverage_end,
                days_left=days_left,
                policy=PolicyPublic.model_validate(policy),
                renewal=(
                    RenewalPublic.model_validate(chosen_renewal)
                    if chosen_renewal
                    else None
                ),
            )

            if days_left < 0:
                overdue.append(item)
            elif days_left <= 30:
                bucket_0_30.append(item)
            elif days_left <= 60:
                bucket_31_60.append(item)
            else:
                bucket_61_90.append(item)

        overdue.sort(key=lambda x: x.days_left)
        bucket_0_30.sort(key=lambda x: x.days_left)
        bucket_31_60.sort(key=lambda x: x.days_left)
        bucket_61_90.sort(key=lambda x: x.days_left)

        return RenewalHorizonResponse(
            overdue=overdue,
            bucket_0_30=bucket_0_30,
            bucket_31_60=bucket_31_60,
            bucket_61_90=bucket_61_90,
        )

    @staticmethod
    def get_renewals(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        policy_id: uuid.UUID | None = None,
        status: RenewalStatus | None = None,
    ) -> list[Renewal]:
        """List non-deleted renewals with optional policy and status filtering."""
        statement = select(Renewal).where(Renewal.deleted_at.is_(None))
        if policy_id:
            statement = statement.where(Renewal.policy_id == policy_id)
        if status:
            statement = statement.where(Renewal.status == status)
        statement = (
            statement.order_by(Renewal.renewal_period_start.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(session.exec(statement).all())

    @staticmethod
    def count_renewals(
        *,
        session: Session,
        policy_id: uuid.UUID | None = None,
        status: RenewalStatus | None = None,
    ) -> int:
        """Count non-deleted renewals matching optional policy and status filters."""
        statement = select(Renewal).where(Renewal.deleted_at.is_(None))
        if policy_id:
            statement = statement.where(Renewal.policy_id == policy_id)
        if status:
            statement = statement.where(Renewal.status == status)
        count_statement = select(func.count()).select_from(statement.subquery())
        return session.exec(count_statement).one()

    @staticmethod
    def create_renewal(
        *,
        session: Session,
        renewal_in: RenewalCreate,
    ) -> Renewal:
        """Create a new renewal enforcing the single-active-renewal invariant."""
        policy = session.exec(
            select(Policy).where(
                Policy.id == renewal_in.policy_id,
                Policy.deleted_at.is_(None),
            )
        ).first()
        if not policy:
            raise RenewalNotFoundError("Policy not found")

        active_renewal = RenewalService.get_active_renewal_by_policy(
            session=session, policy_id=renewal_in.policy_id
        )
        if active_renewal:
            raise RenewalValidationError(
                f"Policy {policy.policy_number} already has an active renewal "
                f"({active_renewal.id}) in state '{active_renewal.status}'."
            )

        db_renewal = Renewal.model_validate(renewal_in)
        session.add(db_renewal)
        session.commit()
        session.refresh(db_renewal)
        return db_renewal

    @staticmethod
    def transition_renewal(
        *,
        session: Session,
        renewal_id: uuid.UUID,
        transition_in: RenewalTransition,
    ) -> Renewal:
        """Transition a renewal to a new status under Optimistic Concurrency Control."""
        renewal = RenewalService._get_active_renewal_row(
            session=session, renewal_id=renewal_id
        )

        if renewal.version != transition_in.version:
            raise RenewalConflictError(
                "Renewal was modified concurrently by another process. Please reload and try again.",
                current_version=renewal.version,
                provided_version=transition_in.version,
            )

        target = transition_in.target_status
        allowed = ALLOWED_TRANSITIONS.get(renewal.status, set())
        if target not in allowed:
            raise RenewalValidationError(
                f"Invalid renewal transition from '{renewal.status}' to '{target}'. "
                f"Permitted: {[s.value for s in allowed]}"
            )

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
        renewal = RenewalService._get_active_renewal_row(
            session=session, renewal_id=renewal_id
        )

        if renewal.version != renewal_in.version:
            raise RenewalConflictError(
                "Renewal was modified concurrently. Please reload.",
                current_version=renewal.version,
                provided_version=renewal_in.version,
            )

        update_data = renewal_in.model_dump(exclude_unset=True, exclude={"version"})
        renewal.sqlmodel_update(update_data)
        renewal.version += 1
        session.add(renewal)
        session.commit()
        session.refresh(renewal)
        return renewal

    @staticmethod
    def create_invitation(
        *,
        session: Session,
        invitation_in: InvitationCreate,
        user_id: uuid.UUID | None = None,
    ) -> Invitation:
        """Create a renewal invitation linked to an existing renewal and calculation."""
        RenewalService._get_active_renewal_row(
            session=session, renewal_id=invitation_in.renewal_id
        )
        calculation = session.get(PremiumCalculation, invitation_in.calculation_id)
        if not calculation:
            raise RenewalNotFoundError("Premium calculation not found")

        invitation_data = invitation_in.model_dump()
        db_invitation = Invitation(**invitation_data, created_by_id=user_id)
        session.add(db_invitation)
        session.commit()
        session.refresh(db_invitation)
        return db_invitation

    @staticmethod
    def get_invitations_for_renewal(
        *,
        session: Session,
        renewal_id: uuid.UUID,
    ) -> list[Invitation]:
        """List invitations for a renewal ordered by most recently generated."""
        statement = (
            select(Invitation)
            .where(Invitation.renewal_id == renewal_id)
            .order_by(Invitation.generated_at.desc())
        )
        return list(session.exec(statement).all())
