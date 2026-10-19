import uuid
from typing import Any

from fastapi import APIRouter, status

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ActivitiesPublic,
    ActivityCreate,
    ActivityPublic,
)

router = APIRouter()


@router.get("/", response_model=ActivitiesPublic)
def read_activities(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
    policy_id: uuid.UUID | None = None,
    renewal_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve operational timeline activities for a client, policy, or renewal."""
    activities = crud.get_activities(
        session=session,
        skip=skip,
        limit=limit,
        client_id=client_id,
        policy_id=policy_id,
        renewal_id=renewal_id,
    )
    count = crud.count_activities(
        session=session,
        client_id=client_id,
        policy_id=policy_id,
        renewal_id=renewal_id,
    )
    return ActivitiesPublic(data=activities, count=count)


@router.post("/", response_model=ActivityPublic, status_code=status.HTTP_201_CREATED)
def create_activity(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    activity_in: ActivityCreate,
) -> Any:
    """Append a communication note, call, meeting, or reminder to the operational history."""
    return crud.create_activity(
        session=session, activity_in=activity_in, created_by_id=current_user.id
    )
