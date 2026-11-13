from datetime import date
from decimal import Decimal

from sqlmodel import Session

from app.models import (
    Client,
    PaymentMethod,
    PaymentRecord,
    PaymentStatus,
)
from app.services.client_ledger import ClientLedgerService


def test_generate_statement_computes_unallocated_credits_from_active_payments(
    db: Session,
) -> None:
    client = Client(
        name="Unapplied Funds Client",
        email="unapplied@example.com",
        phone="0700123456",
        kra_pin="P051234567A",
    )
    db.add(client)
    db.flush()

    active_with_unallocated = PaymentRecord(
        client_id=client.id,
        amount=Decimal("10000.00"),
        unallocated_amount=Decimal("3500.50"),
        payment_date=date(2026, 3, 1),
        payment_method=PaymentMethod.MPESA,
        reference_number="MPESA-001",
        status=PaymentStatus.ACTIVE,
    )
    active_fully_allocated = PaymentRecord(
        client_id=client.id,
        amount=Decimal("5000.00"),
        unallocated_amount=Decimal("0.00"),
        payment_date=date(2026, 3, 2),
        payment_method=PaymentMethod.BANK_TRANSFER,
        reference_number="BANK-002",
        status=PaymentStatus.ACTIVE,
    )
    active_second_unallocated = PaymentRecord(
        client_id=client.id,
        amount=Decimal("2000.00"),
        unallocated_amount=Decimal("1499.50"),
        payment_date=date(2026, 3, 3),
        payment_method=PaymentMethod.MPESA,
        reference_number="MPESA-003",
        status=PaymentStatus.ACTIVE,
    )
    reversed_payment = PaymentRecord(
        client_id=client.id,
        amount=Decimal("4000.00"),
        unallocated_amount=Decimal("4000.00"),
        payment_date=date(2026, 3, 4),
        payment_method=PaymentMethod.MPESA,
        reference_number="MPESA-REV",
        status=PaymentStatus.REVERSED,
    )
    db.add_all(
        [
            active_with_unallocated,
            active_fully_allocated,
            active_second_unallocated,
            reversed_payment,
        ]
    )
    db.commit()

    statement = ClientLedgerService.generate_statement(db, client.id)

    assert statement.unallocated_credits == "5000.00"
