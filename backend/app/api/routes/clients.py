import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.crud import (
    count_clients,
    get_client_by_kra_pin,
    get_clients,
)
from app.crud import (
    create_client as crud_create_client,
)
from app.crud import (
    delete_client as crud_delete_client,
)
from app.crud import (
    update_client as crud_update_client,
)
from app.models import (
    Client,
    ClientCreate,
    ClientPublic,
    ClientsPublic,
    ClientUpdate,
    Message,
)

router = APIRouter()


@router.get("/", response_model=ClientsPublic)
def read_clients(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve clients.
    """
    count = count_clients(session=session)
    clients = get_clients(session=session, skip=skip, limit=limit)
    return ClientsPublic(data=clients, count=count)


@router.get("/{id}", response_model=ClientPublic)
def read_client(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get client by ID.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.post("/", response_model=ClientPublic)
def create_client(
    *, session: SessionDep, _current_user: StaffUser, client_in: ClientCreate
) -> Any:
    """
    Create new client.
    """
    existing_client = get_client_by_kra_pin(session=session, kra_pin=client_in.kra_pin)
    if existing_client:
        raise HTTPException(
            status_code=400,
            detail="The client with this KRA PIN already exists in the system.",
        )

    client = crud_create_client(session=session, client_in=client_in)
    return client


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
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client = crud_update_client(session=session, db_client=client, client_in=client_in)
    return client


@router.delete("/{id}", response_model=Message)
def delete_client(session: SessionDep, _current_user: StaffUser, id: uuid.UUID) -> Any:
    """
    Delete a client.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    crud_delete_client(session=session, db_client=client)
    return Message(message="Client deleted successfully")
