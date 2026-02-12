import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import Client, ClientCreate, ClientPublic, ClientsPublic, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/", response_model=ClientsPublic)
def read_clients(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve clients.
    """
    statement = select(func.count()).select_from(Client)
    count = session.exec(statement).one()
    statement = select(Client).order_by(col(Client.name), col(Client.id)).offset(skip).limit(limit)
    clients = session.exec(statement).all()

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
    *, session: SessionDep, _current_user: CurrentUser, client_in: ClientCreate
) -> Any:
    """
    Create new client.
    """
    client = crud.client.get_client_by_email(session=session, email=client_in.email)
    if client:
        raise HTTPException(
            status_code=400,
            detail="The client with this email already exists in the system",
        )
    client = crud.client.create_client(session=session, client_in=client_in)
    return client


@router.patch("/{id}", response_model=ClientPublic)
def update_client(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    id: uuid.UUID,
    client_in: ClientUpdate,
) -> Any:
    """
    Update a client.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client_in.email and client_in.email != client.email:
        existing_client = crud.client.get_client_by_email(
            session=session, email=client_in.email
        )
        if existing_client and existing_client.id != id:
            raise HTTPException(
                status_code=400,
                detail="Client with this email already exists",
            )
    client = crud.client.update_client(
        session=session, db_client=client, client_in=client_in
    )
    return client


@router.delete("/{id}", status_code=204)
def delete_client(
    session: SessionDep, _current_user: CurrentUser, id: uuid.UUID
) -> None:
    """
    Delete a client.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session.delete(client)
    session.commit()
