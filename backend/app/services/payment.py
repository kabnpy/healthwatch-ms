import logging
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app import crud
from app.models import (
    Invoice,
    InvoiceStatus,
    PaymentAllocation,
    PaymentAllocationCreate,
    PaymentAllocationStatus,
    PaymentRecord,
    PaymentRecordCreate,
    PaymentStatus,
)

logger = logging.getLogger(__name__)


class PaymentService:
    @staticmethod
    def record_payment(
        *,
        session: Session,
        payment_in: PaymentRecordCreate,
    ) -> PaymentRecord:
        if payment_in.amount <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount must be greater than zero.",
            )
        return crud.create_payment_record(session=session, payment_in=payment_in)

    @staticmethod
    def allocate_payment(
        *,
        session: Session,
        allocation_in: PaymentAllocationCreate,
    ) -> PaymentAllocation:
        """
        Allocate funds from PaymentRecord to an Invoice with ledger invariant checks.
        Invariant: sum(allocations) <= payment_record.amount.
        """
        payment = session.get(PaymentRecord, allocation_in.payment_record_id)
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
        if payment.status != PaymentStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot allocate from a reversed or inactive payment record.",
            )

        invoice = session.get(Invoice, allocation_in.invoice_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if invoice.client_id != payment.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment client and invoice client do not match.",
            )

        if allocation_in.amount <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Allocation amount must be greater than zero.",
            )

        if allocation_in.amount > payment.unallocated_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Allocation amount ({allocation_in.amount}) exceeds unallocated payment amount ({payment.unallocated_amount}).",
            )

        # Create allocation
        allocation = crud.create_payment_allocation(
            session=session, allocation_in=allocation_in
        )

        # Update payment record unallocated amount
        payment.unallocated_amount = (
            payment.unallocated_amount - allocation_in.amount
        ).quantize(Decimal("0.01"))
        session.add(payment)

        # Update invoice balance_due and status
        current_balance = (
            invoice.balance_due
            if invoice.balance_due is not None
            else invoice.total_amount
        )
        new_balance = max(Decimal("0.00"), current_balance - allocation_in.amount)
        invoice.balance_due = new_balance.quantize(Decimal("0.01"))

        if invoice.balance_due == Decimal("0.00"):
            invoice.status = InvoiceStatus.PAID
        elif invoice.balance_due < invoice.total_amount:
            invoice.status = InvoiceStatus.PARTIAL

        session.add(invoice)
        session.commit()
        session.refresh(allocation)
        return allocation

    @staticmethod
    def reverse_allocation(
        *,
        session: Session,
        allocation_id: uuid.UUID,
        reversal_reason: str | None = None,
    ) -> PaymentAllocation:
        """Reverse a single allocation and restore invoice and payment balances."""
        allocation = session.get(PaymentAllocation, allocation_id)
        if not allocation:
            raise HTTPException(status_code=404, detail="Payment allocation not found")
        if allocation.status == PaymentAllocationStatus.REVERSED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Allocation is already reversed.",
            )

        allocation.status = PaymentAllocationStatus.REVERSED
        allocation.reversal_reason = reversal_reason
        session.add(allocation)

        payment = session.get(PaymentRecord, allocation.payment_record_id)
        if payment and payment.status == PaymentStatus.ACTIVE:
            payment.unallocated_amount = (
                payment.unallocated_amount + allocation.amount
            ).quantize(Decimal("0.01"))
            session.add(payment)

        invoice = session.get(Invoice, allocation.invoice_id)
        if invoice:
            current_balance = (
                invoice.balance_due
                if invoice.balance_due is not None
                else Decimal("0.00")
            )
            new_balance = min(invoice.total_amount, current_balance + allocation.amount)
            invoice.balance_due = new_balance.quantize(Decimal("0.01"))
            if invoice.balance_due == invoice.total_amount:
                invoice.status = InvoiceStatus.UNPAID
            elif invoice.balance_due > Decimal("0.00"):
                invoice.status = InvoiceStatus.PARTIAL
            session.add(invoice)

        session.commit()
        session.refresh(allocation)
        return allocation

    @staticmethod
    def reverse_payment_record(
        *,
        session: Session,
        payment_id: uuid.UUID,
        reversal_reason: str | None = None,
    ) -> PaymentRecord:
        """Atomically reverse a payment record and cascade reversal to all linked allocations."""
        payment = session.get(PaymentRecord, payment_id)
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
        if payment.status == PaymentStatus.REVERSED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment record is already reversed.",
            )

        payment.status = PaymentStatus.REVERSED
        payment.reversal_reason = reversal_reason
        payment.unallocated_amount = Decimal("0.00")
        session.add(payment)

        # Cascade to all active allocations
        statement = select(PaymentAllocation).where(
            PaymentAllocation.payment_record_id == payment_id,
            PaymentAllocation.status == PaymentAllocationStatus.ACTIVE,
        )
        active_allocations = list(session.exec(statement).all())
        for alloc in active_allocations:
            alloc.status = PaymentAllocationStatus.REVERSED
            alloc.reversal_reason = (
                f"Cascaded from payment reversal: {reversal_reason or ''}".strip()
            )
            session.add(alloc)

            invoice = session.get(Invoice, alloc.invoice_id)
            if invoice:
                current_balance = (
                    invoice.balance_due
                    if invoice.balance_due is not None
                    else Decimal("0.00")
                )
                new_balance = min(invoice.total_amount, current_balance + alloc.amount)
                invoice.balance_due = new_balance.quantize(Decimal("0.01"))
                if invoice.balance_due == invoice.total_amount:
                    invoice.status = InvoiceStatus.UNPAID
                elif invoice.balance_due > Decimal("0.00"):
                    invoice.status = InvoiceStatus.PARTIAL
                session.add(invoice)

        session.commit()
        session.refresh(payment)
        return payment
