import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.crud import (
    create_invoice,
    get_invoice,
    get_invoices,
)
from app.models import (
    InvoiceBulkCreate,
    InvoiceCreate,
    InvoicePublic,
    InvoicesPublic,
)
from app.services.client_ledger import (
    ClientLedgerService,
    LedgerNotFoundError,
    LedgerValidationError,
)

router = APIRouter()

# ==========================================
# Invoice Routes
# ==========================================


@router.get("/invoices/", response_model=InvoicesPublic)
def read_invoices(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: str | None = None,
) -> Any:
    """
    Retrieve invoices.
    """
    client_uuid: uuid.UUID | None = None
    if client_id:
        try:
            client_uuid = uuid.UUID(client_id)
        except ValueError:
            pass

    invoices = get_invoices(
        session=session, skip=skip, limit=limit, client_id=client_uuid
    )
    return InvoicesPublic(data=invoices, count=len(invoices))


@router.get("/invoices/{id}", response_model=InvoicePublic)
def read_invoice(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get invoice by ID.
    """
    invoice = get_invoice(session=session, id=id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/invoices/", response_model=InvoicePublic)
def create_new_invoice(
    *, session: SessionDep, _current_user: StaffUser, invoice_in: InvoiceCreate
) -> Any:
    """
    Create new invoice.
    """
    return create_invoice(session=session, invoice_in=invoice_in)


@router.post("/bulk-invoices/", response_model=InvoicePublic)
def create_bulk_invoice(
    *, session: SessionDep, _current_user: StaffUser, bulk_in: InvoiceBulkCreate
) -> Any:
    """
    Create an invoice from multiple Risk Notes.
    """
    try:
        return ClientLedgerService.create_bulk_invoice(
            session=session, bulk_in=bulk_in
        )
    except LedgerNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except LedgerValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


