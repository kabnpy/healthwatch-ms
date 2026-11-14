import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import (
    Client,
    Insurer,
    InvoiceCreate,
    InvoiceLineItemCreate,
    InvoiceStatus,
    PaymentAllocationCreate,
    PaymentMethod,
    PaymentRecord,
    PaymentRecordCreate,
    PaymentStatus,
    Policy,
    PolicyStatus,
    Product,
    RiskNote,
    RiskNoteStatus,
    TransactionType,
)
from app.services.client_ledger import (
    ClientLedgerService,
    LedgerNotFoundError,
    LedgerValidationError,
)


def test_generate_statement_computes_unallocated_credits_from_active_payments(
    db: Session,
) -> None:
    client = Client(
        name="Unapplied Funds Client",
        email=f"unapplied-{uuid.uuid4().hex[:6]}@example.com",
        phone="0700123456",
        kra_pin=f"P{uuid.uuid4().hex[:9].upper()}A",
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



def _create_client(db: Session, suffix: str = "1") -> Client:
    client = Client(
        name=f"Ledger Client {suffix}",
        email=f"ledger{suffix}-{uuid.uuid4().hex[:6]}@example.com",
        phone="0700123456",
        kra_pin=f"P{uuid.uuid4().hex[:9].upper()}",
    )
    db.add(client)
    db.flush()
    return client


def _create_policy(db: Session, client_id: uuid.UUID) -> Policy:
    insurer = Insurer(
        name=f"Insurer {uuid.uuid4().hex[:6]}",
        email=f"insurer-{uuid.uuid4().hex[:6]}@example.com",
    )
    db.add(insurer)
    db.flush()
    product = Product(
        insurer_id=insurer.id,
        name=f"Product {uuid.uuid4().hex[:6]}",
        class_of_insurance="Motor Private",
    )
    db.add(product)
    db.flush()
    policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:6].upper()}",
        client_id=client_id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


def test_create_invoice_happy_path_and_validations(db: Session) -> None:
    client = _create_client(db, "inv")
    db.commit()

    invoice_in = InvoiceCreate(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        client_id=client.id,
        date_issued=date.today(),
        total_amount=Decimal("12500.00"),
        balance_due=Decimal("12500.00"),
        status=InvoiceStatus.UNPAID,
    )
    created = ClientLedgerService.create_invoice(session=db, invoice_in=invoice_in)
    assert created.id is not None
    assert created.client_id == client.id
    assert created.total_amount == Decimal("12500.00")

    # Duplicate invoice_number raises LedgerValidationError
    with pytest.raises(LedgerValidationError):
        ClientLedgerService.create_invoice(session=db, invoice_in=invoice_in)

    # Missing client raises LedgerNotFoundError
    with pytest.raises(LedgerNotFoundError):
        ClientLedgerService.create_invoice(
            session=db,
            invoice_in=InvoiceCreate(
                invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                client_id=uuid.uuid4(),
                date_issued=date.today(),
                total_amount=Decimal("500.00"),
                balance_due=Decimal("500.00"),
                status=InvoiceStatus.UNPAID,
            ),
        )


def test_create_invoice_validates_optional_policy_ownership(db: Session) -> None:
    client_a = _create_client(db, "a")
    client_b = _create_client(db, "b")
    db.commit()
    policy_b = _create_policy(db, client_b.id)

    # Missing policy raises LedgerNotFoundError
    with pytest.raises(LedgerNotFoundError):
        ClientLedgerService.create_invoice(
            session=db,
            invoice_in=InvoiceCreate(
                invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                client_id=client_a.id,
                date_issued=date.today(),
                total_amount=Decimal("1000.00"),
                balance_due=Decimal("1000.00"),
                status=InvoiceStatus.UNPAID,
            ),
            policy_id=uuid.uuid4(),
        )

    # Policy belonging to another client raises LedgerValidationError
    with pytest.raises(LedgerValidationError):
        ClientLedgerService.create_invoice(
            session=db,
            invoice_in=InvoiceCreate(
                invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                client_id=client_a.id,
                date_issued=date.today(),
                total_amount=Decimal("1000.00"),
                balance_due=Decimal("1000.00"),
                status=InvoiceStatus.UNPAID,
            ),
            policy_id=policy_b.id,
        )

    # Matching policy succeeds
    created = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client_b.id,
            date_issued=date.today(),
            total_amount=Decimal("1000.00"),
            balance_due=Decimal("1000.00"),
            status=InvoiceStatus.UNPAID,
        ),
        policy_id=policy_b.id,
    )
    assert created.client_id == client_b.id



