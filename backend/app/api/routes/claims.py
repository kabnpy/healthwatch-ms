import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    ClaimCreate,
    ClaimPublic,
    ClaimsPublic,
    ClaimUpdate,
    Message,
)
from app.services.claim import (
    ClaimNotFoundError,
    ClaimService,
    ClaimValidationError,
)

router = APIRouter()


@router.get("/", response_model=ClaimsPublic)
def read_claims(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve claims with optional policy filter."""
    claims, count = ClaimService.list_claims(
        session=session, skip=skip, limit=limit, policy_id=policy_id
    )
    return ClaimsPublic(data=claims, count=count)


@router.get("/policy/{policy_id}/advocacy-summary")
def get_policy_claims_advocacy_summary(
    policy_id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Compute claims advocacy summary and loss ratio for policy renewal negotiations."""
    return ClaimService.calculate_policy_loss_ratio(
        session=session, policy_id=policy_id
    )


@router.get("/{id}", response_model=ClaimPublic)
def read_claim(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single claim by ID."""
    try:
        return ClaimService.get_claim(session=session, claim_id=id)
    except ClaimNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/", response_model=ClaimPublic, status_code=status.HTTP_201_CREATED)
def create_claim(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    claim_in: ClaimCreate,
) -> Any:
    """Create a new insurance claim with initial estimated reserve and details."""
    return ClaimService.create_claim(session=session, claim_in=claim_in)


@router.put("/{id}", response_model=ClaimPublic)
def update_claim(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    claim_in: ClaimUpdate,
) -> Any:
    """Update claim advocacy details and progress lifecycle states."""
    try:
        return ClaimService.update_claim(
            session=session, claim_id=id, claim_in=claim_in
        )
    except ClaimNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ClaimValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{id}", response_model=Message)
def delete_claim(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
) -> Any:
    """Delete a claim."""
    try:
        ClaimService.delete_claim(session=session, claim_id=id)
    except ClaimNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Message(message="Claim deleted successfully")
