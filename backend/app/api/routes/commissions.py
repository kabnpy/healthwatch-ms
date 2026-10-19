import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    CommissionScheduleCreate,
    CommissionSchedulePublic,
    CommissionSchedulesPublic,
    ProductLine,
)
from app.services.commission import CommissionService

router = APIRouter()


class CommissionCalculationRequest(BaseModel):
    net_base_premium: Decimal
    gross_invoice_total: Decimal
    commission_rate: Decimal | None = None
    product_line: ProductLine | None = None


@router.get("/", response_model=CommissionSchedulesPublic)
def read_commission_schedules(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    insurer_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve insurer commission schedules."""
    schedules = crud.get_commission_schedules(
        session=session, skip=skip, limit=limit, insurer_id=insurer_id
    )
    count = crud.count_commission_schedules(session=session, insurer_id=insurer_id)
    return CommissionSchedulesPublic(data=schedules, count=count)


@router.post(
    "/", response_model=CommissionSchedulePublic, status_code=status.HTTP_201_CREATED
)
def create_commission_schedule(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    schedule_in: CommissionScheduleCreate,
) -> Any:
    """Create a new commission schedule for an insurer and product line."""
    return crud.create_commission_schedule(session=session, schedule_in=schedule_in)


@router.post("/calculate")
def calculate_remittance(
    _current_user: CurrentUser,
    request: CommissionCalculationRequest,
) -> Any:
    """Calculate gross commission, 5% WHT deduction, net commission, and net carrier remittance."""
    try:
        return CommissionService.calculate_commission(
            net_base_premium=request.net_base_premium,
            gross_invoice_total=request.gross_invoice_total,
            commission_rate=request.commission_rate,
            product_line=request.product_line,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