def _create_risk_note(db: Session, policy_id: uuid.UUID, amount: Decimal) -> RiskNote:
    today = date.today()
    rn = RiskNote(
        policy_id=policy_id,
        risk_note_number=f"RN-{uuid.uuid4().hex[:8].upper()}",
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        effective_date=today,
        coverage_start=today,
        coverage_end=today + timedelta(days=365),
        net_premium=amount,
        financial_breakdown={},
        commission_amount=Decimal("0.00"),
        total_amount=amount,
        cover_snapshot={},
        special_clauses=[],
    )
    db.add(rn)
    db.commit()
    db.refresh(rn)
    return rn


def test_invoice_reads_and_soft_delete_exclusion(db: Session) -> None:
    client_a = _create_client(db, "ra")
    client_b = _create_client(db, "rb")
    db.commit()

    inv1 = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client_a.id,
            date_issued=date.today(),
            total_amount=Decimal("2000.00"),
            balance_due=Decimal("2000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )
    inv_deleted = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client_a.id,
            date_issued=date.today(),
            total_amount=Decimal("3000.00"),
            balance_due=Decimal("3000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )
    inv_deleted.deleted_at = datetime.now(UTC)
    db.add(inv_deleted)
    db.commit()

    inv_b = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client_b.id,
            date_issued=date.today(),
            total_amount=Decimal("4000.00"),
            balance_due=Decimal("4000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )

    fetched = ClientLedgerService.get_invoice(session=db, invoice_id=inv1.id)
    assert fetched is not None
    assert fetched.id == inv1.id
    assert fetched.line_items == []
    assert fetched.payment_allocations == []

    assert ClientLedgerService.get_invoice(session=db, invoice_id=inv_deleted.id) is None

    a_invoices = ClientLedgerService.get_invoices(session=db, client_id=client_a.id)
    assert [i.id for i in a_invoices] == [inv1.id]
    assert ClientLedgerService.count_invoices(session=db, client_id=client_a.id) == 1
    assert ClientLedgerService.count_invoices(session=db, client_id=client_b.id) == 1
    assert inv_b.id in [i.id for i in ClientLedgerService.get_invoices(session=db)]


def test_create_invoice_line_item_validates_parents(db: Session) -> None:
    client = _create_client(db, "li")
    db.commit()
    policy = _create_policy(db, client.id)
    rn = _create_risk_note(db, policy.id, Decimal("1500.00"))
    inv = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client.id,
            date_issued=date.today(),
            total_amount=Decimal("1500.00"),
            balance_due=Decimal("1500.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )

    with pytest.raises(LedgerNotFoundError):
        ClientLedgerService.create_invoice_line_item(
            session=db,
            line_item_in=InvoiceLineItemCreate(
                invoice_id=uuid.uuid4(),
                risk_note_id=rn.id,
                amount=Decimal("1500.00"),
                description="Missing invoice",
            ),
        )

    with pytest.raises(LedgerNotFoundError):
        ClientLedgerService.create_invoice_line_item(
            session=db,
            line_item_in=InvoiceLineItemCreate(
                invoice_id=inv.id,
                risk_note_id=uuid.uuid4(),
                amount=Decimal("1500.00"),
                description="Missing risk note",
            ),
        )

    item = ClientLedgerService.create_invoice_line_item(
        session=db,
        line_item_in=InvoiceLineItemCreate(
            invoice_id=inv.id,
            risk_note_id=rn.id,
            amount=Decimal("1500.00"),
            description="Valid line item",
        ),
    )
    assert item.invoice_id == inv.id
    assert item.risk_note_id == rn.id



def test_payment_and_allocation_reads_and_soft_delete(db: Session) -> None:
    client = _create_client(db, "pay")
    db.commit()

    inv = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client.id,
            date_issued=date.today(),
            total_amount=Decimal("5000.00"),
            balance_due=Decimal("5000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )

    pmt1 = ClientLedgerService.record_payment(
        session=db,
        payment_in=PaymentRecordCreate(
            client_id=client.id,
            amount=Decimal("3000.00"),
            payment_date=date.today(),
            payment_method=PaymentMethod.MPESA,
            reference_number=f"REF-{uuid.uuid4().hex[:6]}",
        ),
    )
    pmt_deleted = ClientLedgerService.record_payment(
        session=db,
        payment_in=PaymentRecordCreate(
            client_id=client.id,
            amount=Decimal("1000.00"),
            payment_date=date.today(),
            payment_method=PaymentMethod.MPESA,
            reference_number=f"REF-{uuid.uuid4().hex[:6]}",
        ),
    )
    pmt_deleted.deleted_at = datetime.now(UTC)
    db.add(pmt_deleted)
    db.commit()

    assert ClientLedgerService.get_payment_record(session=db, payment_id=pmt1.id) is not None
    assert ClientLedgerService.get_payment_record(session=db, payment_id=pmt_deleted.id) is None
    records = ClientLedgerService.get_payment_records(session=db, client_id=client.id)
    assert [r.id for r in records] == [pmt1.id]
    assert ClientLedgerService.count_payment_records(session=db, client_id=client.id) == 1

    alloc = ClientLedgerService.allocate_payment(
        session=db,
        allocation_in=PaymentAllocationCreate(
            payment_record_id=pmt1.id,
            invoice_id=inv.id,
            amount=Decimal("1500.00"),
        ),
    )
    fetched_alloc = ClientLedgerService.get_payment_allocation(
        session=db, allocation_id=alloc.id
    )
    assert fetched_alloc is not None
    assert fetched_alloc.id == alloc.id

    allocs_by_pmt = ClientLedgerService.get_payment_allocations(
        session=db, payment_record_id=pmt1.id
    )
    assert [a.id for a in allocs_by_pmt] == [alloc.id]
    assert (
        ClientLedgerService.count_payment_allocations(
            session=db, payment_record_id=pmt1.id, invoice_id=inv.id
        )
        == 1
    )


def test_invoice_batch_reads(db: Session) -> None:
    client = _create_client(db, "batch")
    db.commit()

    batch = ClientLedgerService.create_monthly_batch(
        session=db,
        client_id=client.id,
        billing_month="2026-04",
    )
    fetched = ClientLedgerService.get_invoice_batch(session=db, batch_id=batch.id)
    assert fetched is not None
    assert fetched.id == batch.id

    batches = ClientLedgerService.get_invoice_batches(session=db, client_id=client.id)
    assert [b.id for b in batches] == [batch.id]
    assert ClientLedgerService.count_invoice_batches(session=db, client_id=client.id) == 1


def test_record_payment_with_initial_allocations_atomic_commit_and_rollback(
    db: Session,
) -> None:
    from app.models import InitialPaymentAllocation

    client = _create_client(db, "atomic")
    db.commit()

    inv1 = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client.id,
            date_issued=date.today(),
            total_amount=Decimal("2000.00"),
            balance_due=Decimal("2000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )
    inv2 = ClientLedgerService.create_invoice(
        session=db,
        invoice_in=InvoiceCreate(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            client_id=client.id,
            date_issued=date.today(),
            total_amount=Decimal("1000.00"),
            balance_due=Decimal("1000.00"),
            status=InvoiceStatus.UNPAID,
        ),
    )

    # Valid atomic payment + initial allocation
    pmt = ClientLedgerService.record_payment(
        session=db,
        payment_in=PaymentRecordCreate(
            client_id=client.id,
            amount=Decimal("2500.00"),
            payment_date=date.today(),
            payment_method=PaymentMethod.MPESA,
            reference_number=f"REF-{uuid.uuid4().hex[:6]}",
            initial_allocations=[
                InitialPaymentAllocation(invoice_id=inv1.id, amount=Decimal("2000.00")),
            ],
        ),
    )
    assert pmt.unallocated_amount == Decimal("500.00")
    db.refresh(inv1)
    assert inv1.balance_due == Decimal("0.00")
    assert inv1.status == InvoiceStatus.PAID

    # Failed second allocation must roll back the entire PaymentRecord
    with pytest.raises(LedgerValidationError):
        ClientLedgerService.record_payment(
            session=db,
            payment_in=PaymentRecordCreate(
                client_id=client.id,
                amount=Decimal("1500.00"),
                payment_date=date.today(),
                payment_method=PaymentMethod.MPESA,
                reference_number=f"REF-{uuid.uuid4().hex[:6]}",
                initial_allocations=[
                    InitialPaymentAllocation(
                        invoice_id=inv2.id, amount=Decimal("1500.00")
                    ),
                ],
            ),
        )

    assert ClientLedgerService.count_payment_records(session=db, client_id=client.id) == 1
    db.refresh(inv2)
    assert inv2.balance_due == Decimal("1000.00")
    assert inv2.status == InvoiceStatus.UNPAID
