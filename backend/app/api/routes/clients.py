import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    ClientCreate,
    ClientPublic,
    ClientsPublic,
    ClientUpdate,
    Message,
)
from app.services.portfolio import (
    PortfolioConflictError,
    PortfolioNotFoundError,
    portfolio_service,
)

router = APIRouter()


@router.get("/", response_model=ClientsPublic)
def read_clients(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve clients.
    """
    clients, count = portfolio_service.list_clients(
        session=session, skip=skip, limit=limit
    )
    return ClientsPublic(data=clients, count=count)


@router.get("/{id}", response_model=ClientPublic)
def read_client(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get client by ID.
    """
    try:
        return portfolio_service.get_client_or_raise(session=session, client_id=id)
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", response_model=ClientPublic)
def create_client(
    *, session: SessionDep, _current_user: StaffUser, client_in: ClientCreate
) -> Any:
    """
    Create new client.
    """
    try:
        return portfolio_service.create_client(session=session, client_in=client_in)
    except PortfolioConflictError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{id}", response_model=ClientPublic)
def update_client(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    client_in: ClientUpdate,
) -> Any:
    """
    Update a client.
    """
    try:
        return portfolio_service.update_client(
            session=session, client_id=id, client_in=client_in
        )
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{id}", response_model=Message)
def delete_client(session: SessionDep, _current_user: StaffUser, id: uuid.UUID) -> Any:
    """
    Delete a client.
    """
    try:
        portfolio_service.delete_client(session=session, client_id=id)
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Message(message="Client deleted successfully")
