import uuid
from datetime import date, datetime
from decimal import Decimal

from app.models import (
    Client,
    Invoice,
    InvoiceStatus,
    PaymentAllocation,
    PaymentAllocationStatus,
    PaymentRecord,
    PaymentStatus,
)
from app.services.client_ledger import project_client_statement


def _make_client() -> Client:
    return Client(
        id=uuid.uuid4(),
        name="Acme Corp",
        kra_pin="P051234567A",
        email="billing@acme.test",
    )


def _make_invoice(
    client_id: uuid.UUID,
    invoice_number: str,
    date_issued: date,
    total_amount: str,
    balance_due: str,
    status: InvoiceStatus = InvoiceStatus.UNPAID,
) -> Invoice:
    return Invoice(
        id=uuid.uuid4(),
        client_id=client_id,
        invoice_number=invoice_number,
        date_issued=date_issued,
        due_date=date_issued,
        total_amount=Decimal(total_amount),
        balance_due=Decimal(balance_due),
        status=status,
    )


def _make_allocation(
    invoice_id: uuid.UUID,
    payment_record_id: uuid.UUID,
    amount: str,
    allocated_at: datetime,
) -> PaymentAllocation:
    return PaymentAllocation(
        id=uuid.uuid4(),
        invoice_id=invoice_id,
        payment_record_id=payment_record_id,
        amount=Decimal(amount),
        allocated_at=allocated_at,
        status=PaymentAllocationStatus.ACTIVE,
    )


def test_project_client_statement_chronological_running_balance_and_unapplied_funds() -> None:
    client = _make_client()
    inv1 = _make_invoice(
        client.id, "INV-001", date(2026, 1, 10), "1000.00", "400.00", InvoiceStatus.PARTIAL
    )
    inv2 = _make_invoice(
        client.id, "INV-002", date(2026, 1, 20), "500.00", "500.00", InvoiceStatus.UNPAID
    )
    pmt_id = uuid.uuid4()
    alloc1 = _make_allocation(inv1.id, pmt_id, "600.00", datetime(2026, 1, 15, 10, 0, 0))
    unallocated_pmt = PaymentRecord(
        id=uuid.uuid4(),
        client_id=client.id,
        payment_date=date(2026, 1, 25),
        amount=Decimal("250.00"),
        unallocated_amount=Decimal("250.00"),
        payment_method="MPESA",
        reference_number="MP-123",
        status=PaymentStatus.ACTIVE,
    )

    stmt = project_client_statement(
        client=client,
        invoices=[inv1, inv2],
        allocations=[alloc1],
        active_unallocated_payments=[unallocated_pmt],
        as_of_date=date(2026, 1, 30),
    )

    assert stmt.client_name == "Acme Corp"
    assert stmt.total_invoiced == "1500.00"
    assert stmt.total_allocated == "600.00"
    assert stmt.net_outstanding_balance == "900.00"
    assert stmt.unallocated_credits == "250.00"
    assert stmt.invoice_count == 2
    assert stmt.allocation_count == 1
    assert [e.date for e in stmt.ledger_entries] == ["2026-01-10", "2026-01-15", "2026-01-20"]
    assert [e.running_balance for e in stmt.ledger_entries] == ["1000.00", "400.00", "900.00"]


def test_project_client_statement_aging_buckets_boundaries_and_zero_balance_excluded() -> None:
    client = _make_client()
    as_of = date(2026, 5, 1)

    # 30 days -> current_0_30
    inv_30 = _make_invoice(client.id, "INV-30", date(2026, 4, 1), "100.00", "100.00")
    # 31 days -> days_31_60
    inv_31 = _make_invoice(client.id, "INV-31", date(2026, 3, 31), "200.00", "200.00")
    # 60 days -> days_31_60
    inv_60 = _make_invoice(client.id, "INV-60", date(2026, 3, 2), "50.00", "50.00")
    # 61 days -> days_61_90
    inv_61 = _make_invoice(client.id, "INV-61", date(2026, 3, 1), "300.00", "300.00")
    # 91 days -> over_90
    inv_91 = _make_invoice(client.id, "INV-91", date(2026, 1, 30), "400.00", "400.00")
    # Paid invoice -> excluded from aging
    inv_paid = _make_invoice(
        client.id, "INV-PAID", date(2025, 12, 1), "999.00", "0.00", InvoiceStatus.PAID
    )

    stmt = project_client_statement(
        client=client,
        invoices=[inv_30, inv_31, inv_60, inv_61, inv_91, inv_paid],
        allocations=[],
        active_unallocated_payments=[],
        as_of_date=as_of,
    )

    assert stmt.aging_buckets.current_0_30 == "100.00"
    assert stmt.aging_buckets.days_31_60 == "250.00"
    assert stmt.aging_buckets.days_61_90 == "300.00"
    assert stmt.aging_buckets.over_90 == "400.00"
    assert stmt.aging_buckets.total_overdue == "1050.00"
