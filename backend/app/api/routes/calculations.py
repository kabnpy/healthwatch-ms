import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    BusinessEvent,
    PremiumCalculationCreate,
    PremiumCalculationPublic,
    PremiumCalculationsPublic,
)
from app.services.premium_calculation import (
    PremiumCalculationService,
    RatingValidationError,
    calculate_premium,
    count_premium_calculations,
    create_premium_calculation,
    get_premium_calculation,
    get_premium_calculations,
    select_premium_calculation,
)
from app.services.rate_table import RateTableNotFoundError, RateTableService

router = APIRouter()


class AdvisoryQuoteRequest(BaseModel):
    rate_table_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    inputs: dict[str, Any] = Field(default_factory=dict)
    business_event: BusinessEvent = BusinessEvent.NEW_BUSINESS
    policy_id: uuid.UUID | None = None
    renewal_id: uuid.UUID | None = None


class CalculationQuoteResponse(BaseModel):
    basic_premium: Decimal
    training_levy: Decimal
    phcf: Decimal
    stamp_duty: Decimal
    net_premium: Decimal
    total_taxes: Decimal
    total_premium: Decimal
    total_amount: Decimal
    commission_amount: Decimal | None = None
    taxes: dict[str, Any] = Field(default_factory=dict)
    calculation_detail: dict[str, Any] = Field(default_factory=dict)
    rule_provenance: dict[str, Any] = Field(default_factory=dict)
    input_snapshot: dict[str, Any] = Field(default_factory=dict)


class PersistQuoteRequest(BaseModel):
    rate_table_id: uuid.UUID
    inputs: dict[str, Any]
    business_event: BusinessEvent = BusinessEvent.NEW_BUSINESS
    policy_id: uuid.UUID
    renewal_id: uuid.UUID | None = None
    is_selected: bool = False


@router.post("/quote", response_model=CalculationQuoteResponse)
def quote_preview(
    session: SessionDep,
    _current_user: CurrentUser,
    request: AdvisoryQuoteRequest,
) -> CalculationQuoteResponse:
    """Calculate an advisory quote preview with full breakdown and taxes without persisting."""
    try:
        result = PremiumCalculationService.evaluate_quote(
            session,
            inputs=request.inputs,
            rate_table_id=request.rate_table_id,
            product_id=request.product_id,
        )
    except RatingValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return CalculationQuoteResponse(
        basic_premium=result.basic_premium,
        training_levy=result.training_levy,
        phcf=result.phcf,
        stamp_duty=result.stamp_duty,
        net_premium=result.net_premium,
        total_taxes=result.total_taxes,
        total_premium=result.total_premium,
        total_amount=result.total_premium,
        commission_amount=result.commission_amount,
        taxes=result.calculation_detail.get("taxes", {}),
        calculation_detail=result.calculation_detail,
        rule_provenance=result.rule_provenance,
        input_snapshot=result.input_snapshot,
    )


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
    try:
        rate_table = RateTableService(session).get_version(request.rate_table_id)
    except RateTableNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        result = calculate_premium(
            rate_table=rate_table,
            inputs=request.inputs,
        )
    except RatingValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    calc_in = PremiumCalculationCreate(
        policy_id=request.policy_id,
        renewal_id=request.renewal_id,
        business_event=request.business_event,
        rate_table_version_id=request.rate_table_id,
        input_snapshot=result.input_snapshot,
        rule_provenance=result.rule_provenance,
        calculation_detail=result.calculation_detail,
        total_premium=result.total_premium,
        is_selected=request.is_selected,
    )
    return create_premium_calculation(
        session=session, calc_in=calc_in, user_id=_current_user.id
    )


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
    calcs = get_premium_calculations(
        session=session,
        skip=skip,
        limit=limit,
        policy_id=policy_id,
        renewal_id=renewal_id,
    )
    count = count_premium_calculations(
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
    calc = get_premium_calculation(session=session, calc_id=id)
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
    calc = get_premium_calculation(session=session, calc_id=id)
    if not calc:
        raise HTTPException(status_code=404, detail="Premium calculation not found")
    return select_premium_calculation(session=session, calc_id=id)
