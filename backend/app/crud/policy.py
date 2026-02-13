import uuid
from typing import Any

from sqlmodel import Session, func, select

from app.models import Policy, PolicyCreate, PolicyUpdate


def create_policy(*, session: Session, policy_in: PolicyCreate) -> Policy:
    db_obj = Policy.model_validate(policy_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_policy(*, session: Session, id: uuid.UUID) -> Policy | None:
    return session.get(Policy, id)


def get_policies(*, session: Session, skip: int = 0, limit: int = 100) -> Any:
    count_statement = select(func.count()).select_from(Policy)
    count = session.exec(count_statement).one()

    statement = select(Policy).offset(skip).limit(limit)
    policies = session.exec(statement).all()

    return policies, count


def update_policy(
    *, session: Session, db_policy: Policy, policy_in: PolicyUpdate
) -> Any:
    policy_data = policy_in.model_dump(exclude_unset=True)
    db_policy.sqlmodel_update(policy_data)
    session.add(db_policy)
    session.commit()
    session.refresh(db_policy)
    return db_policy


def delete_policy(*, session: Session, id: uuid.UUID) -> Any:
    policy = session.get(Policy, id)
    if not policy:
        return None
    session.delete(policy)
    session.commit()
    return policy
