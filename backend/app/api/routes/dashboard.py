from datetime import date
from typing import Any

from fastapi import APIRouter
from sqlmodel import SQLModel, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Client,
    Policy,
    PolicyPublic,
    PolicyStatus,
    Renewal,
    RenewalPublic,
    RenewalStatus,
    RiskNote,
)

router = APIRouter()

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


@router.get("/summary", response_model=DashboardSummaryResponse)
def read_dashboard_summary(
    session: SessionDep,
    current_user: CurrentUser,  # noqa: ARG001
) -> Any:
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

    today = date.today()
    active_rows = session.exec(
        select(Policy, Client.name)
        .join(Client, Policy.client_id == Client.id)
        .where(Policy.deleted_at.is_(None))
        .where(Policy.status == PolicyStatus.ACTIVE)
    ).all()

    expiring_30: list[DashboardExpiringPolicyItem] = []
    for policy, client_name in active_rows:
        notes = session.exec(
            select(RiskNote)
            .where(RiskNote.policy_id == policy.id)
            .where(RiskNote.deleted_at.is_(None))
            .where(RiskNote.coverage_end.is_not(None))
            .order_by(RiskNote.created_at.desc())
        ).all()
        if not notes or notes[0].coverage_end is None:
            continue
        days_left = (notes[0].coverage_end - today).days
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
