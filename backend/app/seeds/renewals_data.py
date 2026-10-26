"""
Renewals Workflow Seed Data.
Distributes policy renewals across the 6 formal lifecycle stages:
awaiting_carrier, carrier_received, client_invited, changes_requested, paid, completed.
Enforces invariant: at most one active renewal per policy.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session

from app import crud
from app.models import Policy, Renewal, RenewalCreate, RenewalStatus, get_datetime_utc

logger = logging.getLogger(__name__)


def seed_renewals(
    session: Session,
    policies: dict[str, Policy],
) -> list[Renewal]:
    """
    Seed renewals covering all 6 lifecycle stages.
    """
    today = date.today()
    renewals: list[Renewal] = []

    # Helper to create renewal with specific status if no active renewal exists
    def upsert_renewal(
        policy_number: str,
        target_status: RenewalStatus,
        period_start: date,
        period_end: date,
        previous_premium: Decimal,
        proposed_premium: Decimal | None = None,
        agreed_premium: Decimal | None = None,
        notes: str | None = None,
        carrier_doc: str | None = None,
    ) -> Renewal | None:
        policy = policies.get(policy_number)
        if not policy:
            logger.warning(f"Policy {policy_number} not found for renewal seeding")
            return None

        existing = crud.get_active_renewal_by_policy(session, policy_id=policy.id)
        if existing:
            existing.renewal_period_start = period_start
            existing.renewal_period_end = period_end
            session.add(existing)
            session.commit()
            return existing

        now = get_datetime_utc()

        renewal = crud.create_renewal(
            session=session,
            renewal_in=RenewalCreate(
                policy_id=policy.id,
                renewal_period_start=period_start,
                renewal_period_end=period_end,
                previous_premium=previous_premium,
                proposed_premium=proposed_premium,
                notes=notes,
            ),
        )

        # Set specific status and audit timestamps
        renewal.status = target_status
        renewal.agreed_premium = agreed_premium
        renewal.carrier_document_key = carrier_doc

        if target_status in (
            RenewalStatus.CARRIER_RECEIVED,
            RenewalStatus.CLIENT_INVITED,
            RenewalStatus.CHANGES_REQUESTED,
            RenewalStatus.PAID,
            RenewalStatus.COMPLETED,
        ):
            renewal.carrier_received_at = now

        if target_status in (
            RenewalStatus.CLIENT_INVITED,
            RenewalStatus.CHANGES_REQUESTED,
            RenewalStatus.PAID,
            RenewalStatus.COMPLETED,
        ):
            renewal.invited_at = now

        if target_status in (RenewalStatus.PAID, RenewalStatus.COMPLETED):
            renewal.paid_at = now

        if target_status == RenewalStatus.COMPLETED:
            renewal.completed_at = now

        session.add(renewal)
        session.commit()
        session.refresh(renewal)
        logger.info(
            f"Seeded renewal {renewal.id} for {policy_number} in state: {target_status.value}"
        )
        return renewal

    # 1. State: awaiting_carrier (expiring in 8 days)
    r1_start = today + timedelta(days=9)
    r1 = upsert_renewal(
        policy_number="JUB/POL/MOT/2024/09124",  # Dr. Kiptoo Subaru
        target_status=RenewalStatus.AWAITING_CARRIER,
        period_start=r1_start,
        period_end=r1_start + timedelta(days=365),
        previous_premium=Decimal("118500.00"),
        proposed_premium=Decimal("122000.00"),
        notes="Awaiting Jubilee renewal terms schedule 30 days prior to expiry.",
    )
    if r1:
        renewals.append(r1)

    # 2. State: carrier_received (carrier notice received and attached)
    r2_start = today + timedelta(days=26)
    r2 = upsert_renewal(
        policy_number="OM/MED/2024/09841",  # Dr. Amina Medical
        target_status=RenewalStatus.CARRIER_RECEIVED,
        period_start=r2_start,
        period_end=r2_start + timedelta(days=365),
        previous_premium=Decimal("68000.00"),
        proposed_premium=Decimal("72500.00"),
        carrier_doc="documents/carrier_notices/OM_MED_RENEWAL_2026_09841.pdf",
        notes="Old Mutual renewal schedule uploaded. Premium increased by 6.6% due to age bracket revision.",
    )
    if r2:
        renewals.append(r2)

    # 3. State: client_invited (invitation generated and sent to client)
    r3_start = today + timedelta(days=16)
    r3 = upsert_renewal(
        policy_number="BRT/MOT/2024/004812",  # Grace Kariuki Mercedes C200
        target_status=RenewalStatus.CLIENT_INVITED,
        period_start=r3_start,
        period_end=r3_start + timedelta(days=365),
        previous_premium=Decimal("136000.00"),
        proposed_premium=Decimal("129200.00"),
        notes="Client invitation emailed with advisory calculation based on depreciated vehicle sum insured KES 3.2M.",
    )
    if r3:
        renewals.append(r3)

    # 4. State: changes_requested (client negotiating valuation)
    r4_start = today + timedelta(days=23)
    r4 = upsert_renewal(
        policy_number="ICEA/MOT/2024/00091",  # Amb. Mutiso Land Cruiser 300
        target_status=RenewalStatus.CHANGES_REQUESTED,
        period_start=r4_start,
        period_end=r4_start + timedelta(days=365),
        previous_premium=Decimal("373750.00"),
        proposed_premium=Decimal("350000.00"),
        agreed_premium=Decimal("335000.00"),
        notes="Client requested reduction based on 5% fleet discount and tracking device warranty. Negotiating with ICEA underwriter.",
    )
    if r4:
        renewals.append(r4)

    # 5. State: paid (M-Pesa payment received, pending carrier cover receipt)
    r5_start = today + timedelta(days=4)
    r5 = upsert_renewal(
        policy_number="APA/MOT/2024/007812",  # Kevin Mutua VW Tiguan
        target_status=RenewalStatus.PAID,
        period_start=r5_start,
        period_end=r5_start + timedelta(days=365),
        previous_premium=Decimal("98000.00"),
        proposed_premium=Decimal("95000.00"),
        agreed_premium=Decimal("95000.00"),
        notes="Client cleared renewal premium via M-Pesa. Awaiting APA cover slip and official receipt.",
    )
    if r5:
        renewals.append(r5)

    # 6. State: completed (historical finalized renewal)
    r6_start = today - timedelta(days=120)
    r6 = upsert_renewal(
        policy_number="010/070/1/012473/2017",  # Agnes Mwangi Prado
        target_status=RenewalStatus.COMPLETED,
        period_start=r6_start,
        period_end=today + timedelta(days=245),
        previous_premium=Decimal("152750.00"),
        proposed_premium=Decimal("158000.00"),
        agreed_premium=Decimal("158000.00"),
        notes="Renewal successfully concluded and carrier receipt issued.",
    )
    if r6:
        renewals.append(r6)

    return renewals
