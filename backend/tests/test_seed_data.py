"""
Test suite verifying the realistic seed data pipeline and architectural invariants.
"""

from decimal import Decimal

from sqlmodel import Session, select

from app.models import (
    Activity,
    Client,
    Insurer,
    Invoice,
    PaymentAllocation,
    PaymentRecord,
    Policy,
    Product,
    Renewal,
    RiskNote,
    Vehicle,
)
from app.seed_mock_data import create_mock_data


def test_seed_data_pipeline_and_invariants(db: Session) -> None:
    """
    Verify full portfolio seed execution and architectural invariants.
    """
    # 1. Run seed pipeline
    create_mock_data(session=db)

    # 2. Check counts
    insurers = db.exec(select(Insurer)).all()
    assert len(insurers) >= 8, f"Expected at least 8 underwriters, got {len(insurers)}"

    products = db.exec(select(Product)).all()
    assert len(products) >= 12, f"Expected at least 12 products, got {len(products)}"

    clients = db.exec(select(Client)).all()
    assert len(clients) >= 20, f"Expected at least 20 clients, got {len(clients)}"

    policies = db.exec(select(Policy)).all()
    assert len(policies) >= 10, f"Expected at least 10 policies, got {len(policies)}"

    vehicles = db.exec(select(Vehicle)).all()
    assert len(vehicles) >= 8, f"Expected at least 8 vehicles, got {len(vehicles)}"

    renewals = db.exec(select(Renewal)).all()
    assert len(renewals) >= 5, f"Expected at least 5 renewals, got {len(renewals)}"

    invoices = db.exec(select(Invoice)).all()
    assert len(invoices) >= 6, f"Expected at least 6 invoices, got {len(invoices)}"

    payments = db.exec(select(PaymentRecord)).all()
    assert len(payments) >= 5, (
        f"Expected at least 5 payment records, got {len(payments)}"
    )

    activities = db.exec(select(Activity)).all()
    assert len(activities) >= 4, (
        f"Expected at least 4 activities, got {len(activities)}"
    )

    # 3. Verify Invariant: Medical policies NEVER use a Risk Note
    medical_policies = [
        p
        for p in policies
        if p.product and "medical" in p.product.class_of_insurance.lower()
    ]
    assert len(medical_policies) > 0, "Expected at least one medical policy"
    for med_pol in medical_policies:
        rns = db.exec(select(RiskNote).where(RiskNote.policy_id == med_pol.id)).all()
        assert len(rns) == 0, (
            f"Medical policy {med_pol.policy_number} must NOT have Risk Notes"
        )

    # 4. Verify Invariant: Motor & Domestic policies have Risk Notes
    motor_policies = [
        p
        for p in policies
        if p.product and "motor" in p.product.class_of_insurance.lower()
    ]
    for mot_pol in motor_policies:
        rns = db.exec(select(RiskNote).where(RiskNote.policy_id == mot_pol.id)).all()
        assert len(rns) >= 1, (
            f"Motor policy {mot_pol.policy_number} should have at least 1 Risk Note"
        )

    # 5. Verify Invariant: Payment allocations sum <= PaymentRecord amount
    for p_rec in payments:
        allocs = db.exec(
            select(PaymentAllocation).where(
                PaymentAllocation.payment_record_id == p_rec.id
            )
        ).all()
        total_alloc = sum((a.amount for a in allocs), Decimal("0.00"))
        assert total_alloc <= p_rec.amount, (
            f"Allocations {total_alloc} exceed payment amount {p_rec.amount} on {p_rec.reference_number}"
        )
        assert p_rec.unallocated_amount == (p_rec.amount - total_alloc), (
            f"Unallocated balance mismatch on {p_rec.reference_number}"
        )

    # 6. Verify Idempotency: Re-running seed does NOT duplicate entities or fail
    initial_client_count = len(clients)
    initial_policy_count = len(policies)
    initial_invoice_count = len(invoices)

    create_mock_data(session=db)

    assert len(db.exec(select(Client)).all()) == initial_client_count
    assert len(db.exec(select(Policy)).all()) == initial_policy_count
    assert len(db.exec(select(Invoice)).all()) == initial_invoice_count
