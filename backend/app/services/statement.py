import uuid
from decimal import Decimal
from typing import Any

from sqlmodel import Session, select

from app.models import Client, Invoice, PaymentAllocation


class ClientStatementService:
    @staticmethod
    def generate_statement(
        session: Session,
        client_id: uuid.UUID,
    ) -> dict[str, Any]:
        """
        Reconciles issued invoices and cleared payment allocations into a structured client statement.
        """
        client = session.get(Client, client_id)
        if not client:
            raise ValueError("Client not found")

        invoices = session.exec(
            select(Invoice)
            .where(Invoice.client_id == client_id)
            .order_by(Invoice.date_issued.asc())
        ).all()

        total_invoiced = sum((inv.total_amount for inv in invoices), Decimal("0.00"))

        # Fetch payment allocations applied to client invoices
        invoice_ids = [inv.id for inv in invoices]
        if invoice_ids:
            allocations = session.exec(
                select(PaymentAllocation)
                .where(PaymentAllocation.invoice_id.in_(invoice_ids))
                .order_by(PaymentAllocation.allocated_at.asc())
            ).all()
        else:
            allocations = []

        total_allocated = sum((a.amount for a in allocations), Decimal("0.00"))
        net_outstanding = total_invoiced - total_allocated

        # Build chronological ledger entries
        entries = []
        for inv in invoices:
            entries.append(
                {
                    "date": inv.date_issued.isoformat(),
                    "type": "INVOICE",
                    "reference": inv.invoice_number,
                    "description": f"Invoice {inv.invoice_number}",
                    "debit": str(inv.total_amount),
                    "credit": "0.00",
                    "status": inv.status.value,
                }
            )

        for alloc in allocations:
            entries.append(
                {
                    "date": alloc.allocated_at.date().isoformat(),
                    "type": "PAYMENT_ALLOCATION",
                    "reference": str(alloc.payment_record_id),
                    "description": f"Payment allocated to Invoice {alloc.invoice_id}",
                    "debit": "0.00",
                    "credit": str(alloc.amount),
                    "status": "CLEARED",
                }
            )

        entries.sort(key=lambda x: x["date"])

        # Calculate sequential running ledger balance
        running_bal = Decimal("0.00")
        for entry in entries:
            running_bal += Decimal(entry["debit"]) - Decimal(entry["credit"])
            entry["running_balance"] = str(running_bal)

        return {
            "client_id": str(client.id),
            "client_name": client.name,
            "kra_pin": client.kra_pin,
            "total_invoiced": str(total_invoiced),
            "total_allocated": str(total_allocated),
            "net_outstanding_balance": str(net_outstanding),
            "invoice_count": len(invoices),
            "allocation_count": len(allocations),
            "ledger_entries": entries,
        }
