import uuid
from datetime import date
from decimal import Decimal
import pytest
from sqlmodel import Session, select
from app.models import (
    Policy, RiskNote, PolicyStatus, RiskNoteStatus, 
    TransactionType, Client, Product, Insurer, 
    PolicyCreate, Invoice, InvoiceLineItem
)
from app.services.policy import policy_service

def test_create_policy_no_automatic_invoice(db: Session) -> None:
    """
    Test that PolicyService.create_policy creates a RiskNote BUT NOT an Invoice.
    """
    insurer = Insurer(name="No Invoice Insurer")
    db.add(insurer)
    db.commit()
    
    product = Product(
        name="No Invoice Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        pricing_rules={"tiers": []}
    )
    db.add(product)
    db.commit()

    client = Client(
        name="No Invoice Client",
        kra_pin="N111111111Z",
        phone="0733333333"
    )
    db.add(client)
    db.commit()

    cover_data = {
        "vehicle": {
            "registration_number": "KBA 999",
            "make": "Toyota",
            "sum_insured": 1000000
        }
    }

    policy_in = PolicyCreate(
        policy_number="POL-NO-INV-001",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today()
    )

    policy = policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        cover_snapshot=cover_data,
        coverage_start=date.today(),
        coverage_end=date.today()
    )
    db.commit()
    db.refresh(policy)

    assert len(policy.risk_notes) == 1
    rn = policy.risk_notes[0]
    
    # Verify Risk Note is created
    assert rn.status == RiskNoteStatus.ISSUED
    
    # Verify NO invoice is created or linked
    # (Based on current implementation, it might still have invoice_number if we haven't refactored yet)
    # This test is EXPECTED TO FAIL during the Red phase because current logic creates an invoice.
    
    invoices = db.exec(select(Invoice).where(Invoice.client_id == client.id)).all()
    assert len(invoices) == 0, "Invoice was automatically created but should not have been"
    
    line_items = db.exec(select(InvoiceLineItem).where(InvoiceLineItem.risk_note_id == rn.id)).all()
    assert len(line_items) == 0, "Invoice line item was automatically created but should not have been"

def test_create_endorsement_no_automatic_invoice(db: Session) -> None:
    """
    Test that PolicyService.create_endorsement creates a RiskNote BUT NOT an Invoice.
    """
    # Setup initial policy (ignoring automatic invoice for the first note if it happens for now)
    insurer = Insurer(name="Endorsement No Invoice Insurer")
    db.add(insurer)
    db.commit()
    
    product = Product(
        name="Endorsement No Invoice Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        pricing_rules={"tiers": []}
    )
    db.add(product)
    db.commit()

    client = Client(
        name="Endorsement No Invoice Client",
        kra_pin="EN111111111Z",
        phone="0744444444"
    )
    db.add(client)
    db.commit()

    initial_cover = {
        "vehicle": {"registration_number": "KBA 888", "make": "Honda", "sum_insured": 800000}
    }

    policy_in = PolicyCreate(
        policy_number="POL-END-NO-INV-001",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today()
    )

    policy = policy_service.create_policy(
        session=db,
        policy_in=policy_in,
        cover_snapshot=initial_cover,
        coverage_start=date.today(),
        coverage_end=date.today()
    )
    db.commit()
    
    # Clear any invoices created by the first step to isolate the endorsement test
    # (In the final state, none will be created)
    db.exec(select(Invoice).where(Invoice.client_id == client.id)).all() # Flush
    
    # Create endorsement
    updated_cover = initial_cover.copy()
    updated_cover["vehicle"]["sum_insured"] = 900000

    # Count invoices before endorsement
    initial_invoice_count = len(db.exec(select(Invoice).where(Invoice.client_id == client.id)).all())

    policy_service.create_endorsement(
        session=db,
        policy_id=policy.id,
        updated_cover_snapshot=updated_cover,
        change_description="Testing decoupled endorsement"
    )
    db.commit()
    db.refresh(policy)

    # Verify 2 risk notes exist
    assert len(policy.risk_notes) == 2
    
    # Verify NO NEW invoice was created
    final_invoices = db.exec(select(Invoice).where(Invoice.client_id == client.id)).all()
    assert len(final_invoices) == initial_invoice_count, "New invoice was automatically created for endorsement"

def test_get_risk_notes_uninvoiced_filter(db: Session) -> None:
    """
    Test that the uninvoiced_only filter correctly returns risk notes without line items.
    """
    from app import crud
    from app.models import InvoiceCreate, InvoiceLineItemCreate, InvoiceStatus
    
    insurer = Insurer(name="Filter Insurer")
    db.add(insurer)
    db.commit()
    
    product = Product(
        name="Filter Product",
        class_of_insurance="Motor Private",
        insurer_id=insurer.id,
        pricing_rules={"tiers": []}
    )
    db.add(product)
    db.commit()

    client = Client(
        name="Filter Client",
        kra_pin="F111111111Z",
        phone="0755555555"
    )
    db.add(client)
    db.commit()

    # Create actual policies to satisfy foreign key constraints
    policy1 = Policy(
        policy_number="POL-F-001",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE
    )
    policy2 = Policy(
        policy_number="POL-F-002",
        client_id=client.id,
        product_id=product.id,
        status=PolicyStatus.ACTIVE
    )
    db.add(policy1)
    db.add(policy2)
    db.commit()

    # Create 2 risk notes
    rn1 = RiskNote(
        policy_id=policy1.id,
        risk_note_number="RN-F-001",
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("100"),
        commission_amount=Decimal("10"),
        total_amount=Decimal("110")
    )
    rn2 = RiskNote(
        policy_id=policy2.id,
        risk_note_number="RN-F-002",
        transaction_type=TransactionType.NEW_BUSINESS,
        status=RiskNoteStatus.ISSUED,
        coverage_start=date.today(),
        coverage_end=date.today(),
        net_premium=Decimal("200"),
        commission_amount=Decimal("20"),
        total_amount=Decimal("220")
    )
    db.add(rn1)
    db.add(rn2)
    db.commit()

    # Verify both are returned by uninvoiced filter
    uninvoiced = crud.get_risk_notes(db, uninvoiced_only=True)
    rn_ids = [rn.id for rn in uninvoiced]
    assert rn1.id in rn_ids
    assert rn2.id in rn_ids

    # Link rn1 to an invoice
    invoice = crud.create_invoice(session=db, invoice_in=InvoiceCreate(
        invoice_number="INV-F-001",
        client_id=client.id,
        date_issued=date.today(),
        total_amount=Decimal("110"),
        balance_due=Decimal("110"),
        status=InvoiceStatus.UNPAID
    ))
    crud.create_invoice_line_item(session=db, line_item_in=InvoiceLineItemCreate(
        invoice_id=invoice.id,
        risk_note_id=rn1.id,
        amount=Decimal("110"),
        description="Test line item"
    ))
    db.commit()

    # Verify only rn2 is now returned
    uninvoiced_after = crud.get_risk_notes(db, uninvoiced_only=True)
    rn_ids_after = [rn.id for rn in uninvoiced_after]
    assert rn1.id not in rn_ids_after
    assert rn2.id in rn_ids_after
