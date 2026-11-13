import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.crud import (
    count_risk_notes,
    get_risk_notes,
)
from app.models import (
    RiskNote,
    RiskNotePublic,
    RiskNoteRevisionCreate,
    RiskNotesPublic,
)
from app.services.policy import policy_service

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
    count = count_risk_notes(
        session=session,
        policy_id=policy_id,
        client_id=client_id,
        uninvoiced_only=uninvoiced_only,
    )
    risk_notes = get_risk_notes(
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
    risk_note = session.get(RiskNote, id)
    if not risk_note:
        raise HTTPException(status_code=404, detail="Risk note not found")
    return risk_note


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
    return policy_service.create_risk_note_revision(
        session=session,
        risk_note_id=id,
        revision_in=revision_in,
        created_by_id=_current_user.id,
    )
