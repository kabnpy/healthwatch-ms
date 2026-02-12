import uuid
from datetime import date
from enum import Enum
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .client import Client


class PolicyType(str, Enum):
    HEALTH = "HEALTH"
    LIFE = "LIFE"
    AUTO = "AUTO"
    HOME = "HOME"


class PolicyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


# Shared properties
class PolicyBase(SQLModel):
    policy_number: str = Field(max_length=100, index=True)
    type: PolicyType
    provider: str = Field(max_length=255)
    start_date: date
    end_date: date | None = Field(default=None)
    status: PolicyStatus = Field(default=PolicyStatus.ACTIVE)
    client_id: uuid.UUID = Field(foreign_key="client.id", ondelete="CASCADE")


# Properties to receive via API on creation
class PolicyCreate(PolicyBase):
    pass


# Properties to receive via API on update, all are optional
class PolicyUpdate(SQLModel):
    policy_number: str | None = Field(default=None, max_length=100)
    type: PolicyType | None = None
    provider: str | None = Field(default=None, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: PolicyStatus | None = None
    client_id: uuid.UUID | None = None


# Database model, database table inferred from class name
class Policy(PolicyBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client: "Client" = Relationship(back_populates="policies")


# Properties to return via API, id is always required
class PolicyPublic(PolicyBase):
    id: uuid.UUID


class PoliciesPublic(SQLModel):
    data: list[PolicyPublic]
    count: int
