import uuid
from typing import Any, NoReturn

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    RenewalCreate,
    RenewalHorizonResponse,
    RenewalPublic,
    RenewalsPublic,
    RenewalStatus,
    RenewalTransition,
    RenewalUpdate,
)
from app.services.renewal import (
    RenewalConflictError,
    RenewalError,
    RenewalNotFoundError,
    RenewalService,
    RenewalValidationError,
)

router = APIRouter()


def _raise_http_for_renewal_error(exc: RenewalError) -> NoReturn:
    if isinstance(exc, RenewalNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, RenewalConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "renewal_modified_concurrently",
                "message": str(exc),
                "current_version": exc.current_version,
                "provided_version": exc.provided_version,
            },
        )
    if isinstance(exc, RenewalValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
    )


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
    renewals = RenewalService.get_renewals(
        session=session, skip=skip, limit=limit, policy_id=policy_id, status=status
    )
    count = RenewalService.count_renewals(
        session=session, policy_id=policy_id, status=status
    )
    return RenewalsPublic(data=renewals, count=count)


@router.get("/horizon", response_model=RenewalHorizonResponse)
def read_renewals_horizon(
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Retrieve renewal expiration horizon buckets across all active policies."""
    return RenewalService.get_horizon(session=session)


@router.get("/{id}", response_model=RenewalPublic)
def read_renewal(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single renewal details by ID."""
    try:
        return RenewalService.get_renewal(session=session, renewal_id=id)
    except RenewalError as exc:
        _raise_http_for_renewal_error(exc)


@router.post("/", response_model=RenewalPublic, status_code=status.HTTP_201_CREATED)
def create_renewal(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    renewal_in: RenewalCreate,
) -> Any:
    """Initiate an annual renewal for a policy (enforces single active renewal invariant)."""
    try:
        return RenewalService.create_renewal(session=session, renewal_in=renewal_in)
    except RenewalError as exc:
        _raise_http_for_renewal_error(exc)


@router.patch("/{id}/transition", response_model=RenewalPublic)
def transition_renewal(
    *,
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    transition_in: RenewalTransition,
) -> Any:
    """
    Execute a workflow state transition under Optimistic Concurrency Control (OCC).
    Returns 409 Conflict if renewal version differs from expected version.
    """
    try:
        return RenewalService.transition_renewal(
            session=session,
            renewal_id=id,
            transition_in=transition_in,
            current_user_id=current_user.id,
        )
    except RenewalError as exc:
        _raise_http_for_renewal_error(exc)


@router.patch("/{id}", response_model=RenewalPublic)
def update_renewal(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
    renewal_in: RenewalUpdate,
) -> Any:
    """Update renewal metadata with OCC verification."""
    try:
        return RenewalService.update_renewal(
            session=session, renewal_id=id, renewal_in=renewal_in
        )
    except RenewalError as exc:
        _raise_http_for_renewal_error(exc)
