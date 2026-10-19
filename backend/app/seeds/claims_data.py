"""
Claims and Claim Events Seed Data.
Realistic Kenyan motor and property claims demonstrating claims advocacy,
repair authorization, adjusters, and settled amounts.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from app import crud
from app.models import (
    Claim,
    ClaimCreate,
    ClaimEventCreate,
    ClaimEventType,
    ClaimStatus,
    Client,
    Policy,
)

logger = logging.getLogger(__name__)


def seed_claims(
    session: Session,
    clients: dict[str, Client],
    policies: dict[str, Policy],
) -> dict[str, Claim]:
    """
    Seed realistic claims with lifecycle timeline events.
    """
    today = date.today()
    claims_by_number: dict[str, Claim] = {}

    def upsert_claim(
        claim_number: str,
        policy_number: str,
        client_pin: str,
        reg_number: str | None,
        date_of_loss: date,
        date_reported: date,
        description: str,
        loss_type: str,
        status: ClaimStatus,
        reserve_amount: Decimal,
        settled_amount: Decimal | None,
        adjuster: str | None,
        events: list[tuple[ClaimEventType, str]],
    ) -> Claim | None:
        policy = policies.get(policy_number)
        client = clients.get(client_pin)
        if not policy or not client:
            logger.warning(
                f"Policy {policy_number} or Client {client_pin} not found for claim seeding"
            )
            return None

        # Resolve vehicle if applicable
        vehicle_id = None
        if reg_number:
            for v in policy.vehicles:
                if v.registration_number == reg_number:
                    vehicle_id = v.id
                    break

        db_claim = session.exec(
            select(Claim).where(Claim.claim_number == claim_number)
        ).first()

        if not db_claim:
            db_claim = crud.create_claim(
                session=session,
                claim_in=ClaimCreate(
                    claim_number=claim_number,
                    policy_id=policy.id,
                    client_id=client.id,
                    vehicle_id=vehicle_id,
                    date_of_loss=date_of_loss,
                    date_reported=date_reported,
                    description=description,
                    loss_type=loss_type,
                    loss_description=description,
                    status=status,
                    reserve_amount=reserve_amount,
                    settled_amount=settled_amount,
                    assigned_adjuster=adjuster,
                ),
            )
            # Add timeline events
            for ev_type, ev_desc in events:
                crud.create_claim_event(
                    session=session,
                    claim_event_in=ClaimEventCreate(
                        claim_id=db_claim.id,
                        event_type=ev_type,
                        description=ev_desc,
                    ),
                )
            logger.info(f"Seeded claim {claim_number} ({status.value})")
        else:
            db_claim.status = status
            db_claim.reserve_amount = reserve_amount
            db_claim.settled_amount = settled_amount
            session.add(db_claim)
            session.commit()

        return db_claim

    # 1. Claim: Windscreen Replacement on Agnes Mwangi Toyota Prado
    # Settled claim with zero excess under policy windscreen limit
    c1 = upsert_claim(
        claim_number="CLM/OM/2026/00142",
        policy_number="010/070/1/012473/2017",
        client_pin="A001158997L",
        reg_number="KCM 780L",
        date_of_loss=today - timedelta(days=60),
        date_reported=today - timedelta(days=58),
        description="Windscreen shattered by flying stone along Nairobi-Nakuru highway near Gilgil.",
        loss_type="Windscreen",
        status=ClaimStatus.SETTLED,
        reserve_amount=Decimal("35000.00"),
        settled_amount=Decimal("35000.00"),
        adjuster="AutoGlass Kenya Ltd.",
        events=[
            (
                ClaimEventType.NOTIFICATION,
                "Claim intimated by client with photographs of shattered front windscreen and driver statement.",
            ),
            (
                ClaimEventType.ASSESSMENT,
                "Inspection completed at AutoGlass Westlands branch. Certified OEM laminated replacement recommended.",
            ),
            (
                ClaimEventType.CORRESPONDENCE,
                "Old Mutual claims advocacy team issued repair authorization voucher under free windscreen limit (KES 50,000).",
            ),
            (
                ClaimEventType.PAYMENT,
                "Underwriter remitted direct settlement of KES 35,000 to AutoGlass Kenya. Discharge voucher signed and closed.",
            ),
        ],
    )
    if c1:
        claims_by_number[c1.claim_number] = c1

    # 2. Claim: Minor Own-Damage Collision on Apex Hauliers Isuzu Truck
    # Repairs authorized at authorized dealership
    c2 = upsert_claim(
        claim_number="CLM/OM/2026/00219",
        policy_number="OM/COMM/2024/01192",
        client_pin="P051289412M",
        reg_number="KDA 920X",
        date_of_loss=today - timedelta(days=20),
        date_reported=today - timedelta(days=19),
        description="Rear-end impact at Mombasa Port loading gate causing bumper deformation and left tail lamp damage.",
        loss_type="Own Damage Collision",
        status=ClaimStatus.REPAIRS_AUTHORIZED,
        reserve_amount=Decimal("185000.00"),
        settled_amount=None,
        adjuster="Inter-Ocean Loss Assessors Ltd.",
        events=[
            (
                ClaimEventType.NOTIFICATION,
                "Fleet supervisor reported collision at Mombasa container terminal with police abstract OB 42/18/10/2026.",
            ),
            (
                ClaimEventType.ASSESSMENT,
                "Independent assessor inspected vehicle at Mombasa yard; recommended OEM bumper replacement and chassis alignment check.",
            ),
            (
                ClaimEventType.CORRESPONDENCE,
                "Old Mutual commercial lines claims adjuster authorized repairs at Associated Vehicle Assemblers (AVA) Mombasa.",
            ),
        ],
    )
    if c2:
        claims_by_number[c2.claim_number] = c2

    # 3. Claim: Third-Party Property Damage on Grace Kariuki Mercedes C200
    # Demonstrates claims advocacy summary during client renewal invitation
    c3 = upsert_claim(
        claim_number="CLM/BRT/2026/00388",
        policy_number="BRT/MOT/2024/004812",
        client_pin="A003928174M",
        reg_number="KDB 892P",
        date_of_loss=today - timedelta(days=12),
        date_reported=today - timedelta(days=10),
        description="Minor scrape against parking barrier and third party vehicle rear bumper at Sarit Centre parking.",
        loss_type="Third Party Property Damage",
        status=ClaimStatus.ADJUSTER_APPOINTED,
        reserve_amount=Decimal("75000.00"),
        settled_amount=None,
        adjuster="Prism Loss Adjusters Ltd.",
        events=[
            (
                ClaimEventType.NOTIFICATION,
                "Client notified agency of parking scratch; submitted third party driver contact details and police abstract.",
            ),
            (
                ClaimEventType.ASSESSMENT,
                "Adjuster appointed to inspect third party vehicle damage and verify garage estimate.",
            ),
        ],
    )
    if c3:
        claims_by_number[c3.claim_number] = c3

    return claims_by_number
