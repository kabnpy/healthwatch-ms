import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    BusinessEvent,
    PremiumCalculationCreate,
    PremiumCalculationPublic,
    PremiumCalculationsPublic,
)
from app.services.advisory_rating import AdvisoryRatingService

router = APIRouter()


class AdvisoryQuoteRequest(BaseModel):
    rate_table_id: uuid.UUID
    inputs: dict[str, Any]
    business_event: BusinessEvent = BusinessEvent.NEW_BUSINESS
    policy_id: uuid.UUID | None = None
    renewal_id: uuid.UUID | None = None


class PersistQuoteRequest(BaseModel):
    rate_table_id: uuid.UUID
    inputs: dict[str, Any]
    business_event: BusinessEvent = BusinessEvent.NEW_BUSINESS
    policy_id: uuid.UUID
    renewal_id: uuid.UUID | None = None
    is_selected: bool = False


@router.post("/quote")
def quote_preview(
    session: SessionDep,
    _current_user: CurrentUser,
    request: AdvisoryQuoteRequest,
) -> Any:
    """Calculate an advisory quote preview with full breakdown and taxes without persisting."""
    rate_table = crud.get_rate_table_version(
        session=session, rate_table_id=request.rate_table_id
    )
    if not rate_table:
        raise HTTPException(status_code=404, detail="Rate table version not found")

    try:
        quote = AdvisoryRatingService.calculate_quote(
            rate_table=rate_table,
            inputs=request.inputs,
            business_event=request.business_event,
            policy_id=request.policy_id,
            renewal_id=request.renewal_id,
            user_id=_current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return quote


@router.post(
    "/", response_model=PremiumCalculationPublic, status_code=status.HTTP_201_CREATED
)
def create_calculation(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    request: PersistQuoteRequest,
) -> Any:
    """Calculate and persist an immutable advisory PremiumCalculation snapshot."""
    rate_table = crud.get_rate_table_version(
        session=session, rate_table_id=request.rate_table_id
    )
    if not rate_table:
        raise HTTPException(status_code=404, detail="Rate table version not found")

    try:
        quote = AdvisoryRatingService.calculate_quote(
            rate_table=rate_table,
            inputs=request.inputs,
            business_event=request.business_event,
            policy_id=request.policy_id,
            renewal_id=request.renewal_id,
            user_id=_current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    calc_in = PremiumCalculationCreate(
        policy_id=request.policy_id,
        renewal_id=request.renewal_id,
        business_event=request.business_event,
        rate_table_version_id=request.rate_table_id,
        input_snapshot=quote["input_snapshot"],
        rule_provenance=quote["rule_provenance"],
        calculation_detail=quote["calculation_detail"],
        total_premium=quote["total_premium"],
        is_selected=request.is_selected,
    )
    db_calc = crud.create_premium_calculation(
        session=session, calc_in=calc_in, user_id=_current_user.id
    )
    if request.is_selected:
        crud.select_premium_calculation(session=session, calc_id=db_calc.id)
    return db_calc


@router.get("/", response_model=PremiumCalculationsPublic)
def read_calculations(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
    renewal_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve advisory premium calculations with policy or renewal filter."""
    calcs = crud.get_premium_calculations(
        session=session,
        skip=skip,
        limit=limit,
        policy_id=policy_id,
        renewal_id=renewal_id,
    )
    count = crud.count_premium_calculations(
        session=session, policy_id=policy_id, renewal_id=renewal_id
    )
    return PremiumCalculationsPublic(data=calcs, count=count)


@router.get("/{id}", response_model=PremiumCalculationPublic)
def read_calculation(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single calculation by ID."""
    calc = crud.get_premium_calculation(session=session, calc_id=id)
    if not calc:
        raise HTTPException(status_code=404, detail="Premium calculation not found")
    return calc


@router.post("/{id}/select", response_model=PremiumCalculationPublic)
def select_calculation(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
) -> Any:
    """Select this calculation as agreed calculation for policy / renewal."""
    calc = crud.get_premium_calculation(session=session, calc_id=id)
    if not calc:
        raise HTTPException(status_code=404, detail="Premium calculation not found")
    return crud.select_premium_calculation(session=session, calc_id=id)
