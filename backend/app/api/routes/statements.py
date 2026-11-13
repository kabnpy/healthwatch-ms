import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.services.client_ledger import (
    ClientLedgerService,
    ClientStatement,
    LedgerNotFoundError,
)

router = APIRouter()


@router.get("/client/{client_id}", response_model=ClientStatement)
def get_client_statement(
    client_id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Retrieve reconciled financial statement and ledger for a client."""
    try:
        return ClientLedgerService.generate_statement(
            session=session, client_id=client_id
        )
    except LedgerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
