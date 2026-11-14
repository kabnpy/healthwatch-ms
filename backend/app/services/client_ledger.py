import calendar
import logging
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, cast

from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.models import (
    Client,
    Invoice,
    InvoiceBatch,
    InvoiceBatchCreate,
    InvoiceBulkCreate,
    InvoiceCreate,
    InvoiceLineItem,
    InvoiceLineItemCreate,
    InvoiceStatus,
    PaymentAllocation,
    PaymentAllocationCreate,
    PaymentAllocationStatus,
    PaymentRecord,
    PaymentRecordCreate,
    PaymentStatus,
    Policy,
    RiskNote,
)

logger = logging.getLogger(__name__)


class LedgerError(Exception):
    """Base domain error for Client Ledger operations."""


class LedgerNotFoundError(LedgerError):
    """Raised when a requested ledger entity does not exist."""


class LedgerValidationError(LedgerError):
    """Raised when a ledger invariant or input validation fails."""


class ClientStatementEntry(BaseModel):
    date: str
    type: str
    reference: str
    description: str
    debit: str
    credit: str
    status: str
    running_balance: str = "0.00"


class AgingBuckets(BaseModel):
    current_0_30: str = "0.00"
    days_31_60: str = "0.00"
    days_61_90: str = "0.00"
    over_90: str = "0.00"
    total_overdue: str = "0.00"


class ClientStatement(BaseModel):
    client_id: str
    client_name: str
    kra_pin: str | None
    total_invoiced: str
    total_allocated: str
    net_outstanding_balance: str
    unallocated_credits: str = "0.00"
    invoice_count: int
    allocation_count: int
    ledger_entries: list[ClientStatementEntry]
    aging_buckets: AgingBuckets = AgingBuckets()


def _apply_invoice_allocation_delta(
    session: Session,
    invoice: Invoice,
    delta: Decimal,
) -> None:
    """
    Recompute Invoice.balance_due and Invoice.status from a signed balance delta.
    Negative delta reduces balance_due (allocation); positive delta restores it (reversal).
    """
    current_balance = (
        invoice.balance_due
        if invoice.balance_due is not None
        else invoice.total_amount
    )
    new_balance = (current_balance + delta).quantize(Decimal("0.01"))
    new_balance = max(Decimal("0.00"), min(invoice.total_amount, new_balance))
    invoice.balance_due = new_balance

    if invoice.balance_due == Decimal("0.00"):
        invoice.status = InvoiceStatus.PAID
    elif invoice.balance_due == invoice.total_amount:
        invoice.status = InvoiceStatus.UNPAID
    else:
        invoice.status = InvoiceStatus.PARTIAL

    session.add(invoice)


def _month_date_range(billing_month: str) -> tuple[date, date]:
    """Parse 'YYYY-MM' into inclusive start date and exclusive next-month start date."""
    try:
        year_str, month_str = billing_month.split("-", 1)
        year = int(year_str)
        month = int(month_str)
        start = date(year, month, 1)
    except (ValueError, TypeError) as exc:
        raise LedgerValidationError(
            f"Invalid billing_month '{billing_month}'. Expected YYYY-MM."
        ) from exc

    _, last_day = calendar.monthrange(year, month)
    if month == 12:
        end_exclusive = date(year + 1, 1, 1)
    else:
        end_exclusive = date(year, month + 1, 1)
    _ = last_day
    return start, end_exclusive


