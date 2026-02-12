import uuid
from typing import Any

from sqlmodel import Session, func, select

from app.models import Client, ClientCreate, ClientUpdate


def create_client(*, session: Session, client_in: ClientCreate) -> Client:
    db_obj = Client.model_validate(client_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_client(*, session: Session, id: uuid.UUID) -> Client | None:
    return session.get(Client, id)


def get_client_by_email(*, session: Session, email: str) -> Client | None:
    statement = select(Client).where(Client.email == email)
    session_client = session.exec(statement).first()
    return session_client


def get_clients(*, session: Session, skip: int = 0, limit: int = 100) -> Any:
    count_statement = select(func.count()).select_from(Client)
    count = session.exec(count_statement).one()

    statement = select(Client).offset(skip).limit(limit)
    clients = session.exec(statement).all()

    return {"data": clients, "count": count}


def update_client(
    *, session: Session, db_client: Client, client_in: ClientUpdate
) -> Any:
    client_data = client_in.model_dump(exclude_unset=True)
    for field, value in client_data.items():
        setattr(db_client, field, value)
    session.add(db_client)
    session.commit()
    session.refresh(db_client)
    return db_client


def delete_client(*, session: Session, id: uuid.UUID) -> Any:
    client = session.get(Client, id)
    if not client:
        return None
    session.delete(client)
    session.commit()
    return client
