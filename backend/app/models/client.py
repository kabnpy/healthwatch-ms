import re
import uuid
from typing import TYPE_CHECKING

from pydantic import EmailStr, field_validator
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .policy import Policy, PolicyPublic


# Shared properties
class ClientBase(SQLModel):
    name: str = Field(max_length=255)
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    postal_address: str | None = Field(
        default=None, max_length=255
    )  # e.g., "P.O. Box 1003"
    postal_code: str | None = Field(default=None, max_length=20)  # e.g., "00560"
    town: str | None = Field(default=None, max_length=100)  # e.g., "Nairobi"
    kra_pin: str | None = Field(default=None, max_length=11)

    @field_validator("kra_pin")
    @classmethod
    def validate_kra_pin(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r"^[A-P][0-9]{9}[A-Z]$", v):
            raise ValueError("Invalid KRA PIN format")
        return v


# Properties to receive via API on creation
class ClientCreate(ClientBase):
    pass


# Properties to receive via API on update, all are optional
class ClientUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    postal_address: str | None = Field(default=None, max_length=255)
    postal_code: str | None = Field(default=None, max_length=20)
    town: str | None = Field(default=None, max_length=100)
    kra_pin: str | None = Field(default=None, max_length=11)

    @field_validator("kra_pin")
    @classmethod
    def validate_kra_pin(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r"^[A-P][0-9]{9}[A-Z]$", v):
            raise ValueError("Invalid KRA PIN format")
        return v


# Database model, database table inferred from class name
class Client(ClientBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    policies: list["Policy"] = Relationship(
        back_populates="client",
        cascade_delete=True,
        sa_relationship_kwargs={"passive_deletes": True},
    )


# Properties to return via API, id is always required
class ClientPublic(ClientBase):
    id: uuid.UUID
    policies: list["PolicyPublic"] = []


class ClientsPublic(SQLModel):


    data: list[ClientPublic]


    count: int
