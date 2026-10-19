import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    RenewalCreate,
    RenewalPublic,
    RenewalsPublic,
    RenewalStatus,
    RenewalTransition,
    RenewalUpdate,
)
from app.services.renewal import RenewalService

router = APIRouter()


@router.get("/", response_model=RenewalsPublic)
def read_renewals(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
    status: RenewalStatus | None = None,
) -> Any:
    """Retrieve renewals portfolio with status and policy filtering."""
    renewals = crud.get_renewals(
        session=session, skip=skip, limit=limit, policy_id=policy_id, status=status
    )
    count = crud.count_renewals(session=session, policy_id=policy_id, status=status)
    return RenewalsPublic(data=renewals, count=count)


@router.get("/{id}", response_model=RenewalPublic)
def read_renewal(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single renewal details by ID."""
    renewal = crud.get_renewal(session=session, renewal_id=id)
    if not renewal:
        raise HTTPException(status_code=404, detail="Renewal not found")
    return renewal


@router.post("/", response_model=RenewalPublic, status_code=status.HTTP_201_CREATED)
def create_renewal(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    renewal_in: RenewalCreate,
) -> Any:
    """Initiate an annual renewal for a policy (enforces single active renewal invariant)."""
    return RenewalService.create_renewal(session=session, renewal_in=renewal_in)


@router.patch("/{id}/transition", response_model=RenewalPublic)
def transition_renewal(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
    transition_in: RenewalTransition,
) -> Any:
    """
    Execute a workflow state transition under Optimistic Concurrency Control (OCC).
    Returns 409 Conflict if renewal version differs from expected version.
    """
    return RenewalService.transition_renewal(
        session=session, renewal_id=id, transition_in=transition_in
    )


@router.patch("/{id}", response_model=RenewalPublic)
def update_renewal(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
    renewal_in: RenewalUpdate,
) -> Any:
    """Update renewal metadata with OCC verification."""
    return RenewalService.update_renewal(
        session=session, renewal_id=id, renewal_in=renewal_in
    )
