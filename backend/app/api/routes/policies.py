import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Client,
    PoliciesPublic,
    Policy,
    PolicyCreate,
    PolicyPublic,
    PolicyUpdate,
)

router = APIRouter()


@router.get("/", response_model=PoliciesPublic)
def read_policies(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """


    Retrieve policies.


    """

    statement = select(func.count()).select_from(Policy)

    count = session.exec(statement).one()

    statement = select(Policy).offset(skip).limit(limit)

    policies = session.exec(statement).all()

    return PoliciesPublic(data=policies, count=count)


@router.get("/{id}", response_model=PolicyPublic)
def read_policy(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """


    Get policy by ID.


    """

    policy = session.get(Policy, id)

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    return policy


@router.post("/", response_model=PolicyPublic)
def create_policy(
    *, session: SessionDep, _current_user: CurrentUser, policy_in: PolicyCreate
) -> Any:
    """


    Create new policy.


    """

    client = session.get(Client, policy_in.client_id)

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    policy = crud.policy.create_policy(session=session, policy_in=policy_in)

    return policy


@router.patch("/{id}", response_model=PolicyPublic)
def update_policy(
    *,
    session: SessionDep,
    _current_user: CurrentUser,
    id: uuid.UUID,
    policy_in: PolicyUpdate,
) -> Any:
    """


    Update a policy.


    """

    policy = session.get(Policy, id)

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    if policy_in.client_id:
        client = session.get(Client, policy_in.client_id)

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

    policy = crud.policy.update_policy(
        session=session, db_policy=policy, policy_in=policy_in
    )

    return policy


@router.delete("/{id}")
def delete_policy(
    session: SessionDep, _current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Delete a policy.
    """
    policy = session.get(Policy, id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    session.delete(policy)
    session.commit()
    return {"message": "Policy deleted successfully"}
