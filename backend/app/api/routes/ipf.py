import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    IPFAgreementCreate,
    IPFAgreementPublic,
    IPFAgreementsPublic,
    IPFAgreementUpdate,
)
from app.services.ipf import IPFNotFoundError, IPFService, IPFValidationError

router = APIRouter()


@router.get("/", response_model=IPFAgreementsPublic)
def read_ipf_agreements(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
    policy_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve IPF agreements with optional client or policy filters."""
    agreements, count = IPFService.list_ipf_agreements(
        session=session,
        skip=skip,
        limit=limit,
        client_id=client_id,
        policy_id=policy_id,
    )
    return IPFAgreementsPublic(data=agreements, count=count)


@router.get("/{id}", response_model=IPFAgreementPublic)
def read_ipf_agreement(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single IPF agreement by ID."""
    try:
        return IPFService.get_ipf_agreement(session=session, ipf_id=id)
    except IPFNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/", response_model=IPFAgreementPublic, status_code=status.HTTP_201_CREATED
)
def create_ipf_agreement(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    ipf_in: IPFAgreementCreate,
) -> Any:
    """Create a new tripartite Insurance Premium Financing facility."""
    try:
        return IPFService.create_ipf_agreement(session=session, ipf_in=ipf_in)
    except IPFValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{id}", response_model=IPFAgreementPublic)
def update_ipf_agreement(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    ipf_in: IPFAgreementUpdate,
) -> Any:
    """Update IPF status or attach commitment letter document."""
    try:
        return IPFService.update_ipf_agreement(
            session=session, ipf_id=id, ipf_in=ipf_in
        )
    except IPFNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IPFValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
