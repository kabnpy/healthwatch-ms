from datetime import date
import uuid

from sqlmodel import Session, SQLModel, func, select

from app.models import (
    Client,
    Policy,
    PolicyPublic,
    PolicyStatus,
    Renewal,
    RenewalPublic,
    RenewalStatus,
    RiskNote,
    get_datetime_utc,
)

LAPSED_STATUSES = (
    PolicyStatus.EXPIRED,
    PolicyStatus.LAPSED,
    PolicyStatus.CANCELLED,
)
TERMINAL_RENEWAL_STATUSES = (
    RenewalStatus.COMPLETED,
    RenewalStatus.CANCELLED,
)


class DashboardExpiringPolicyItem(SQLModel):
    policy: PolicyPublic
    days_left: int
    client_name: str


class DashboardInFlightRenewalItem(SQLModel):
    renewal: RenewalPublic
    policy: PolicyPublic | None
    client_name: str


class DashboardSummaryResponse(SQLModel):
    active_count: int
    lapsed_count: int
    expiring_30: list[DashboardExpiringPolicyItem]
    in_flight_renewals_count: int
    in_flight_renewals: list[DashboardInFlightRenewalItem]


def get_dashboard_summary(session: Session) -> DashboardSummaryResponse:
    """Compute portfolio-wide dashboard triage counts, 30-day expiring policies, and in-flight renewals."""
    active_count = session.exec(
        select(func.count(Policy.id))
        .where(Policy.deleted_at.is_(None))
        .where(Policy.status == PolicyStatus.ACTIVE)
    ).one()

    lapsed_count = session.exec(
        select(func.count(Policy.id))
        .where(Policy.deleted_at.is_(None))
        .where(Policy.status.in_(LAPSED_STATUSES))
    ).one()

    today = get_datetime_utc().date()
    active_rows = session.exec(
        select(Policy, Client.name)
        .join(Client, Policy.client_id == Client.id)
        .where(Policy.deleted_at.is_(None))
        .where(Policy.status == PolicyStatus.ACTIVE)
    ).all()

    active_policy_ids = [policy.id for policy, _ in active_rows]
    latest_coverage_end_by_policy: dict[uuid.UUID, date] = {}
    if active_policy_ids:
        notes = session.exec(
            select(RiskNote.policy_id, RiskNote.coverage_end)
            .where(RiskNote.policy_id.in_(active_policy_ids))
            .where(RiskNote.deleted_at.is_(None))
            .where(RiskNote.coverage_end.is_not(None))
            .order_by(RiskNote.created_at.desc())
        ).all()
        for policy_id, coverage_end in notes:
            if policy_id not in latest_coverage_end_by_policy and coverage_end is not None:
                latest_coverage_end_by_policy[policy_id] = coverage_end

    expiring_30: list[DashboardExpiringPolicyItem] = []
    for policy, client_name in active_rows:
        coverage_end = latest_coverage_end_by_policy.get(policy.id)
        if coverage_end is None:
            continue
        days_left = (coverage_end - today).days
        if 0 <= days_left <= 30:
            expiring_30.append(
                DashboardExpiringPolicyItem(
                    policy=PolicyPublic.model_validate(policy),
                    days_left=days_left,
                    client_name=client_name,
                )
            )
    expiring_30.sort(key=lambda item: item.days_left)

    in_flight_rows = session.exec(
        select(Renewal, Policy, Client.name)
        .join(Policy, Renewal.policy_id == Policy.id, isouter=True)
        .join(Client, Policy.client_id == Client.id, isouter=True)
        .where(Renewal.deleted_at.is_(None))
        .where(Renewal.status.not_in(TERMINAL_RENEWAL_STATUSES))
        .order_by(Renewal.renewal_period_start.asc())
    ).all()

    in_flight_renewals = [
        DashboardInFlightRenewalItem(
            renewal=RenewalPublic.model_validate(renewal),
            policy=PolicyPublic.model_validate(policy) if policy else None,
            client_name=client_name or "Client",
        )
        for renewal, policy, client_name in in_flight_rows
    ]

    return DashboardSummaryResponse(
        active_count=active_count,
        lapsed_count=lapsed_count,
        expiring_30=expiring_30,
        in_flight_renewals_count=len(in_flight_renewals),
        in_flight_renewals=in_flight_renewals,
    )
