import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    Message,
    VehicleCreate,
    VehiclePublic,
    VehiclesPublic,
    VehicleUpdate,
)
from app.services.portfolio import PortfolioNotFoundError, portfolio_service

router = APIRouter()


@router.get("/", response_model=VehiclesPublic)
def read_vehicles(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve motor vehicles with optional policy filter."""
    vehicles, count = portfolio_service.list_vehicles(
        session=session, skip=skip, limit=limit, policy_id=policy_id
    )
    return VehiclesPublic(data=vehicles, count=count)


@router.get("/{id}", response_model=VehiclePublic)
def read_vehicle(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single vehicle details."""
    try:
        return portfolio_service.get_vehicle_or_raise(session=session, vehicle_id=id)
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", response_model=VehiclePublic, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    vehicle_in: VehicleCreate,
) -> Any:
    """Register a motor vehicle asset against a policy."""
    return portfolio_service.create_vehicle(session=session, vehicle_in=vehicle_in)


@router.patch("/{id}", response_model=VehiclePublic)
def update_vehicle(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
    vehicle_in: VehicleUpdate,
) -> Any:
    """Update vehicle registration or asset parameters."""
    try:
        return portfolio_service.update_vehicle(
            session=session, vehicle_id=id, vehicle_in=vehicle_in
        )
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{id}", response_model=Message)
def delete_vehicle(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
) -> Any:
    """Soft delete a vehicle record."""
    try:
        portfolio_service.delete_vehicle(session=session, vehicle_id=id)
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Message(message="Vehicle deleted successfully")
