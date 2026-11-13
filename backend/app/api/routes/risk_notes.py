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
    RiskNoteCreate,
    RiskNotePublic,
    RiskNoteRevisionCreate,
    RiskNotesPublic,
    RiskNoteStatus,
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
    current_rn = session.get(RiskNote, id)
    if not current_rn:
        raise HTTPException(status_code=404, detail="Risk note not found")
    if current_rn.status == RiskNoteStatus.REPLACED:
        raise HTTPException(
            status_code=400, detail="Risk note has already been replaced"
        )

    risk_note_in = RiskNoteCreate(
        policy_id=current_rn.policy_id,
        transaction_type=current_rn.transaction_type,
        status=RiskNoteStatus.ISSUED,
        previous_risk_note_id=current_rn.id,
        effective_date=current_rn.effective_date,
        coverage_start=current_rn.coverage_start,
        coverage_end=current_rn.coverage_end,
        net_premium=current_rn.net_premium,
        financial_breakdown=current_rn.financial_breakdown,
        commission_amount=current_rn.commission_amount,
        total_amount=current_rn.total_amount,
        cover_snapshot=(
            revision_in.cover_snapshot
            if revision_in.cover_snapshot is not None
            else current_rn.cover_snapshot
        ),
        special_clauses=revision_in.special_clauses,
        created_by_id=_current_user.id,
    )

    current_rn.status = RiskNoteStatus.REPLACED
    session.add(current_rn)

    return policy_service._create_risk_note(
        session=session, risk_note_in=risk_note_in
    )
