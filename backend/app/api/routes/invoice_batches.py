import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app import crud
from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    InvoiceBatchesPublic,
    InvoiceBatchPublic,
)
from app.services.invoice_batch import InvoiceBatchService

router = APIRouter()


class InvoiceBatchCreateRequest(BaseModel):
    client_id: uuid.UUID
    billing_month: str  # Format: "YYYY-MM"


@router.get("/", response_model=InvoiceBatchesPublic)
def read_invoice_batches(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> Any:
    """Retrieve monthly consolidated invoice batches."""
    batches = crud.get_invoice_batches(
        session=session, skip=skip, limit=limit, client_id=client_id
    )
    count = crud.count_invoice_batches(session=session, client_id=client_id)
    return InvoiceBatchesPublic(data=batches, count=count)


@router.get("/{id}", response_model=InvoiceBatchPublic)
def read_invoice_batch(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single invoice batch by ID."""
    batch = crud.get_invoice_batch(session=session, batch_id=id)
    if not batch:
        raise HTTPException(status_code=404, detail="Invoice batch not found")
    return batch


@router.post(
    "/", response_model=InvoiceBatchPublic, status_code=status.HTTP_201_CREATED
)
def create_monthly_batch(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    request: InvoiceBatchCreateRequest,
) -> Any:
    """Consolidate monthly client invoices into a single batch enforcing UNIQUE(client_id, billing_month)."""
    try:
        return InvoiceBatchService.create_monthly_batch(
            session=session,
            client_id=request.client_id,
            billing_month=request.billing_month,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
