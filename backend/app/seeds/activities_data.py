"""
Activity Timeline Seed Data.
Operational agent notes, client communication logs, and renewal negotiations.
Strict adherence to zero emoji and professional agency terminology.
"""

import logging

from sqlmodel import Session, select

from app import crud
from app.models import Activity, ActivityCreate, ActivityType, Client, Policy, Renewal

logger = logging.getLogger(__name__)


def seed_activities(
    session: Session,
    clients: dict[str, Client],
    policies: dict[str, Policy],
    renewals: list[Renewal],
) -> list[Activity]:
    """
    Seed operational timeline entries attached to clients, policies, and renewals.
    """
    activities: list[Activity] = []

    # Map renewals by policy_id
    renewals_by_policy: dict[str, Renewal] = {str(r.policy_id): r for r in renewals}

    def add_activity(
        client: Client,
        policy: Policy | None,
        act_type: ActivityType,
        body: str,
        renewal: Renewal | None = None,
    ) -> Activity:
        # Check if identical body already logged for client
        existing = session.exec(
            select(Activity).where(
                Activity.client_id == client.id,
                Activity.body == body,
            )
        ).first()
        if existing:
            return existing

        act = crud.create_activity(
            session=session,
            activity_in=ActivityCreate(
                client_id=client.id,
                policy_id=policy.id if policy else None,
                renewal_id=renewal.id if renewal else None,
                activity_type=act_type,
                body=body,
            ),
        )
        logger.info(f"Logged activity ({act_type.value}) for client {client.name}")
        activities.append(act)
        return act

    # 1. Agnes Njoki Mwangi
    c_agnes = clients.get("A001158997L")
    p_agnes = policies.get("010/070/1/012473/2017")
    if c_agnes and p_agnes:
        add_activity(
            client=c_agnes,
            policy=p_agnes,
            act_type=ActivityType.CALL,
            body="Telephone call with client regarding annual motor valuation for KCM 780L. Client confirmed valuation report from Automobile Association of Kenya showing KES 5,000,000 value.",
        )
        add_activity(
            client=c_agnes,
            policy=p_agnes,
            act_type=ActivityType.NOTE,
            body="Endorsement processed to reflect revised sum insured KES 5,000,000. Underwriter confirmed no additional premium required for remainder of period.",
        )

    # 2. Dr. David Kiptoo
    c_kiptoo = clients.get("A002849120K")
    p_kiptoo_mot = policies.get("JUB/POL/MOT/2024/09124")
    r_kiptoo = renewals_by_policy.get(str(p_kiptoo_mot.id)) if p_kiptoo_mot else None
    if c_kiptoo and p_kiptoo_mot:
        add_activity(
            client=c_kiptoo,
            policy=p_kiptoo_mot,
            act_type=ActivityType.EMAIL,
            body="Sent renewal notification request to Jubilee underwriter for Subaru Outback KDA 410M. Awaiting revised rates.",
            renewal=r_kiptoo,
        )

    # 3. Ambassador Michael Mutiso
    c_mutiso = clients.get("A016892014Y")
    p_mutiso_v1 = policies.get("ICEA/MOT/2024/00091")
    r_mutiso = renewals_by_policy.get(str(p_mutiso_v1.id)) if p_mutiso_v1 else None
    if c_mutiso and p_mutiso_v1:
        add_activity(
            client=c_mutiso,
            policy=p_mutiso_v1,
            act_type=ActivityType.MEETING,
            body="Meeting with client at Karen office. Client requested consolidated fleet renewal terms for both executive vehicles and domestic property.",
            renewal=r_mutiso,
        )
        add_activity(
            client=c_mutiso,
            policy=p_mutiso_v1,
            act_type=ActivityType.NOTE,
            body="Negotiating with ICEA LION senior underwriter to secure 5% multi-vehicle portfolio discount and waive tracking device deductible penalty.",
            renewal=r_mutiso,
        )

    # 4. Rift Valley Hauliers Ltd.
    c_rv = clients.get("P051289412M")
    p_rv_t1 = policies.get("OM/COMM/2024/01192")
    if c_rv and p_rv_t1:
        add_activity(
            client=c_rv,
            policy=p_rv_t1,
            act_type=ActivityType.NOTE,
            body="Stanbic Bank IPF facility documentation received and verified. Tripartite financing agreement signed by agency finance manager.",
        )
        add_activity(
            client=c_rv,
            policy=p_rv_t1,
            act_type=ActivityType.CALL,
            body="Liaised with fleet manager Lydia Chelagat. Confirmed speed governor compliance certificates and NTSA inspection stickers submitted for all 3 commercial trucks.",
        )

    return activities
