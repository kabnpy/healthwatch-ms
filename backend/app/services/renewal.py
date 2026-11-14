import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, col, func, select

from app.models import (
    Invitation,
    InvitationCreate,
    Policy,
    PremiumCalculation,
    Product,
    Renewal,
    RenewalCreate,
    RenewalStatus,
    RenewalTransition,
    RenewalUpdate,
    RiskNote,
    RiskNoteCreate,
    RiskNoteStatus,
    TransactionType,
    get_datetime_utc,
)
from app.services.policy import PolicyService

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
        current_user_id: uuid.UUID | None = None,
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
            RenewalService._bind_successor_risk_note_on_completion(
                session=session,
                renewal=renewal,
                current_user_id=current_user_id,
            )

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
    def _bind_successor_risk_note_on_completion(
        *,
        session: Session,
        renewal: Renewal,
        current_user_id: uuid.UUID | None = None,
    ) -> None:
        """Bind a successor RiskNote on Renewal completion for non-Medical policies."""
        policy = session.get(Policy, renewal.policy_id)
        product = session.get(Product, policy.product_id) if policy else None
        if product and product.class_of_insurance.strip().lower() == "medical":
            return

        prior_note = session.exec(
            select(RiskNote)
            .where(RiskNote.policy_id == renewal.policy_id)
            .where(RiskNote.status == RiskNoteStatus.ISSUED)
            .where(col(RiskNote.deleted_at).is_(None))
            .order_by(col(RiskNote.created_at).desc())
        ).first()

        coverage_start = (
            prior_note.coverage_end + timedelta(days=1)
            if prior_note and prior_note.coverage_end
            else date.today()
        )
        try:
            next_year_start = coverage_start.replace(year=coverage_start.year + 1)
        except ValueError:
            next_year_start = date(coverage_start.year + 1, 2, 28)
        coverage_end = next_year_start - timedelta(days=1)

        if prior_note:
            prior_note.status = RiskNoteStatus.REPLACED
            session.add(prior_note)

        calc = (
            session.get(PremiumCalculation, renewal.selected_calculation_id)
            if renewal.selected_calculation_id
            else None
        )
        if calc is not None:
            detail = calc.calculation_detail or {}
            total_amount = calc.total_premium
            net_premium = Decimal(str(detail.get("net_premium", total_amount)))
            commission_amount = Decimal(str(detail.get("commission_amount", "0.00")))
            financial_breakdown = dict(detail)
            cover_snapshot = dict(calc.input_snapshot or {})
        else:
            fallback_total = (
                renewal.agreed_premium
                if renewal.agreed_premium is not None
                else (renewal.proposed_premium or Decimal("0.00"))
            )
            total_amount = fallback_total
            net_premium = fallback_total
            commission_amount = Decimal("0.00")
            financial_breakdown = {"total_amount": float(fallback_total)}
            cover_snapshot = dict(prior_note.cover_snapshot) if prior_note else {}

        risk_note_in = RiskNoteCreate(
            policy_id=renewal.policy_id,
            transaction_type=TransactionType.RENEWAL,
            previous_risk_note_id=prior_note.id if prior_note else None,
            status=RiskNoteStatus.ISSUED,
            effective_date=coverage_start,
            coverage_start=coverage_start,
            coverage_end=coverage_end,
            net_premium=net_premium,
            financial_breakdown=financial_breakdown,
            commission_amount=commission_amount,
            total_amount=total_amount,
            cover_snapshot=cover_snapshot,
            created_by_id=current_user_id,
        )
        PolicyService._add_risk_note(
            session=session,
            risk_note_in=risk_note_in,
            created_by_id=current_user_id,
        )

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
    def _bind_successor_risk_note_on_completion(
        *,
        session: Session,
        renewal: Renewal,
        current_user_id: uuid.UUID | None = None,
    ) -> None:
        """Bind a successor RiskNote on Renewal completion for non-Medical policies."""
        policy = session.get(Policy, renewal.policy_id)
        product = session.get(Product, policy.product_id) if policy else None
        if product and product.class_of_insurance.strip().lower() == "medical":
            return

        prior_note = session.exec(
            select(RiskNote)
            .where(RiskNote.policy_id == renewal.policy_id)
            .where(RiskNote.status == RiskNoteStatus.ISSUED)
            .where(col(RiskNote.deleted_at).is_(None))
            .order_by(col(RiskNote.created_at).desc())
        ).first()

        coverage_start = (
            prior_note.coverage_end + timedelta(days=1)
            if prior_note and prior_note.coverage_end
            else date.today()
        )
        try:
            next_year_start = coverage_start.replace(year=coverage_start.year + 1)
        except ValueError:
            next_year_start = date(coverage_start.year + 1, 2, 28)
        coverage_end = next_year_start - timedelta(days=1)

        if prior_note:
            prior_note.status = RiskNoteStatus.REPLACED
            session.add(prior_note)

        calc = (
            session.get(PremiumCalculation, renewal.selected_calculation_id)
            if renewal.selected_calculation_id
            else None
        )
        if calc is not None:
            detail = calc.calculation_detail or {}
            total_amount = calc.total_premium
            net_premium = Decimal(str(detail.get("net_premium", total_amount)))
            commission_amount = Decimal(str(detail.get("commission_amount", "0.00")))
            financial_breakdown = dict(detail)
            cover_snapshot = dict(calc.input_snapshot or {})
        else:
            fallback_total = (
                renewal.agreed_premium
                if renewal.agreed_premium is not None
                else (renewal.proposed_premium or Decimal("0.00"))
            )
            total_amount = fallback_total
            net_premium = fallback_total
            commission_amount = Decimal("0.00")
            financial_breakdown = {"total_amount": float(fallback_total)}
            cover_snapshot = dict(prior_note.cover_snapshot) if prior_note else {}

        risk_note_in = RiskNoteCreate(
            policy_id=renewal.policy_id,
            transaction_type=TransactionType.RENEWAL,
            previous_risk_note_id=prior_note.id if prior_note else None,
            status=RiskNoteStatus.ISSUED,
            effective_date=coverage_start,
            coverage_start=coverage_start,
            coverage_end=coverage_end,
            net_premium=net_premium,
            financial_breakdown=financial_breakdown,
            commission_amount=commission_amount,
            total_amount=total_amount,
            cover_snapshot=cover_snapshot,
            created_by_id=current_user_id,
        )
        PolicyService._add_risk_note(
            session=session,
            risk_note_in=risk_note_in,
            created_by_id=current_user_id,
        )

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
