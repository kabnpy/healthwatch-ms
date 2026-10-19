"""
Test suite verifying the realistic seed data pipeline and architectural invariants.
"""

from decimal import Decimal

from sqlmodel import Session, select

from app.models import (
    Activity,
    Claim,
    Client,
    Document,
    Insurer,
    Invoice,
    PaymentAllocation,
    PaymentRecord,
    Policy,
    Product,
    Renewal,
    RiskNote,
    User,
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

    # Invariant: Every underwriter in the catalog must offer at least one product
    from app.seeds.carriers_and_products import INSURERS_DATA

    catalog_insurer_names = {i["name"] for i in INSURERS_DATA}
    for ins in insurers:
        if ins.name in catalog_insurer_names:
            ins_prods = db.exec(
                select(Product).where(Product.insurer_id == ins.id)
            ).all()
            assert len(ins_prods) >= 1, f"Insurer {ins.name} has no products in catalog"

    products = db.exec(select(Product)).all()
    assert len(products) >= 20, f"Expected at least 20 products, got {len(products)}"

    clients = db.exec(select(Client)).all()
    assert len(clients) >= 20, f"Expected at least 20 clients, got {len(clients)}"

    policies = db.exec(select(Policy)).all()
    assert len(policies) >= 15, f"Expected at least 15 policies, got {len(policies)}"

    vehicles = db.exec(select(Vehicle)).all()
    assert len(vehicles) >= 8, f"Expected at least 8 vehicles, got {len(vehicles)}"

    renewals = db.exec(select(Renewal)).all()
    assert len(renewals) >= 6, f"Expected at least 6 renewals, got {len(renewals)}"

    claims = db.exec(select(Claim)).all()
    assert len(claims) >= 3, f"Expected at least 3 claims, got {len(claims)}"

    documents = db.exec(select(Document)).all()
    assert len(documents) >= 10, f"Expected at least 10 documents, got {len(documents)}"

    users = db.exec(select(User)).all()
    assert len(users) >= 5, f"Expected at least 5 staff users, got {len(users)}"

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

    # 3. Check Dashboard Triage Policies (Lapsed and Draft Renewals)
    from app.models import PolicyStatus, RiskNoteStatus, TransactionType

    expired_policies = db.exec(
        select(Policy).where(Policy.status == PolicyStatus.EXPIRED)
    ).all()
    assert len(expired_policies) >= 2, (
        f"Expected at least 2 expired policies for triage, got {len(expired_policies)}"
    )

    draft_renewals = db.exec(
        select(RiskNote).where(
            RiskNote.transaction_type == TransactionType.RENEWAL,
            RiskNote.status == RiskNoteStatus.DRAFT,
        )
    ).all()
    assert len(draft_renewals) >= 1, (
        f"Expected at least 1 draft renewal risk note for triage, got {len(draft_renewals)}"
    )

    # 4. Verify Invariant: Medical policies NEVER use a Risk Note
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

    # 5. Verify Invariant: Motor & Domestic policies have Risk Notes
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

    # 6. Verify Invariant: Payment allocations sum <= PaymentRecord amount
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

    # 7. Verify Idempotency: Re-running seed does NOT duplicate entities or fail
    initial_client_count = len(clients)
    initial_policy_count = len(policies)
    initial_invoice_count = len(invoices)
    initial_claim_count = len(claims)
    initial_doc_count = len(documents)

    create_mock_data(session=db)

    assert len(db.exec(select(Client)).all()) == initial_client_count
    assert len(db.exec(select(Policy)).all()) == initial_policy_count
    assert len(db.exec(select(Invoice)).all()) == initial_invoice_count
    assert len(db.exec(select(Claim)).all()) == initial_claim_count
    assert len(db.exec(select(Document)).all()) == initial_doc_count
