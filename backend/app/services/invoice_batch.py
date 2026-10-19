import uuid
from decimal import Decimal

from sqlmodel import Session, select

from app.models import Client, Invoice, InvoiceBatch, InvoiceBatchCreate


class InvoiceBatchService:
    @staticmethod
    def create_monthly_batch(
        session: Session,
        client_id: uuid.UUID,
        billing_month: str,  # "YYYY-MM"
    ) -> InvoiceBatch:
        """
        Consolidates monthly invoices for corporate/retail clients.
        Enforces invariant: UNIQUE(client_id, billing_month) - maximum 1 batch per month.
        """
        # 1. Check existing batch
        existing = session.exec(
            select(InvoiceBatch).where(
                InvoiceBatch.client_id == client_id,
                InvoiceBatch.billing_month == billing_month,
            )
        ).first()
        if existing:
            raise ValueError(
                f"An invoice batch for client {client_id} and month {billing_month} already exists (Batch: {existing.batch_number})."
            )

        client = session.get(Client, client_id)
        if not client:
            raise ValueError("Client not found")

        # 2. Gather invoices for that month
        # Match invoices by issue_date prefix (e.g. "2026-10")
        all_invoices = session.exec(
            select(Invoice).where(Invoice.client_id == client_id)
        ).all()
        month_invoices = [
            inv
            for inv in all_invoices
            if inv.date_issued.isoformat().startswith(billing_month)
        ]

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
