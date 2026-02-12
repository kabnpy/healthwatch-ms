from typing import TYPE_CHECKING
import uuid
from datetime import date
from pydantic import EmailStr
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .policy import Policy

# Shared properties
class ClientBase(SQLModel):
    name: str = Field(max_length=255)
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    date_of_birth: date | None = Field(default=None)

# Properties to receive via API on creation
class ClientCreate(ClientBase):
    pass

# Properties to receive via API on update, all are optional
class ClientUpdate(ClientBase):
    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)

# Database model, database table inferred from class name
class Client(ClientBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policies: list["Policy"] = Relationship(back_populates="client", cascade_delete=True)

# Properties to return via API, id is always required
class ClientPublic(ClientBase):
    id: uuid.UUID

class ClientsPublic(SQLModel):
    data: list[ClientPublic]
    count: int
