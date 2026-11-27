from datetime import date

from sqlmodel import Session, SQLModel, func, select

from app.models import (
    Policy,
    PolicyPublic,
    PolicyStatus,
    RenewalPublic,
)
from app.services.policy import policy_service
from app.services.renewal import RenewalService

LAPSED_STATUSES = (
    PolicyStatus.EXPIRED,
    PolicyStatus.LAPSED,
    PolicyStatus.CANCELLED,
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


def get_dashboard_summary(
    session: Session, *, as_of: date | None = None
) -> DashboardSummaryResponse:
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

    expiring_30 = [
        DashboardExpiringPolicyItem(
            policy=PolicyPublic.model_validate(proj.policy),
            days_left=proj.days_left,
            client_name=proj.client_name,
        )
        for proj in policy_service.get_active_policy_expirations(
            session=session, as_of=as_of
        )
        if 0 <= proj.days_left <= 30
    ]
    expiring_30.sort(key=lambda item: item.days_left)

    in_flight_rows = RenewalService.get_in_flight_renewals(session=session)

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
