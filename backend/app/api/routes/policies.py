import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.api.utils import prepare_policy_public
from app.crud import (
    count_policies,
    get_policies,
    get_policy,
    get_policy_by_policy_number,
)
from app.crud import (
    delete_policy as crud_delete_policy,
)
from app.crud import (
    update_policy as crud_update_policy,
)
from app.models import (
    EndorsementCreate,
    Message,
    PoliciesPublic,
    Policy,
    PolicyCreateExtended,
    PolicyPublic,
    PolicyUpdate,
    Product,
    RiskNotePublic,
    RiskNotesPublic,
)
from app.schemas import BaseFinancialBreakdown, QuoteRequest, QuoteResponse
from app.services.policy import PolicyService, policy_service
from app.services.premium_calculation import RatingValidationError, calculate_premium

router = APIRouter()


@router.get("/", response_model=PoliciesPublic)
def read_policies(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> Any:
    """
    Retrieve policies.
    """
    count = count_policies(session=session, client_id=client_id)
    policies = get_policies(
        session=session, skip=skip, limit=limit, client_id=client_id
    )
    return PoliciesPublic(
        data=[prepare_policy_public(p) for p in policies], count=count
    )


@router.get("/{id}", response_model=PolicyPublic)
def read_policy(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get policy by ID.
    """
    policy = get_policy(session=session, id=id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return prepare_policy_public(policy)


@router.post("/quote", response_model=QuoteResponse)
def get_policy_quote(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    quote_in: QuoteRequest,
) -> Any:
    """
    Get a non-persistent premium quote breakdown.
    """
    product = session.get(Product, quote_in.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        rating_inputs = PolicyService.normalize_rating_inputs(quote_in.risk_details)
        result = calculate_premium(
            inputs=rating_inputs,
            product=product,
            session=session,
            manual_net_premium=rating_inputs.get("manual_net_premium"),
        )
        breakdown = BaseFinancialBreakdown(
            net_premium=result.net_premium,
            taxes={
                "Training Levy": result.training_levy,
                "PHCF": result.phcf,
                "Stamp Duty": result.stamp_duty,
            },
            commission_amount=result.commission_amount or Decimal("0.00"),
            total_amount=result.total_premium,
        )
        return QuoteResponse(breakdown=breakdown)
    except RatingValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=PolicyPublic)
def create_policy(
    *, session: SessionDep, current_user: StaffUser, policy_in: PolicyCreateExtended
) -> Any:
    """
    Create new policy with initial risk note.
    """
    existing_policy = get_policy_by_policy_number(
        session=session, policy_number=policy_in.policy_number
    )
    if existing_policy:
        raise HTTPException(
            status_code=400,
            detail="The policy with this number already exists in the system.",
        )

    policy = policy_service.create_policy(
        session=session,
        policy_in=policy_in,
        cover_snapshot=policy_in.risk_details,
        coverage_start=policy_in.coverage_start,
        coverage_end=policy_in.coverage_end,
        current_user_id=current_user.id,
    )
    session.commit()
    session.refresh(policy)
    return prepare_policy_public(policy)


@router.post("/{id}/endorsements", response_model=RiskNotePublic)
def create_endorsement(
    *,
    session: SessionDep,
    current_user: StaffUser,
    id: uuid.UUID,
    endorsement_in: EndorsementCreate,
) -> Any:
    """
    Create a policy endorsement.
    """
    res = policy_service.create_endorsement(
        session=session,
        policy_id=id,
        updated_cover_snapshot=endorsement_in.updated_risk_details,
        change_description=endorsement_in.change_description,
        effective_date=endorsement_in.effective_date,
        current_user_id=current_user.id,
    )
    session.commit()
    session.refresh(res)
    return res


@router.put("/{id}", response_model=PolicyPublic)
def update_policy(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    policy_in: PolicyUpdate,
) -> Any:
    """
    Update a policy container.
    """
    policy = session.get(Policy, id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    policy = crud_update_policy(session=session, db_policy=policy, policy_in=policy_in)
    return prepare_policy_public(policy)


@router.delete("/{id}", response_model=Message)
def delete_policy(session: SessionDep, _current_user: StaffUser, id: uuid.UUID) -> Any:
    """
    Delete a policy.
    """
    policy = session.get(Policy, id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    crud_delete_policy(session=session, db_policy=policy)
    return Message(message="Policy deleted successfully")


@router.get("/{id}/risk-notes", response_model=RiskNotesPublic)
def read_policy_risk_notes(
    session: SessionDep, _current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Get risk notes for a policy.
    """
    from app.crud import count_risk_notes, get_risk_notes

    count = count_risk_notes(session=session, policy_id=id)
    risk_notes = get_risk_notes(session=session, policy_id=id)
    return RiskNotesPublic(data=risk_notes, count=count)
