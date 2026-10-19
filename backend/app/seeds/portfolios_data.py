"""
Portfolios Data Seed.
Realistic insurance policies, vehicle assets, risk notes, endorsements, and domestic/medical covers.
Adheres strictly to the invariant: Medical policies NEVER use a Risk Note.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any

from sqlmodel import Session, select

from app import crud
from app.models import (
    Client,
    Insurer,
    Policy,
    PolicyCreate,
    PolicyStatus,
    Product,
    RiskNoteCreate,
    RiskNoteStatus,
    TransactionType,
    Vehicle,
    VehicleCreate,
)
from app.services.policy import generate_risk_note_number, policy_service

logger = logging.getLogger(__name__)


def seed_portfolios_and_assets(
    session: Session,
    _insurers: dict[str, Insurer],
    products: dict[str, Product],
    clients: dict[str, Client],
) -> dict[str, Any]:
    """
    Seed policies, vehicles, risk notes, and endorsements across the client base.
    """
    policies_by_number: dict[str, Policy] = {}

    # Helper to create vehicle record if not exists
    def ensure_vehicle(
        pol: Policy,
        reg_no: str,
        make: str,
        model: str,
        year: int,
        val: Decimal,
        chassis: str = "JTEBU49J10294819",
        engine: str = "1KD-9401284",
    ) -> Vehicle:
        v = session.exec(
            select(Vehicle).where(
                Vehicle.policy_id == pol.id,
                Vehicle.registration_number == reg_no,
            )
        ).first()
        if not v:
            v = crud.create_vehicle(
                session,
                vehicle_in=VehicleCreate(
                    policy_id=pol.id,
                    registration_number=reg_no,
                    make=make,
                    model=model,
                    year_of_manufacture=year,
                    insured_value=val,
                    chassis_number=chassis,
                    engine_number=engine,
                ),
            )
        return v

    # ==========================================
    # 1. Retail Individuals
    # ==========================================

    # Client: Agnes Njoki Mwangi (Preserve existing benchmark policy)
    c_agnes = clients["A001158997L"]
    p_om_motor = products[
        "Old Mutual General Insurance Kenya Ltd.::Motor Private - Comprehensive"
    ]
    pol_agnes = session.exec(
        select(Policy).where(Policy.policy_number == "010/070/1/012473/2017")
    ).first()
    if not pol_agnes:
        start = date(2025, 8, 2)
        end = date(2026, 8, 1)
        cover_snapshot = {
            "vehicle": {
                "registration_number": "KCM 780L",
                "make": "Toyota",
                "year_of_manufacture": 2016,
                "sum_insured": 4700000.0,
            },
            "extensions": {"pvt": True, "excess_protector": True},
            "benefits_and_limits": "Standard Comprehensive Benefits",
            "excesses": "Standard Motor Private Excesses",
            "special_clauses": "Subject to annual valuation",
        }
        pol_agnes = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="010/070/1/012473/2017",
                client_id=c_agnes.id,
                product_id=p_om_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot=cover_snapshot,
            coverage_start=start,
            coverage_end=end,
        )
        # Endorsement
        new_snap = cover_snapshot.copy()
        new_snap["vehicle"]["sum_insured"] = 5000000.0
        policy_service.create_endorsement(
            session=session,
            policy_id=pol_agnes.id,
            updated_cover_snapshot=new_snap,
            change_description="Increased vehicle value to 5.0M following certified valuation",
        )
        ensure_vehicle(
            pol_agnes,
            "KCM 780L",
            "Toyota",
            "Land Cruiser Prado",
            2016,
            Decimal("5000000.00"),
        )
    policies_by_number[pol_agnes.policy_number] = pol_agnes

    # Client: Dr. David Kiprop Kiptoo (Motor + Medical)
    c_kiptoo = clients["A002849120K"]
    p_jub_motor = products[
        "Jubilee General Insurance Ltd.::Motor Private - Supreme Cover"
    ]
    pol_kiptoo_motor = session.exec(
        select(Policy).where(Policy.policy_number == "JUB/POL/MOT/2024/09124")
    ).first()
    if not pol_kiptoo_motor:
        start = date(2025, 11, 15)
        end = date(2026, 11, 14)
        pol_kiptoo_motor = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="JUB/POL/MOT/2024/09124",
                client_id=c_kiptoo.id,
                product_id=p_jub_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDA 410M",
                    "make": "Subaru",
                    "year_of_manufacture": 2018,
                    "sum_insured": 2800000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_kiptoo_motor,
            "KDA 410M",
            "Subaru",
            "Outback 2.5i",
            2018,
            Decimal("2800000.00"),
        )
    policies_by_number[pol_kiptoo_motor.policy_number] = pol_kiptoo_motor

    # Dr. Kiptoo Medical Policy (NO Risk Note - Medical invariant!)
    p_jub_med = products[
        "Jubilee General Insurance Ltd.::J-Care Individual & Family Medical"
    ]
    pol_kiptoo_med = session.exec(
        select(Policy).where(Policy.policy_number == "JUB/MED/FAM/2023/11029")
    ).first()
    if not pol_kiptoo_med:
        start = date(2025, 12, 1)
        end = date(2026, 11, 30)
        pol_kiptoo_med = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="JUB/MED/FAM/2023/11029",
                client_id=c_kiptoo.id,
                product_id=p_jub_med.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
    policies_by_number[pol_kiptoo_med.policy_number] = pol_kiptoo_med

    # Client: Grace Wanjiku Kariuki (Motor + Domestic Package)
    c_grace = clients["A003928174M"]
    p_brit_motor = products[
        "Britam General Insurance (Kenya) Ltd.::Motor Private - Comprehensive Elite"
    ]
    pol_grace_motor = session.exec(
        select(Policy).where(Policy.policy_number == "BRT/MOT/2024/004812")
    ).first()
    if not pol_grace_motor:
        start = date(2025, 9, 10)
        end = date(2026, 9, 9)
        pol_grace_motor = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="BRT/MOT/2024/004812",
                client_id=c_grace.id,
                product_id=p_brit_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDB 892P",
                    "make": "Mercedes-Benz",
                    "year_of_manufacture": 2017,
                    "sum_insured": 3400000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_grace_motor,
            "KDB 892P",
            "Mercedes-Benz",
            "C200 Avantgarde",
            2017,
            Decimal("3400000.00"),
        )
    policies_by_number[pol_grace_motor.policy_number] = pol_grace_motor

    p_brit_dom = products[
        "Britam General Insurance (Kenya) Ltd.::Super Homeowner Package"
    ]
    pol_grace_dom = session.exec(
        select(Policy).where(Policy.policy_number == "BRT/DOM/2024/001924")
    ).first()
    if not pol_grace_dom:
        start = date(2025, 9, 10)
        end = date(2026, 9, 9)
        pol_grace_dom = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="BRT/DOM/2024/001924",
                client_id=c_grace.id,
                product_id=p_brit_dom.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
        # Domestic policy gets a Risk Note
        net_prem = Decimal("48500.00")
        t_levy = (net_prem * Decimal("0.002")).quantize(Decimal("0.01"))
        p_pcf = (net_prem * Decimal("0.0025")).quantize(Decimal("0.01"))
        stamp = Decimal("40.00")
        comm = (net_prem * Decimal("0.20")).quantize(Decimal("0.01"))
        total = net_prem + t_levy + p_pcf + stamp

        rn_in = RiskNoteCreate(
            policy_id=pol_grace_dom.id,
            risk_note_number=generate_risk_note_number(),
            transaction_type=TransactionType.NEW_BUSINESS,
            status=RiskNoteStatus.ISSUED,
            effective_date=start,
            coverage_start=start,
            coverage_end=end,
            net_premium=net_prem,
            commission_amount=comm,
            total_amount=total,
            cover_snapshot={
                "buildings_sum_insured": "18000000",
                "contents_sum_insured": "3500000",
                "all_risks_valuables": "650000",
                "domestic_servants_count": 2,
            },
        )
        crud.create_risk_note(session=session, risk_note_in=rn_in)
    policies_by_number[pol_grace_dom.policy_number] = pol_grace_dom

    # Client: Brian Otieno Onyango (Motor)
    c_brian = clients["A004819231P"]
    p_cic_motor = products["CIC General Insurance Ltd.::Motor Private - Prestige Cover"]
    pol_brian = session.exec(
        select(Policy).where(Policy.policy_number == "CIC/MOT/PVT/2025/08412")
    ).first()
    if not pol_brian:
        start = date(2026, 1, 15)
        end = date(2027, 1, 14)
        pol_brian = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="CIC/MOT/PVT/2025/08412",
                client_id=c_brian.id,
                product_id=p_cic_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDC 520Q",
                    "make": "Mazda",
                    "year_of_manufacture": 2017,
                    "sum_insured": 1750000.0,
                },
                "extensions": {"excess_protector": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_brian,
            "KDC 520Q",
            "Mazda",
            "Demio 1.3 Skyactiv",
            2017,
            Decimal("1750000.00"),
        )
    policies_by_number[pol_brian.policy_number] = pol_brian

    # Client: Dr. Amina Fatuma Hassan (Motor + Family Medical)
    c_amina = clients["A005928104T"]
    p_icea_motor = products[
        "ICEA LION General Insurance Ltd.::Motor Private - Executive Cover"
    ]
    pol_amina_motor = session.exec(
        select(Policy).where(Policy.policy_number == "ICEA/MOT/2025/11094")
    ).first()
    if not pol_amina_motor:
        start = date(2026, 2, 1)
        end = date(2027, 1, 31)
        pol_amina_motor = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="ICEA/MOT/2025/11094",
                client_id=c_amina.id,
                product_id=p_icea_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDD 109K",
                    "make": "Audi",
                    "year_of_manufacture": 2019,
                    "sum_insured": 3800000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_amina_motor,
            "KDD 109K",
            "Audi",
            "Q5 2.0 TFSI Quattro",
            2019,
            Decimal("3800000.00"),
        )
    policies_by_number[pol_amina_motor.policy_number] = pol_amina_motor

    p_om_med = products[
        "Old Mutual General Insurance Kenya Ltd.::Afya Imara Family Health"
    ]
    pol_amina_med = session.exec(
        select(Policy).where(Policy.policy_number == "OM/MED/2024/09841")
    ).first()
    if not pol_amina_med:
        start = date(2025, 11, 1)
        end = date(2026, 10, 31)
        pol_amina_med = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="OM/MED/2024/09841",
                client_id=c_amina.id,
                product_id=p_om_med.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
    policies_by_number[pol_amina_med.policy_number] = pol_amina_med

    # Client: Kevin Mutua Musyoka (Motor)
    c_kevin = clients["A006192847B"]
    pol_kevin_motor = session.exec(
        select(Policy).where(Policy.policy_number == "APA/MOT/2024/007812")
    ).first()
    p_apa_motor = products["APA Insurance Ltd.::Motor Private - Drive Sure"]
    if not pol_kevin_motor:
        start = date(2025, 10, 20)
        end = date(2026, 10, 19)
        pol_kevin_motor = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="APA/MOT/2024/007812",
                client_id=c_kevin.id,
                product_id=p_apa_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDE 770B",
                    "make": "Volkswagen",
                    "year_of_manufacture": 2018,
                    "sum_insured": 2600000.0,
                },
                "extensions": {"excess_protector": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_kevin_motor,
            "KDE 770B",
            "Volkswagen",
            "Tiguan 2.0 TSI",
            2018,
            Decimal("2600000.00"),
        )
    policies_by_number[pol_kevin_motor.policy_number] = pol_kevin_motor

    # Client: Faith Chebet Koech (Motor)
    c_faith = clients["A007382910D"]
    pol_faith_motor = session.exec(
        select(Policy).where(Policy.policy_number == "JUB/MOT/2025/01928")
    ).first()
    if not pol_faith_motor:
        start = date(2026, 3, 1)
        end = date(2027, 2, 28)
        pol_faith_motor = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="JUB/MOT/2025/01928",
                client_id=c_faith.id,
                product_id=p_jub_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDF 230N",
                    "make": "Mazda",
                    "year_of_manufacture": 2018,
                    "sum_insured": 2900000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_faith_motor,
            "KDF 230N",
            "Mazda",
            "CX-5 2.2D",
            2018,
            Decimal("2900000.00"),
        )
    policies_by_number[pol_faith_motor.policy_number] = pol_faith_motor

    # Client: Samuel Ndung'u Githinji (Motor + Domestic)
    c_sam = clients["A008192384G"]
    pol_sam_motor = session.exec(
        select(Policy).where(Policy.policy_number == "OM/MOT/2025/04819")
    ).first()
    if not pol_sam_motor:
        start = date(2025, 11, 28)
        end = date(2026, 11, 27)
        pol_sam_motor = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="OM/MOT/2025/04819",
                client_id=c_sam.id,
                product_id=p_om_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDA 812Y",
                    "make": "Toyota",
                    "year_of_manufacture": 2019,
                    "sum_insured": 3500000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_sam_motor,
            "KDA 812Y",
            "Toyota",
            "Fortuner 2.8 GD-6",
            2019,
            Decimal("3500000.00"),
        )
    policies_by_number[pol_sam_motor.policy_number] = pol_sam_motor

    # Client: Sarah Akinyi Ochieng (Medical)
    c_sarah = clients["A009482710Q"]
    p_brit_med = products[
        "Britam General Insurance (Kenya) Ltd.::Milele Health Family Plan"
    ]
    pol_sarah_med = session.exec(
        select(Policy).where(Policy.policy_number == "BRT/MED/2025/00189")
    ).first()
    if not pol_sarah_med:
        start = date(2026, 1, 1)
        end = date(2026, 12, 31)
        pol_sarah_med = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="BRT/MED/2025/00189",
                client_id=c_sarah.id,
                product_id=p_brit_med.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
    policies_by_number[pol_sarah_med.policy_number] = pol_sarah_med

    # ==========================================
    # 2. High-Net-Worth Households
    # ==========================================

    # Client: Ambassador Michael K. Mutiso (3 Vehicles + Luxury Domestic + Executive Medical)
    c_mutiso = clients["A016892014Y"]
    pol_mutiso_v1 = session.exec(
        select(Policy).where(Policy.policy_number == "ICEA/MOT/2024/00091")
    ).first()
    if not pol_mutiso_v1:
        start = date(2025, 10, 1)
        end = date(2026, 9, 30)
        pol_mutiso_v1 = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="ICEA/MOT/2024/00091",
                client_id=c_mutiso.id,
                product_id=p_icea_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDF 001M",
                    "make": "Toyota",
                    "year_of_manufacture": 2022,
                    "sum_insured": 11500000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_mutiso_v1,
            "KDF 001M",
            "Toyota",
            "Land Cruiser 300 ZX",
            2022,
            Decimal("11500000.00"),
        )
    policies_by_number[pol_mutiso_v1.policy_number] = pol_mutiso_v1

    pol_mutiso_v2 = session.exec(
        select(Policy).where(Policy.policy_number == "ICEA/MOT/2024/00092")
    ).first()
    if not pol_mutiso_v2:
        start = date(2025, 10, 1)
        end = date(2026, 9, 30)
        pol_mutiso_v2 = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="ICEA/MOT/2024/00092",
                client_id=c_mutiso.id,
                product_id=p_icea_motor.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDE 888Q",
                    "make": "Mercedes-Benz",
                    "year_of_manufacture": 2021,
                    "sum_insured": 6500000.0,
                },
                "extensions": {"excess_protector": True, "pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_mutiso_v2,
            "KDE 888Q",
            "Mercedes-Benz",
            "E300 AMG Line",
            2021,
            Decimal("6500000.00"),
        )
    policies_by_number[pol_mutiso_v2.policy_number] = pol_mutiso_v2

    # Mutiso Karen Estate Domestic Package
    p_jub_dom = products[
        "Jubilee General Insurance Ltd.::Cover All - Homeowners & Tenants"
    ]
    pol_mutiso_dom = session.exec(
        select(Policy).where(Policy.policy_number == "JUB/DOM/2024/00812")
    ).first()
    if not pol_mutiso_dom:
        start = date(2025, 10, 1)
        end = date(2026, 9, 30)
        pol_mutiso_dom = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="JUB/DOM/2024/00812",
                client_id=c_mutiso.id,
                product_id=p_jub_dom.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
        net_prem = Decimal("95000.00")
        t_levy = (net_prem * Decimal("0.002")).quantize(Decimal("0.01"))
        p_pcf = (net_prem * Decimal("0.0025")).quantize(Decimal("0.01"))
        stamp = Decimal("40.00")
        comm = (net_prem * Decimal("0.20")).quantize(Decimal("0.01"))
        total = net_prem + t_levy + p_pcf + stamp

        rn_in = RiskNoteCreate(
            policy_id=pol_mutiso_dom.id,
            risk_note_number=generate_risk_note_number(),
            transaction_type=TransactionType.NEW_BUSINESS,
            status=RiskNoteStatus.ISSUED,
            effective_date=start,
            coverage_start=start,
            coverage_end=end,
            net_premium=net_prem,
            commission_amount=comm,
            total_amount=total,
            cover_snapshot={
                "buildings_sum_insured": "45000000",
                "contents_sum_insured": "12000000",
                "all_risks_valuables": "3500000",
                "domestic_servants_count": 4,
            },
        )
        crud.create_risk_note(session=session, risk_note_in=rn_in)
    policies_by_number[pol_mutiso_dom.policy_number] = pol_mutiso_dom

    # ==========================================
    # 3. Commercial Fleets & Corporate SMEs
    # ==========================================

    # Client: Rift Valley Hauliers Ltd. (Commercial Fleet of 3 Trucks + WIBA)
    c_rv = clients["P051289412M"]
    p_om_comm = products[
        "Old Mutual General Insurance Kenya Ltd.::Commercial Own Goods Comprehensive"
    ]
    pol_rv_truck1 = session.exec(
        select(Policy).where(Policy.policy_number == "OM/COMM/2024/01192")
    ).first()
    if not pol_rv_truck1:
        start = date(2025, 11, 10)
        end = date(2026, 11, 9)
        pol_rv_truck1 = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="OM/COMM/2024/01192",
                client_id=c_rv.id,
                product_id=p_om_comm.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDA 920X",
                    "make": "Isuzu",
                    "year_of_manufacture": 2020,
                    "sum_insured": 5200000.0,
                },
                "extensions": {"pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_rv_truck1,
            "KDA 920X",
            "Isuzu",
            "FRR 90 Tipper",
            2020,
            Decimal("5200000.00"),
        )
    policies_by_number[pol_rv_truck1.policy_number] = pol_rv_truck1

    pol_rv_truck2 = session.exec(
        select(Policy).where(Policy.policy_number == "OM/COMM/2024/01193")
    ).first()
    if not pol_rv_truck2:
        start = date(2025, 11, 10)
        end = date(2026, 11, 9)
        pol_rv_truck2 = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="OM/COMM/2024/01193",
                client_id=c_rv.id,
                product_id=p_om_comm.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDB 114W",
                    "make": "Isuzu",
                    "year_of_manufacture": 2021,
                    "sum_insured": 5800000.0,
                },
                "extensions": {"pvt": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_rv_truck2,
            "KDB 114W",
            "Isuzu",
            "FVR 34 Heavy Truck",
            2021,
            Decimal("5800000.00"),
        )
    policies_by_number[pol_rv_truck2.policy_number] = pol_rv_truck2

    # RV Hauliers WIBA Policy
    p_jub_wiba = products["Jubilee General Insurance Ltd.::WIBA / Employers Liability"]
    pol_rv_wiba = session.exec(
        select(Policy).where(Policy.policy_number == "JUB/WIBA/2024/00341")
    ).first()
    if not pol_rv_wiba:
        start = date(2025, 11, 10)
        end = date(2026, 11, 9)
        pol_rv_wiba = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="JUB/WIBA/2024/00341",
                client_id=c_rv.id,
                product_id=p_jub_wiba.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
        net_prem = Decimal("145000.00")
        t_levy = (net_prem * Decimal("0.002")).quantize(Decimal("0.01"))
        p_pcf = (net_prem * Decimal("0.0025")).quantize(Decimal("0.01"))
        stamp = Decimal("40.00")
        comm = (net_prem * Decimal("0.20")).quantize(Decimal("0.01"))
        total = net_prem + t_levy + p_pcf + stamp

        rn_in = RiskNoteCreate(
            policy_id=pol_rv_wiba.id,
            risk_note_number=generate_risk_note_number(),
            transaction_type=TransactionType.NEW_BUSINESS,
            status=RiskNoteStatus.ISSUED,
            effective_date=start,
            coverage_start=start,
            coverage_end=end,
            net_premium=net_prem,
            commission_amount=comm,
            total_amount=total,
            cover_snapshot={
                "clerical_payroll": "3600000",
                "artisan_payroll": "8400000",
                "driver_count": 18,
            },
        )
        crud.create_risk_note(session=session, risk_note_in=rn_in)
    policies_by_number[pol_rv_wiba.policy_number] = pol_rv_wiba

    # Client: Savanna Safari Tours & Travel Ltd. (Tour Cruisers)
    c_savanna = clients["P054819203N"]
    pol_sav_van1 = session.exec(
        select(Policy).where(Policy.policy_number == "CIC/COMM/2024/00912")
    ).first()
    if not pol_sav_van1:
        start = date(2025, 12, 15)
        end = date(2026, 12, 14)
        pol_sav_van1 = policy_service.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="CIC/COMM/2024/00912",
                client_id=c_savanna.id,
                product_id=p_om_comm.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
            cover_snapshot={
                "vehicle": {
                    "registration_number": "KDC 301T",
                    "make": "Toyota",
                    "year_of_manufacture": 2019,
                    "sum_insured": 4200000.0,
                },
                "extensions": {"pvt": True, "passenger_liability": True},
            },
            coverage_start=start,
            coverage_end=end,
        )
        ensure_vehicle(
            pol_sav_van1,
            "KDC 301T",
            "Toyota",
            "Land Cruiser Safari Van",
            2019,
            Decimal("4200000.00"),
        )
    policies_by_number[pol_sav_van1.policy_number] = pol_sav_van1

    # Client: Blue Nile Trading (Commercial Fire & Perils)
    c_bluenile = clients["P053491028L"]
    p_cic_fire = products["CIC General Insurance Ltd.::Business Combined & Fire"]
    pol_bluenile_fire = session.exec(
        select(Policy).where(Policy.policy_number == "CIC/FIRE/2025/00234")
    ).first()
    if not pol_bluenile_fire:
        start = date(2026, 2, 1)
        end = date(2027, 1, 31)
        pol_bluenile_fire = crud.create_policy(
            session=session,
            policy_in=PolicyCreate(
                policy_number="CIC/FIRE/2025/00234",
                client_id=c_bluenile.id,
                product_id=p_cic_fire.id,
                status=PolicyStatus.ACTIVE,
                inception_date=start,
            ),
        )
        net_prem = Decimal("185000.00")
        t_levy = (net_prem * Decimal("0.002")).quantize(Decimal("0.01"))
        p_pcf = (net_prem * Decimal("0.0025")).quantize(Decimal("0.01"))
        stamp = Decimal("40.00")
        comm = (net_prem * Decimal("0.20")).quantize(Decimal("0.01"))
        total = net_prem + t_levy + p_pcf + stamp

        rn_in = RiskNoteCreate(
            policy_id=pol_bluenile_fire.id,
            risk_note_number=generate_risk_note_number(),
            transaction_type=TransactionType.NEW_BUSINESS,
            status=RiskNoteStatus.ISSUED,
            effective_date=start,
            coverage_start=start,
            coverage_end=end,
            net_premium=net_prem,
            commission_amount=comm,
            total_amount=total,
            cover_snapshot={
                "buildings_sum_insured": "35000000",
                "plant_machinery_sum_insured": "15000000",
                "stock_sum_insured": "40000000",
            },
        )
        crud.create_risk_note(session=session, risk_note_in=rn_in)
    policies_by_number[pol_bluenile_fire.policy_number] = pol_bluenile_fire

    return policies_by_number