class ClientLedgerService:
    @staticmethod
    def create_invoice(
        *,
        session: Session,
        invoice_in: InvoiceCreate,
        policy_id: uuid.UUID | None = None,
    ) -> Invoice:
        """Create a single invoice after validating client, optional policy ownership, and number uniqueness."""
        client = session.exec(
            select(Client).where(
                Client.id == invoice_in.client_id,
                Client.deleted_at.is_(None),
            )
        ).first()
        if not client:
            raise LedgerNotFoundError(f"Client {invoice_in.client_id} not found")

        if policy_id is not None:
            policy = session.exec(
                select(Policy).where(
                    Policy.id == policy_id,
                    Policy.deleted_at.is_(None),
                )
            ).first()
            if not policy:
                raise LedgerNotFoundError(f"Policy {policy_id} not found")
            if policy.client_id != invoice_in.client_id:
                raise LedgerValidationError(
                    f"Policy {policy_id} does not belong to client {invoice_in.client_id}."
                )

        existing = session.exec(
            select(Invoice).where(
                Invoice.invoice_number == invoice_in.invoice_number
            )
        ).first()
        if existing:
            raise LedgerValidationError(
                f"Invoice number '{invoice_in.invoice_number}' already exists."
            )

        db_invoice = Invoice.model_validate(invoice_in)
        session.add(db_invoice)
        session.commit()
        session.refresh(db_invoice)
        return db_invoice

    @staticmethod
    def get_invoice(*, session: Session, invoice_id: uuid.UUID) -> Invoice | None:
        statement = (
            select(Invoice)
            .where(Invoice.id == invoice_id, col(Invoice.deleted_at).is_(None))
            .options(
                selectinload(cast(Any, Invoice.payment_allocations)),
                selectinload(cast(Any, Invoice.line_items)),
            )
        )
        return session.exec(statement).first()

    @staticmethod
    def get_invoices(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        client_id: uuid.UUID | None = None,
    ) -> list[Invoice]:
        statement = (
            select(Invoice)
            .where(col(Invoice.deleted_at).is_(None))
            .options(
                selectinload(cast(Any, Invoice.payment_allocations)),
                selectinload(cast(Any, Invoice.line_items)),
            )
        )
        if client_id is not None:
            statement = statement.where(Invoice.client_id == client_id)
        statement = statement.offset(skip).limit(limit)
        return list(session.exec(statement).all())

    @staticmethod
    def count_invoices(
        *,
        session: Session,
        client_id: uuid.UUID | None = None,
    ) -> int:
        statement = select(Invoice).where(col(Invoice.deleted_at).is_(None))
        if client_id is not None:
            statement = statement.where(Invoice.client_id == client_id)
        count_statement = select(func.count()).select_from(statement.subquery())
        return session.exec(count_statement).one()

    @staticmethod
    def create_invoice_line_item(
        *, session: Session, line_item_in: InvoiceLineItemCreate
    ) -> InvoiceLineItem:
        invoice = session.exec(
            select(Invoice).where(
                Invoice.id == line_item_in.invoice_id,
                col(Invoice.deleted_at).is_(None),
            )
        ).first()
        if not invoice:
            raise LedgerNotFoundError(f"Invoice {line_item_in.invoice_id} not found")

        risk_note = session.get(RiskNote, line_item_in.risk_note_id)
        if not risk_note:
            raise LedgerNotFoundError(
                f"RiskNote {line_item_in.risk_note_id} not found"
            )

        db_item = InvoiceLineItem.model_validate(line_item_in)
        session.add(db_item)
        session.commit()
        session.refresh(db_item)
        return db_item

    @staticmethod
    def record_payment(
        *,
        session: Session,
        payment_in: PaymentRecordCreate,
    ) -> PaymentRecord:
        if payment_in.amount <= Decimal("0.00"):
            raise LedgerValidationError("Payment amount must be greater than zero.")
        client = session.exec(
            select(Client).where(
                Client.id == payment_in.client_id,
                col(Client.deleted_at).is_(None),
            )
        ).first()
        if not client:
            raise LedgerNotFoundError(f"Client {payment_in.client_id} not found")

        db_payment = PaymentRecord(
            client_id=payment_in.client_id,
            amount=payment_in.amount,
            unallocated_amount=payment_in.amount,
            payment_date=payment_in.payment_date,
            payment_method=payment_in.payment_method,
            reference_number=payment_in.reference_number,
            payer_name=payment_in.payer_name,
            proof_document_id=payment_in.proof_document_id,
        )
        session.add(db_payment)
        session.flush()

        if payment_in.initial_allocations:
            try:
                for alloc in payment_in.initial_allocations:
                    ClientLedgerService._allocate_payment_in_tx(
                        session=session,
                        payment=db_payment,
                        invoice_id=alloc.invoice_id,
                        amount=alloc.amount,
                        risk_note_id=alloc.risk_note_id,
                    )
            except Exception:
                session.rollback()
                raise

        session.commit()
        session.refresh(db_payment)
        return db_payment

    @staticmethod
    def get_payment_record(
        *, session: Session, payment_id: uuid.UUID
    ) -> PaymentRecord | None:
        return session.exec(
            select(PaymentRecord).where(
                PaymentRecord.id == payment_id,
                col(PaymentRecord.deleted_at).is_(None),
            )
        ).first()

    @staticmethod
    def get_payment_records(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        client_id: uuid.UUID | None = None,
    ) -> list[PaymentRecord]:
        statement = select(PaymentRecord).where(col(PaymentRecord.deleted_at).is_(None))
        if client_id is not None:
            statement = statement.where(PaymentRecord.client_id == client_id)
        statement = (
            statement.order_by(col(PaymentRecord.payment_date).desc())
            .offset(skip)
            .limit(limit)
        )
        return list(session.exec(statement).all())

    @staticmethod
    def count_payment_records(
        *, session: Session, client_id: uuid.UUID | None = None
    ) -> int:
        statement = select(PaymentRecord).where(col(PaymentRecord.deleted_at).is_(None))
        if client_id is not None:
            statement = statement.where(PaymentRecord.client_id == client_id)
        count_statement = select(func.count()).select_from(statement.subquery())
        return session.exec(count_statement).one()

    @staticmethod
    def _allocate_payment_in_tx(
        *,
        session: Session,
        payment: PaymentRecord,
        invoice_id: uuid.UUID,
        amount: Decimal,
        risk_note_id: uuid.UUID | None = None,
    ) -> PaymentAllocation:
        """Apply a single PaymentAllocation inside an active transaction."""
        invoice = session.exec(
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .with_for_update()
        ).first()
        if not invoice:
            raise LedgerNotFoundError("Invoice not found")
        if invoice.client_id != payment.client_id:
            raise LedgerValidationError(
                "Payment client and invoice client do not match."
            )

        if amount <= Decimal("0.00"):
            raise LedgerValidationError("Allocation amount must be greater than zero.")

        if amount > payment.unallocated_amount:
            raise LedgerValidationError(
                f"Allocation amount ({amount}) exceeds unallocated payment amount ({payment.unallocated_amount})."
            )

        current_balance = (
            invoice.balance_due
            if invoice.balance_due is not None
            else invoice.total_amount
        )
        if amount > current_balance:
            raise LedgerValidationError(
                f"Allocation amount ({amount}) exceeds invoice balance due ({current_balance})."
            )

        allocation = PaymentAllocation(
            payment_record_id=payment.id,
            invoice_id=invoice_id,
            risk_note_id=risk_note_id,
            amount=amount,
        )
        session.add(allocation)
        session.flush()

        payment.unallocated_amount = (
            payment.unallocated_amount - amount
        ).quantize(Decimal("0.01"))
        session.add(payment)

        _apply_invoice_allocation_delta(session, invoice, -amount)
        return allocation

    @staticmethod
    def allocate_payment(
        *,
        session: Session,
        allocation_in: PaymentAllocationCreate,
    ) -> PaymentAllocation:
        """
        Allocate funds from PaymentRecord to an Invoice with row-level locks
        and ledger invariant checks.
        """
        payment = session.exec(
            select(PaymentRecord)
            .where(PaymentRecord.id == allocation_in.payment_record_id)
            .with_for_update()
        ).first()
        if not payment:
            raise LedgerNotFoundError("Payment record not found")
        if payment.status != PaymentStatus.ACTIVE:
            raise LedgerValidationError(
                "Cannot allocate from a reversed or inactive payment record."
            )

        allocation = ClientLedgerService._allocate_payment_in_tx(
            session=session,
            payment=payment,
            invoice_id=allocation_in.invoice_id,
            amount=allocation_in.amount,
            risk_note_id=allocation_in.risk_note_id,
        )

        session.commit()
        session.refresh(allocation)
        return allocation

    @staticmethod
    def get_payment_allocation(
        *, session: Session, allocation_id: uuid.UUID
    ) -> PaymentAllocation | None:
        return session.get(PaymentAllocation, allocation_id)

    @staticmethod
    def get_payment_allocations(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        payment_record_id: uuid.UUID | None = None,
        invoice_id: uuid.UUID | None = None,
    ) -> list[PaymentAllocation]:
        statement = select(PaymentAllocation)
        if payment_record_id is not None:
            statement = statement.where(
                PaymentAllocation.payment_record_id == payment_record_id
            )
        if invoice_id is not None:
            statement = statement.where(PaymentAllocation.invoice_id == invoice_id)
        statement = (
            statement.order_by(col(PaymentAllocation.allocated_at).desc())
            .offset(skip)
            .limit(limit)
        )
        return list(session.exec(statement).all())

    @staticmethod
    def count_payment_allocations(
        *,
        session: Session,
        payment_record_id: uuid.UUID | None = None,
        invoice_id: uuid.UUID | None = None,
    ) -> int:
        statement = select(PaymentAllocation)
        if payment_record_id is not None:
            statement = statement.where(
                PaymentAllocation.payment_record_id == payment_record_id
            )
        if invoice_id is not None:
            statement = statement.where(PaymentAllocation.invoice_id == invoice_id)
        count_statement = select(func.count()).select_from(statement.subquery())
        return session.exec(count_statement).one()

    @staticmethod
    def reverse_allocation(
        *,
        session: Session,
        allocation_id: uuid.UUID,
        reversal_reason: str | None = None,
    ) -> PaymentAllocation:
        """Reverse a single allocation and restore invoice and payment balances."""
        allocation = session.exec(
            select(PaymentAllocation)
            .where(PaymentAllocation.id == allocation_id)
            .with_for_update()
        ).first()
        if not allocation:
            raise LedgerNotFoundError("Payment allocation not found")
        if allocation.status == PaymentAllocationStatus.REVERSED:
            raise LedgerValidationError("Allocation is already reversed.")

        allocation.status = PaymentAllocationStatus.REVERSED
        allocation.reversal_reason = reversal_reason
        session.add(allocation)

        payment = session.exec(
            select(PaymentRecord)
            .where(PaymentRecord.id == allocation.payment_record_id)
            .with_for_update()
        ).first()
        if payment and payment.status == PaymentStatus.ACTIVE:
            payment.unallocated_amount = (
                payment.unallocated_amount + allocation.amount
            ).quantize(Decimal("0.01"))
            session.add(payment)

        invoice = session.exec(
            select(Invoice)
            .where(Invoice.id == allocation.invoice_id)
            .with_for_update()
        ).first()
        if invoice:
            _apply_invoice_allocation_delta(session, invoice, allocation.amount)

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
        payment = session.exec(
            select(PaymentRecord)
            .where(PaymentRecord.id == payment_id)
            .with_for_update()
        ).first()
        if not payment:
            raise LedgerNotFoundError("Payment record not found")
        if payment.status == PaymentStatus.REVERSED:
            raise LedgerValidationError("Payment record is already reversed.")

        payment.status = PaymentStatus.REVERSED
        payment.reversal_reason = reversal_reason
        payment.unallocated_amount = Decimal("0.00")
        session.add(payment)

        active_allocations = list(
            session.exec(
                select(PaymentAllocation)
                .where(
                    PaymentAllocation.payment_record_id == payment_id,
                    PaymentAllocation.status == PaymentAllocationStatus.ACTIVE,
                )
                .with_for_update()
            ).all()
        )
        for alloc in active_allocations:
            alloc.status = PaymentAllocationStatus.REVERSED
            alloc.reversal_reason = (
                f"Cascaded from payment reversal: {reversal_reason or ''}".strip()
            )
            session.add(alloc)

            invoice = session.exec(
                select(Invoice)
                .where(Invoice.id == alloc.invoice_id)
                .with_for_update()
            ).first()
            if invoice:
                _apply_invoice_allocation_delta(session, invoice, alloc.amount)

        session.commit()
        session.refresh(payment)
        return payment

    @staticmethod
    def generate_statement(
        session: Session,
        client_id: uuid.UUID,
        as_of_date: date | None = None,
    ) -> ClientStatement:
        """
        Reconciles issued invoices and ACTIVE cleared payment allocations into a typed ClientStatement.
        Excludes REVERSED allocations from balances, counts, and ledger_entries.
        """
        if as_of_date is None:
            as_of_date = date.today()

        client = session.get(Client, client_id)
        if not client:
            raise LedgerNotFoundError("Client not found")

        invoices = session.exec(
            select(Invoice)
            .where(Invoice.client_id == client_id)
            .order_by(Invoice.date_issued.asc())
        ).all()

        total_invoiced = sum((inv.total_amount for inv in invoices), Decimal("0.00"))

        invoice_ids = [inv.id for inv in invoices]
        if invoice_ids:
            allocations = session.exec(
                select(PaymentAllocation)
                .where(
                    PaymentAllocation.invoice_id.in_(invoice_ids),
                    PaymentAllocation.status == PaymentAllocationStatus.ACTIVE,
                )
                .order_by(PaymentAllocation.allocated_at.asc())
            ).all()
        else:
            allocations = []

        total_allocated = sum((a.amount for a in allocations), Decimal("0.00"))
        net_outstanding = total_invoiced - total_allocated

        active_unallocated_payments = session.exec(
            select(PaymentRecord).where(
                PaymentRecord.client_id == client_id,
                PaymentRecord.status == PaymentStatus.ACTIVE,
                PaymentRecord.unallocated_amount > Decimal("0.00"),
            )
        ).all()
        unallocated_credits = sum(
            (p.unallocated_amount for p in active_unallocated_payments),
            Decimal("0.00"),
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        entries: list[ClientStatementEntry] = []
        for inv in invoices:
            entries.append(
                ClientStatementEntry(
                    date=inv.date_issued.isoformat(),
                    type="INVOICE",
                    reference=inv.invoice_number,
                    description=f"Invoice {inv.invoice_number}",
                    debit=str(inv.total_amount),
                    credit="0.00",
                    status=inv.status.value,
                )
            )

        for alloc in allocations:
            entries.append(
                ClientStatementEntry(
                    date=alloc.allocated_at.date().isoformat(),
                    type="PAYMENT_ALLOCATION",
                    reference=str(alloc.payment_record_id),
                    description=f"Payment allocated to Invoice {alloc.invoice_id}",
                    debit="0.00",
                    credit=str(alloc.amount),
                    status="CLEARED",
                )
            )

        entries.sort(key=lambda x: x.date)

        running_bal = Decimal("0.00")
        for entry in entries:
            running_bal += Decimal(entry.debit) - Decimal(entry.credit)
            entry.running_balance = str(running_bal)

        current_0_30 = Decimal("0.00")
        days_31_60 = Decimal("0.00")
        days_61_90 = Decimal("0.00")
        over_90 = Decimal("0.00")

        for inv in invoices:
            if inv.balance_due <= Decimal("0.00"):
                continue
            days = (as_of_date - inv.date_issued).days
            if days <= 30:
                current_0_30 += inv.balance_due
            elif days <= 60:
                days_31_60 += inv.balance_due
            elif days <= 90:
                days_61_90 += inv.balance_due
            else:
                over_90 += inv.balance_due

        q = Decimal("0.01")
        current_0_30 = current_0_30.quantize(q, rounding=ROUND_HALF_UP)
        days_31_60 = days_31_60.quantize(q, rounding=ROUND_HALF_UP)
        days_61_90 = days_61_90.quantize(q, rounding=ROUND_HALF_UP)
        over_90 = over_90.quantize(q, rounding=ROUND_HALF_UP)
        total_overdue = (
            current_0_30 + days_31_60 + days_61_90 + over_90
        ).quantize(q, rounding=ROUND_HALF_UP)

        return ClientStatement(
            client_id=str(client.id),
            client_name=client.name,
            kra_pin=client.kra_pin,
            total_invoiced=str(total_invoiced),
            total_allocated=str(total_allocated),
            net_outstanding_balance=str(net_outstanding),
            unallocated_credits=str(unallocated_credits),
            invoice_count=len(invoices),
            allocation_count=len(allocations),
            ledger_entries=entries,
            aging_buckets=AgingBuckets(
                current_0_30=str(current_0_30),
                days_31_60=str(days_31_60),
                days_61_90=str(days_61_90),
                over_90=str(over_90),
                total_overdue=str(total_overdue),
            ),
        )

    @staticmethod
    def create_monthly_batch(
        session: Session,
        client_id: uuid.UUID,
        billing_month: str,
    ) -> InvoiceBatch:
        """
        Consolidates monthly invoices for corporate/retail clients using a SQL date-range filter.
        Enforces invariant: UNIQUE(client_id, billing_month) - maximum 1 batch per month.
        """
        existing = session.exec(
            select(InvoiceBatch).where(
                InvoiceBatch.client_id == client_id,
                InvoiceBatch.billing_month == billing_month,
            )
        ).first()
        if existing:
            raise LedgerValidationError(
                f"An invoice batch for client {client_id} and month {billing_month} already exists (Batch: {existing.batch_number})."
            )

        client = session.get(Client, client_id)
        if not client:
            raise LedgerNotFoundError("Client not found")

        month_start, month_end_exclusive = _month_date_range(billing_month)
        month_invoices = session.exec(
            select(Invoice).where(
                Invoice.client_id == client_id,
                Invoice.date_issued >= month_start,
                Invoice.date_issued < month_end_exclusive,
            )
        ).all()

        total_amount = sum(
            (inv.total_amount for inv in month_invoices), Decimal("0.00")
        )
        batch_number = f"BATCH-{billing_month}-{str(client_id)[:6].upper()}"

        batch_in = InvoiceBatchCreate(
            client_id=client_id,
            billing_month=billing_month,
            batch_number=batch_number,
            total_amount=total_amount,
            included_invoice_ids=[str(inv.id) for inv in month_invoices],
        )

        db_batch = InvoiceBatch.model_validate(batch_in)
        session.add(db_batch)
        session.commit()
        session.refresh(db_batch)
        return db_batch

    @staticmethod
    def get_invoice_batch(
        *, session: Session, batch_id: uuid.UUID
    ) -> InvoiceBatch | None:
        return session.get(InvoiceBatch, batch_id)

    @staticmethod
    def get_invoice_batches(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        client_id: uuid.UUID | None = None,
    ) -> list[InvoiceBatch]:
        statement = select(InvoiceBatch)
        if client_id is not None:
            statement = statement.where(InvoiceBatch.client_id == client_id)
        statement = (
            statement.order_by(col(InvoiceBatch.generated_at).desc())
            .offset(skip)
            .limit(limit)
        )
        return list(session.exec(statement).all())

    @staticmethod
    def count_invoice_batches(
        *,
        session: Session,
        client_id: uuid.UUID | None = None,
    ) -> int:
        statement = select(InvoiceBatch)
        if client_id is not None:
            statement = statement.where(InvoiceBatch.client_id == client_id)
        count_statement = select(func.count()).select_from(statement.subquery())
        return session.exec(count_statement).one()

    @staticmethod
    def create_bulk_invoice(
        *,
        session: Session,
        bulk_in: InvoiceBulkCreate,
    ) -> Invoice:
        if not bulk_in.risk_note_ids:
            raise LedgerValidationError(
                "At least one RiskNote ID is required to create a bulk invoice."
            )

        requested_ids = list(dict.fromkeys(bulk_in.risk_note_ids))
        risk_notes = session.exec(
            select(RiskNote).where(
                col(RiskNote.id).in_(requested_ids),
                RiskNote.deleted_at.is_(None),
            )
        ).all()
        if len(risk_notes) != len(requested_ids):
            found_ids = {rn.id for rn in risk_notes}
            missing = [str(rid) for rid in requested_ids if rid not in found_ids]
            raise LedgerNotFoundError(
                f"RiskNote(s) not found: {', '.join(missing)}"
            )

        policy_ids = {rn.policy_id for rn in risk_notes}
        policies = session.exec(
            select(Policy).where(
                col(Policy.id).in_(policy_ids),
                Policy.deleted_at.is_(None),
            )
        ).all()
        policy_client_by_id = {p.id: p.client_id for p in policies}
        mismatched = [
            str(rn.id)
            for rn in risk_notes
            if policy_client_by_id.get(rn.policy_id) != bulk_in.client_id
        ]
        if mismatched:
            raise LedgerValidationError(
                f"RiskNote(s) do not belong to client {bulk_in.client_id}: {', '.join(mismatched)}"
            )

        total_amount = sum(
            (rn.total_amount for rn in risk_notes), Decimal("0.00")
        )
        invoice_in = InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=bulk_in.client_id,
            date_issued=bulk_in.date_issued,
            total_amount=total_amount,
            balance_due=total_amount,
            notes=bulk_in.notes,
            status=InvoiceStatus.UNPAID,
        )
        invoice = Invoice.model_validate(invoice_in)
        session.add(invoice)
        session.flush()

        for rn in risk_notes:
            line_item_in = InvoiceLineItemCreate(
                invoice_id=invoice.id,
                risk_note_id=rn.id,
                amount=rn.total_amount,
                description=f"{rn.transaction_type} - RN {rn.risk_note_number}",
            )
            session.add(InvoiceLineItem.model_validate(line_item_in))

        session.commit()
        session.refresh(invoice)
        return invoice

    @staticmethod
    def get_ledger_summary(
        *, session: Session, client_id: uuid.UUID | None = None
    ) -> "LedgerSummary":
        from app.models import LedgerSummary

        inv_stmt = select(
            func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")),
            func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")),
        )
        pmt_stmt = select(
            func.coalesce(func.sum(PaymentRecord.unallocated_amount), Decimal("0.00"))
        )
        if client_id is not None:
            inv_stmt = inv_stmt.where(Invoice.client_id == client_id)
            pmt_stmt = pmt_stmt.where(PaymentRecord.client_id == client_id)

        total_invoiced_raw, total_due_raw = session.exec(inv_stmt).one()
        total_unallocated_raw = session.exec(pmt_stmt).one()

        total_invoiced = Decimal(str(total_invoiced_raw))
        total_due = Decimal(str(total_due_raw))
        total_paid = total_invoiced - total_due
        total_unallocated = Decimal(str(total_unallocated_raw))

        return LedgerSummary(
            total_invoiced=total_invoiced,
            total_paid=total_paid,
            total_due=total_due,
            total_unallocated=total_unallocated,
        )
