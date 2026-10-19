import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    Claim,
    ClaimCreate,
    ClaimPublic,
    ClaimsPublic,
    ClaimUpdate,
    Message,
)
from app.services.claim import ClaimAdvocacyService

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
    count = crud.count_claims(session=session, policy_id=policy_id)
    claims = crud.get_claims(
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
    return ClaimAdvocacyService.calculate_policy_loss_ratio(
        session=session, policy_id=policy_id
    )


@router.get("/{id}", response_model=ClaimPublic)
def read_claim(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single claim by ID."""
    claim = session.get(Claim, id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.post("/", response_model=ClaimPublic, status_code=status.HTTP_201_CREATED)
def create_claim(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    claim_in: ClaimCreate,
) -> Any:
    """Create a new insurance claim with initial estimated reserve and details."""
    return crud.create_claim(session=session, claim_in=claim_in)


@router.put("/{id}", response_model=ClaimPublic)
def update_claim(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    claim_in: ClaimUpdate,
) -> Any:
    """Update claim advocacy details and progress lifecycle states."""
    claim = session.get(Claim, id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim_in.status is not None and claim_in.status != claim.status:
        if not ClaimAdvocacyService.validate_transition(claim.status, claim_in.status):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid claim status transition from {claim.status.value} to {claim_in.status.value}",
            )

    return crud.update_claim(session=session, db_claim=claim, claim_in=claim_in)


@router.delete("/{id}", response_model=Message)
def delete_claim(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
) -> Any:
    """Delete a claim."""
    claim = session.get(Claim, id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    crud.delete_claim(session=session, db_claim=claim)
    return Message(message="Claim deleted successfully")
