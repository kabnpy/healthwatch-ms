from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.services.dashboard import (
    DashboardExpiringPolicyItem,
    DashboardInFlightRenewalItem,
    DashboardSummaryResponse,
    get_dashboard_summary,
)

router = APIRouter()

__all__ = [
    "DashboardExpiringPolicyItem",
    "DashboardInFlightRenewalItem",
    "DashboardSummaryResponse",
    "read_dashboard_summary",
    "router",
]


@router.get("/summary", response_model=DashboardSummaryResponse)
def read_dashboard_summary(
    session: SessionDep,
    current_user: CurrentUser,  # noqa: ARG001
) -> Any:
    """Compute portfolio-wide dashboard triage counts, 30-day expiring policies, and in-flight renewals."""
    return get_dashboard_summary(session)
