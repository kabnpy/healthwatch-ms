import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    InsurerCreate,
    InsurerPublic,
    InsurersPublic,
    InsurerUpdate,
    Message,
)
from app.services.catalog import (
    CatalogConflictError,
    CatalogNotFoundError,
    catalog_service,
)

router = APIRouter()


@router.get("/", response_model=InsurersPublic)
def read_insurers(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve insurers.
    """
    insurers, count = catalog_service.list_insurers(
        session=session, skip=skip, limit=limit
    )
    return InsurersPublic(data=insurers, count=count)


@router.get("/{id}", response_model=InsurerPublic)
def read_insurer(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get insurer by ID.
    """
    try:
        return catalog_service.get_insurer_or_raise(session=session, insurer_id=id)
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", response_model=InsurerPublic)
def create_insurer(
    *, session: SessionDep, _current_user: StaffUser, insurer_in: InsurerCreate
) -> Any:
    """
    Create new insurer.
    """
    try:
        return catalog_service.create_insurer(session=session, insurer_in=insurer_in)
    except CatalogConflictError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{id}", response_model=InsurerPublic)
def update_insurer(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    insurer_in: InsurerUpdate,
) -> Any:
    """
    Update an insurer.
    """
    try:
        return catalog_service.update_insurer(
            session=session, insurer_id=id, insurer_in=insurer_in
        )
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{id}", response_model=Message)
def delete_insurer(session: SessionDep, _current_user: StaffUser, id: uuid.UUID) -> Any:
    """
    Delete an insurer.
    """
    try:
        catalog_service.delete_insurer(session=session, insurer_id=id)
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Message(message="Insurer deleted successfully")
