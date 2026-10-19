import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    Message,
    VehicleCreate,
    VehiclePublic,
    VehiclesPublic,
    VehicleUpdate,
)

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
    vehicles = crud.get_vehicles(
        session=session, skip=skip, limit=limit, policy_id=policy_id
    )
    count = crud.count_vehicles(session=session, policy_id=policy_id)
    return VehiclesPublic(data=vehicles, count=count)


@router.get("/{id}", response_model=VehiclePublic)
def read_vehicle(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single vehicle details."""
    vehicle = crud.get_vehicle(session=session, vehicle_id=id)
    if not vehicle or vehicle.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("/", response_model=VehiclePublic, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    vehicle_in: VehicleCreate,
) -> Any:
    """Register a motor vehicle asset against a policy."""
    return crud.create_vehicle(session=session, vehicle_in=vehicle_in)


@router.patch("/{id}", response_model=VehiclePublic)
def update_vehicle(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
    vehicle_in: VehicleUpdate,
) -> Any:
    """Update vehicle registration or asset parameters."""
    vehicle = crud.get_vehicle(session=session, vehicle_id=id)
    if not vehicle or vehicle.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return crud.update_vehicle(
        session=session, db_vehicle=vehicle, vehicle_in=vehicle_in
    )


@router.delete("/{id}", response_model=Message)
def delete_vehicle(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
) -> Any:
    """Soft delete a vehicle record."""
    vehicle = crud.get_vehicle(session=session, vehicle_id=id)
    if not vehicle or vehicle.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    crud.delete_vehicle(session=session, db_vehicle=vehicle)
    return Message(message="Vehicle deleted successfully")
