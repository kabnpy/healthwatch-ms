import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.services.statement import ClientStatementService

router = APIRouter()


@router.get("/client/{client_id}")
def get_client_statement(
    client_id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Retrieve reconciled financial statement and ledger for a client."""
    try:
        return ClientStatementService.generate_statement(
            session=session, client_id=client_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
