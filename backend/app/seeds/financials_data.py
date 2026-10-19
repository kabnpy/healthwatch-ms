"""
Financials Seed Data: Invoices, Cleared Payments, and Ledger Allocations.
Complies strictly with the architectural invariants:
1. Python Decimal with fixed-point arithmetic (zero float usage).
2. PaymentRecord represents cleared funds received in agency bank or paybill.
3. PaymentAllocation records application under lock: sum(allocations) <= payment.amount.
4. Demonstrates real-world patterns: M-Pesa, Bank RTGS, IPF financing, partial payments, and split multi-invoice allocations.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any

from sqlmodel import Session, select

from app import crud
from app.models import (
    Client,
    Invoice,
    InvoiceCreate,
    InvoiceLineItemCreate,
    InvoiceStatus,
    PaymentAllocationCreate,
    PaymentAllocationStatus,
    PaymentMethod,
    PaymentRecord,
    PaymentRecordCreate,
    Policy,
)
from app.services.payment import PaymentService

logger = logging.getLogger(__name__)


def seed_financials(
    session: Session,
    clients: dict[str, Client],
    policies: dict[str, Policy],
) -> dict[str, Any]:
    """
    Seed invoices, cleared payment records, and ledger allocations.
    """
    invoices_by_num: dict[str, Invoice] = {}
    payments_by_ref: dict[str, PaymentRecord] = {}

    # Helper to create invoice with line items if not exists
    def upsert_invoice(
        invoice_number: str,
        client: Client,
        policy: Policy,
        date_issued: date,
        total_amount: Decimal,
        notes: str,
    ) -> Invoice:
        inv = session.exec(
            select(Invoice).where(Invoice.invoice_number == invoice_number)
        ).first()
        if not inv:
            inv = crud.create_invoice(
                session=session,
                invoice_in=InvoiceCreate(
                    invoice_number=invoice_number,
                    client_id=client.id,
                    date_issued=date_issued,
                    due_date=date_issued + (date.today() - date_issued),
                    total_amount=total_amount,
                    balance_due=total_amount,
                    status=InvoiceStatus.UNPAID,
                    notes=notes,
                ),
            )
            # If policy has risk notes, attach an invoice line item
            if policy.risk_notes:
                latest_rn = policy.risk_notes[0]
                crud.create_invoice_line_item(
                    session=session,
                    line_item_in=InvoiceLineItemCreate(
                        invoice_id=inv.id,
                        risk_note_id=latest_rn.id,
                        amount=total_amount,
                        description=f"Premium charge - {policy.policy_number}",
                    ),
                )
            logger.info(f"Created invoice: {invoice_number} for KES {total_amount}")
        invoices_by_num[invoice_number] = inv
        return inv

    # Helper to record payment and allocate
    def record_and_allocate(
        client: Client,
        amount: Decimal,
        method: PaymentMethod,
        ref: str,
        payment_date: date,
        payer: str,
        allocations_plan: list[tuple[Invoice, Decimal]],
    ) -> PaymentRecord:
        rec = session.exec(
            select(PaymentRecord).where(PaymentRecord.reference_number == ref)
        ).first()
        if not rec:
            rec = PaymentService.record_payment(
                session=session,
                payment_in=PaymentRecordCreate(
                    client_id=client.id,
                    amount=amount,
                    payment_date=payment_date,
                    payment_method=method,
                    reference_number=ref,
                    payer_name=payer,
                ),
            )
            logger.info(
                f"Recorded cleared payment {ref}: KES {amount} via {method.value}"
            )

            # Process allocations
            for inv, alloc_amt in allocations_plan:
                PaymentService.allocate_payment(
                    session=session,
                    allocation_in=PaymentAllocationCreate(
                        payment_record_id=rec.id,
                        invoice_id=inv.id,
                        amount=alloc_amt,
                        status=PaymentAllocationStatus.ACTIVE,
                    ),
                )
                logger.info(
                    f"Allocated KES {alloc_amt} from {ref} to Invoice {inv.invoice_number}"
                )

        payments_by_ref[ref] = rec
        return rec

    # 1. Agnes Njoki Mwangi (Motor Policy - Fully Paid via M-Pesa)
    c_agnes = clients["A001158997L"]
    pol_agnes = policies["010/070/1/012473/2017"]
    inv1 = upsert_invoice(
        invoice_number="INV-2025-0012",
        client=c_agnes,
        policy=pol_agnes,
        date_issued=date(2025, 8, 2),
        total_amount=Decimal("158000.00"),
        notes="Annual Comprehensive Motor Premium - KCM 780L",
    )
    record_and_allocate(
        client=c_agnes,
        amount=Decimal("158000.00"),
        method=PaymentMethod.MPESA,
        ref="RKA91H2K8M",
        payment_date=date(2025, 8, 2),
        payer="Agnes Njoki Mwangi",
        allocations_plan=[(inv1, Decimal("158000.00"))],
    )

    # 2. Dr. David Kiptoo (Motor Paid, Medical Partially Paid)
    c_kiptoo = clients["A002849120K"]
    pol_kiptoo_motor = policies["JUB/POL/MOT/2024/09124"]
    inv2 = upsert_invoice(
        invoice_number="INV-2025-0045",
        client=c_kiptoo,
        policy=pol_kiptoo_motor,
        date_issued=date(2025, 11, 15),
        total_amount=Decimal("118500.00"),
        notes="Annual Motor Private Cover - KDA 410M",
    )
    record_and_allocate(
        client=c_kiptoo,
        amount=Decimal("118500.00"),
        method=PaymentMethod.MPESA,
        ref="SBE482L9QP",
        payment_date=date(2025, 11, 15),
        payer="David Kiptoo",
        allocations_plan=[(inv2, Decimal("118500.00"))],
    )

    pol_kiptoo_med = policies["JUB/MED/FAM/2023/11029"]
    inv3 = upsert_invoice(
        invoice_number="INV-2025-0046",
        client=c_kiptoo,
        policy=pol_kiptoo_med,
        date_issued=date(2025, 12, 1),
        total_amount=Decimal("68000.00"),
        notes="Annual Family Medical Cover J-Care 2M",
    )
    # Dr. Kiptoo pays KES 40,000 partial payment leaving KES 28,000 balance
    record_and_allocate(
        client=c_kiptoo,
        amount=Decimal("40000.00"),
        method=PaymentMethod.MPESA,
        ref="TDF109K3JA",
        payment_date=date(2025, 12, 5),
        payer="David Kiptoo",
        allocations_plan=[(inv3, Decimal("40000.00"))],
    )

    # 3. Grace Wanjiku Kariuki (Motor Paid via Cheque, Domestic Unpaid)
    c_grace = clients["A003928174M"]
    pol_grace_motor = policies["BRT/MOT/2024/004812"]
    inv4 = upsert_invoice(
        invoice_number="INV-2025-0089",
        client=c_grace,
        policy=pol_grace_motor,
        date_issued=date(2025, 9, 10),
        total_amount=Decimal("136000.00"),
        notes="Britam Motor Comprehensive - KDB 892P",
    )
    record_and_allocate(
        client=c_grace,
        amount=Decimal("136000.00"),
        method=PaymentMethod.CHEQUE,
        ref="CHQ-002914",
        payment_date=date(2025, 9, 12),
        payer="Grace W. Kariuki",
        allocations_plan=[(inv4, Decimal("136000.00"))],
    )

    pol_grace_dom = policies["BRT/DOM/2024/001924"]
    upsert_invoice(
        invoice_number="INV-2025-0090",
        client=c_grace,
        policy=pol_grace_dom,
        date_issued=date(2025, 9, 10),
        total_amount=Decimal("48718.25"),
        notes="Super Homeowner Domestic Package",
    )
    # inv5 remains UNPAID to reflect real agency ledger receivables

    # 4. Ambassador Michael K. Mutiso (Split RTGS Payment across 2 Invoices)
    c_mutiso = clients["A016892014Y"]
    pol_mutiso_v1 = policies["ICEA/MOT/2024/00091"]
    pol_mutiso_v2 = policies["ICEA/MOT/2024/00092"]
    inv6 = upsert_invoice(
        invoice_number="INV-2025-0120",
        client=c_mutiso,
        policy=pol_mutiso_v1,
        date_issued=date(2025, 10, 1),
        total_amount=Decimal("374000.00"),
        notes="Executive Motor Cover - KDF 001M (LC 300)",
    )
    inv7 = upsert_invoice(
        invoice_number="INV-2025-0121",
        client=c_mutiso,
        policy=pol_mutiso_v2,
        date_issued=date(2025, 10, 1),
        total_amount=Decimal("212000.00"),
        notes="Executive Motor Cover - KDE 888Q (E300)",
    )
    # Single Bank RTGS payment of KES 586,000 split across both invoices under lock
    record_and_allocate(
        client=c_mutiso,
        amount=Decimal("586000.00"),
        method=PaymentMethod.BANK_TRANSFER,
        ref="NCBA/RTGS/2025/90124",
        payment_date=date(2025, 10, 2),
        payer="Amb. Michael K. Mutiso",
        allocations_plan=[
            (inv6, Decimal("374000.00")),
            (inv7, Decimal("212000.00")),
        ],
    )

    # 5. Rift Valley Hauliers Ltd. (IPF Facility financing 2 Trucks)
    c_rv = clients["P051289412M"]
    pol_rv_t1 = policies["OM/COMM/2024/01192"]
    pol_rv_t2 = policies["OM/COMM/2024/01193"]
    inv8 = upsert_invoice(
        invoice_number="INV-2025-0180",
        client=c_rv,
        policy=pol_rv_t1,
        date_issued=date(2025, 11, 10),
        total_amount=Decimal("234000.00"),
        notes="Commercial Truck Cover - KDA 920X",
    )
    inv9 = upsert_invoice(
        invoice_number="INV-2025-0181",
        client=c_rv,
        policy=pol_rv_t2,
        date_issued=date(2025, 11, 10),
        total_amount=Decimal("261000.00"),
        notes="Commercial Truck Cover - KDB 114W",
    )
    # IPF Loan Disbursement from Stanbic Bank for KES 495,000 split across both trucks
    record_and_allocate(
        client=c_rv,
        amount=Decimal("495000.00"),
        method=PaymentMethod.IPF,
        ref="STANBIC-IPF-2025-089",
        payment_date=date(2025, 11, 12),
        payer="Stanbic Bank Kenya Ltd (IPF)",
        allocations_plan=[
            (inv8, Decimal("234000.00")),
            (inv9, Decimal("261000.00")),
        ],
    )

    # 6. Brian Otieno Onyango (M-Pesa)
    c_brian = clients["A004819231P"]
    pol_brian = policies["CIC/MOT/PVT/2025/08412"]
    inv11 = upsert_invoice(
        invoice_number="INV-2026-0015",
        client=c_brian,
        policy=pol_brian,
        date_issued=date(2026, 1, 15),
        total_amount=Decimal("78500.00"),
        notes="CIC Prestige Motor Private - KDC 520Q",
    )
    record_and_allocate(
        client=c_brian,
        amount=Decimal("78500.00"),
        method=PaymentMethod.MPESA,
        ref="QMP812048X",
        payment_date=date(2026, 1, 15),
        payer="Brian Otieno Onyango",
        allocations_plan=[(inv11, Decimal("78500.00"))],
    )

    return {
        "invoices": invoices_by_num,
        "payments": payments_by_ref,
    }
