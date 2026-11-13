import uuid
from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.api.utils import raise_policy_http_error
from app.models import (
    RiskNotePublic,
    RiskNoteRevisionCreate,
    RiskNotesPublic,
)
from app.services.policy import PolicyError, policy_service

router = APIRouter()


@router.get("/", response_model=RiskNotesPublic)
def read_risk_notes(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    policy_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    uninvoiced_only: bool = False,
) -> Any:
    """
    Retrieve risk notes.
    """
    risk_notes, count = policy_service.list_risk_notes(
        session=session,
        skip=skip,
        limit=limit,
        policy_id=policy_id,
        client_id=client_id,
        uninvoiced_only=uninvoiced_only,
    )
    return RiskNotesPublic(data=risk_notes, count=count)


@router.get("/{id}", response_model=RiskNotePublic)
def read_risk_note(
    session: SessionDep, _current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Get risk note by ID.
    """
    try:
        return policy_service.get_risk_note(session=session, risk_note_id=id)
    except PolicyError as exc:
        raise_policy_http_error(exc)


@router.post("/{id}/revisions", response_model=RiskNotePublic)
def create_risk_note_revision(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    revision_in: RiskNoteRevisionCreate,
) -> Any:
    """
    Append a non-financial clause revision for an existing risk note.
    Preserves financial amounts and marks the prior risk note as REPLACED.
    """
    try:
        return policy_service.create_risk_note_revision(
            session=session,
            risk_note_id=id,
            revision_in=revision_in,
            created_by_id=_current_user.id,
        )
    except PolicyError as exc:
        raise_policy_http_error(exc)
