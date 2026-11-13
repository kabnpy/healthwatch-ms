import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    PaymentAllocationCreate,
    PaymentAllocationPublic,
    PaymentAllocationsPublic,
    PaymentRecordCreate,
    PaymentRecordPublic,
    PaymentRecordsPublic,
    ReversalCreate,
)
from app.services.client_ledger import (
    ClientLedgerService,
    LedgerNotFoundError,
    LedgerValidationError,
)

payment_records_router = APIRouter()
payment_allocations_router = APIRouter()


# ==========================================
# Payment Records
# ==========================================


@payment_records_router.get("/", response_model=PaymentRecordsPublic)
def read_payment_records(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    client_id: uuid.UUID | None = None,
) -> Any:
    """List payment records with pagination and client filter."""
    records = ClientLedgerService.get_payment_records(
        session=session, skip=skip, limit=limit, client_id=client_id
    )
    count = ClientLedgerService.count_payment_records(
        session=session, client_id=client_id
    )
    return PaymentRecordsPublic(data=records, count=count)


@payment_records_router.get("/{id}", response_model=PaymentRecordPublic)
def read_payment_record(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single payment record details."""
    record = ClientLedgerService.get_payment_record(session=session, payment_id=id)
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found")
    return record


@payment_records_router.post(
    "/", response_model=PaymentRecordPublic, status_code=status.HTTP_201_CREATED
)
def create_payment_record(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    payment_in: PaymentRecordCreate,
) -> Any:
    """Record a gross payment instrument/event from a client."""
    try:
        return ClientLedgerService.record_payment(
            session=session, payment_in=payment_in
        )
    except LedgerValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@payment_records_router.post(
    "/{id}/allocations",
    response_model=PaymentAllocationPublic,
    status_code=status.HTTP_201_CREATED,
)
def allocate_payment_to_invoice(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
    allocation_in: PaymentAllocationCreate,
) -> Any:
    """Allocate funds from a payment record to an invoice."""
    if allocation_in.payment_record_id != id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route ID does not match payment_record_id in request body.",
        )
    try:
        return ClientLedgerService.allocate_payment(
            session=session, allocation_in=allocation_in
        )
    except LedgerNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except LedgerValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@payment_records_router.get(
    "/{id}/allocations", response_model=PaymentAllocationsPublic
)
def read_payment_allocations_for_record(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List all allocations funded by this payment record."""
    allocations = ClientLedgerService.get_payment_allocations(
        session=session, skip=skip, limit=limit, payment_record_id=id
    )
    count = ClientLedgerService.count_payment_allocations(
        session=session, payment_record_id=id
    )
    return PaymentAllocationsPublic(data=allocations, count=count)


@payment_records_router.post("/{id}/reverse", response_model=PaymentRecordPublic)
def reverse_payment_record(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
    reversal_in: ReversalCreate,
) -> Any:
    """Atomically reverse a payment record and cascade reversal to all linked allocations."""
    try:
        return ClientLedgerService.reverse_payment_record(
            session=session, payment_id=id, reversal_reason=reversal_in.reversal_reason
        )
    except LedgerNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except LedgerValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# Payment Allocations
# ==========================================


@payment_allocations_router.get("/", response_model=PaymentAllocationsPublic)
def read_payment_allocations(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    payment_record_id: uuid.UUID | None = None,
    invoice_id: uuid.UUID | None = None,
) -> Any:
    """List payment allocations with optional filters."""
    allocations = ClientLedgerService.get_payment_allocations(
        session=session,
        skip=skip,
        limit=limit,
        payment_record_id=payment_record_id,
        invoice_id=invoice_id,
    )
    count = ClientLedgerService.count_payment_allocations(
        session=session,
        payment_record_id=payment_record_id,
        invoice_id=invoice_id,
    )
    return PaymentAllocationsPublic(data=allocations, count=count)


@payment_allocations_router.get("/{id}", response_model=PaymentAllocationPublic)
def read_payment_allocation(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single allocation details."""
    allocation = ClientLedgerService.get_payment_allocation(
        session=session, allocation_id=id
    )
    if not allocation:
        raise HTTPException(status_code=404, detail="Payment allocation not found")
    return allocation


@payment_allocations_router.post(
    "/{id}/reverse", response_model=PaymentAllocationPublic
)
def reverse_payment_allocation(
    *,
    id: uuid.UUID,
    session: SessionDep,
    _current_user: StaffUser,
    reversal_in: ReversalCreate,
) -> Any:
    """Reverse an individual payment allocation and restore the invoice balance."""
    try:
        return ClientLedgerService.reverse_allocation(
            session=session,
            allocation_id=id,
            reversal_reason=reversal_in.reversal_reason,
        )
    except LedgerNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except LedgerValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
