import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    BenefitCalculationType,
    BusinessEvent,
    Insurer,
    Policy,
    PolicyStatus,
    PricingMethod,
    Renewal,
    RenewalStatus,
)


def test_rate_table_and_calculations_lifecycle(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Create Insurer
    insurer = Insurer(name="Heritage Insurance Co")
    db.add(insurer)
    db.commit()
    db.refresh(insurer)

    # 2. Create RateTableVersion for Motor Private Comprehensive
    rate_table_data = {
        "insurer_id": str(insurer.id),
        "class_of_insurance": "Motor Private",
        "pricing_method": PricingMethod.BRACKETED_PERCENTAGE.value,
        "currency": "KES",
        "version_number": 1,
        "source_reference": "Heritage Motor Tariff 2026",
    }
    r = client.post(
        f"{settings.API_V1_STR}/rate-tables/",
        headers=superuser_token_headers,
        json=rate_table_data,
    )
    assert r.status_code == 201
    rate_table = r.json()
    rate_table_id = rate_table["id"]

    # 3. Add Rate Brackets
    # Bracket 1: 0 to 1,500,000 at 5.0% min 60,000
    b1_data = {
        "rate_table_version_id": rate_table_id,
        "min_value": 0.00,
        "max_value": 1500000.00,
        "rate_percent": 0.0500,
        "minimum_premium": 60000.00,
        "display_label": "KES 0 - 1.5M (5.0%)",
    }
    r_b1 = client.post(
        f"{settings.API_V1_STR}/rate-tables/{rate_table_id}/brackets",
        headers=superuser_token_headers,
        json=b1_data,
    )
    assert r_b1.status_code == 201

    # Bracket 2: 1,500,001 to 3,000,000 at 4.0% min 75,000
    b2_data = {
        "rate_table_version_id": rate_table_id,
        "min_value": 1500001.00,
        "max_value": 3000000.00,
        "rate_percent": 0.0400,
        "minimum_premium": 75000.00,
        "display_label": "KES 1.5M - 3M (4.0%)",
    }
    client.post(
        f"{settings.API_V1_STR}/rate-tables/{rate_table_id}/brackets",
        headers=superuser_token_headers,
        json=b2_data,
    )

    # 4. Add Rate Benefits (PVT, Excess Protector, Rescue)
    pvt_benefit = {
        "rate_table_version_id": rate_table_id,
        "code": "PVT",
        "name": "Political Violence & Terrorism",
        "calculation_type": BenefitCalculationType.PERCENTAGE.value,
        "rate_value": 0.0025,
        "is_mandatory": False,
        "is_complimentary": False,
    }
    client.post(
        f"{settings.API_V1_STR}/rate-tables/{rate_table_id}/benefits",
        headers=superuser_token_headers,
        json=pvt_benefit,
    )

    rescue_benefit = {
        "rate_table_version_id": rate_table_id,
        "code": "RESCUE",
        "name": "AA Roadside Rescue",
        "calculation_type": BenefitCalculationType.FIXED_AMOUNT.value,
        "rate_value": 5000.00,
        "is_mandatory": False,
        "is_complimentary": True,
        "complimentary_threshold": 2000000.00,  # Free above 2M
    }
    client.post(
        f"{settings.API_V1_STR}/rate-tables/{rate_table_id}/benefits",
        headers=superuser_token_headers,
        json=rescue_benefit,
    )

    # 5. Quote Preview (Sum Insured: 1,000,000)
    # Tier: 5% of 1M = 50,000 -> Min applied: 60,000
    # PVT: 1M * 0.0025 = 2,500
    # Net Premium = 62,500
    # Training Levy (0.20%) = 125.00
    # PHCF (0.25%) = 156.25
    # Stamp Duty = 40.00
    # Exact Total = 62,821.25 -> Rounded whole KES = 62,821.00
    quote_resp = client.post(
        f"{settings.API_V1_STR}/calculations/quote",
        headers=superuser_token_headers,
        json={
            "rate_table_id": rate_table_id,
            "inputs": {
                "sum_insured": 1000000.00,
                "selected_benefits": ["PVT"],
            },
            "business_event": BusinessEvent.NEW_BUSINESS.value,
        },
    )
    assert quote_resp.status_code == 200
    q = quote_resp.json()
    assert Decimal(str(q["net_premium"])) == Decimal("62500.00")
    assert Decimal(str(q["calculation_detail"]["taxes"]["stamp_duty"])) == Decimal(
        "40.00"
    )
    assert Decimal(str(q["calculation_detail"]["taxes"]["training_levy"])) == Decimal(
        "125.00"
    )
    assert Decimal(str(q["calculation_detail"]["taxes"]["phcf"])) == Decimal("156.25")
    assert Decimal(str(q["total_premium"])) == Decimal("62821.25")

    # 6. Test Stamp Duty Exemption on Medical Rate Table
    med_rate_table_data = {
        "insurer_id": str(insurer.id),
        "class_of_insurance": "Healthcare Individual",
        "pricing_method": PricingMethod.PACKAGED.value,
        "currency": "KES",
        "version_number": 1,
        "source_reference": "Heritage Afya 2026",
    }
    r_med = client.post(
        f"{settings.API_V1_STR}/rate-tables/",
        headers=superuser_token_headers,
        json=med_rate_table_data,
    )
    med_rate_table_id = r_med.json()["id"]

    # Add medical tier M+1
    client.post(
        f"{settings.API_V1_STR}/rate-tables/{med_rate_table_id}/medical-tiers",
        headers=superuser_token_headers,
        json={
            "rate_table_version_id": med_rate_table_id,
            "tier_code": "M+1",
            "premium": 80000.00,
            "benefit_limits": {"inpatient": 2000000, "outpatient": 100000},
        },
    )

    med_quote_resp = client.post(
        f"{settings.API_V1_STR}/calculations/quote",
        headers=superuser_token_headers,
        json={
            "rate_table_id": med_rate_table_id,
            "inputs": {"tier_code": "M+1"},
            "business_event": BusinessEvent.NEW_BUSINESS.value,
        },
    )
    assert med_quote_resp.status_code == 200
    mq = med_quote_resp.json()
    # Medical is strictly exempt from Stamp Duty
    assert Decimal(str(mq["calculation_detail"]["taxes"]["stamp_duty"])) == Decimal(
        "0.00"
    )
    assert mq["calculation_detail"]["taxes"]["stamp_duty_exempt"] is True


def test_persist_and_select_premium_calculation(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    from datetime import date

    from app.models import Client as ClientModel

    # Create Client, Insurer, Policy, Renewal
    insurer = Insurer(name="Britam General")
    db.add(insurer)
    db.commit()
    db.refresh(insurer)

    client_record = ClientModel(
        name="Acme Corp",
        email="info@acme.co.ke",
        phone="+254711000111",
        kra_pin="P051234567A",
    )
    db.add(client_record)
    db.commit()
    db.refresh(client_record)

    policy = Policy(
        policy_number="POL-ADV-001",
        client_id=client_record.id,
        status=PolicyStatus.ACTIVE,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    renewal = Renewal(
        policy_id=policy.id,
        renewal_period_start=date(2026, 11, 1),
        renewal_period_end=date(2027, 10, 31),
        status=RenewalStatus.CARRIER_RECEIVED,
        previous_premium=Decimal("50000.00"),
    )
    db.add(renewal)
    db.commit()
    db.refresh(renewal)

    # Rate table
    r = client.post(
        f"{settings.API_V1_STR}/rate-tables/",
        headers=superuser_token_headers,
        json={
            "insurer_id": str(insurer.id),
            "class_of_insurance": "Motor Private",
            "pricing_method": PricingMethod.FIXED_TIER.value,
            "currency": "KES",
            "version_number": 1,
            "source_reference": "Britam TPO Tariff 2026",
        },
    )
    rt_id = r.json()["id"]

    # Persist calculation
    calc_resp = client.post(
        f"{settings.API_V1_STR}/calculations/",
        headers=superuser_token_headers,
        json={
            "rate_table_id": rt_id,
            "policy_id": str(policy.id),
            "renewal_id": str(renewal.id),
            "inputs": {"fixed_amount": 7500.00},
            "is_selected": False,
        },
    )
    assert calc_resp.status_code == 201
    calc_id = calc_resp.json()["id"]

    # Select calculation
    sel_resp = client.post(
        f"{settings.API_V1_STR}/calculations/{calc_id}/select",
        headers=superuser_token_headers,
    )
    assert sel_resp.status_code == 200
    assert sel_resp.json()["is_selected"] is True

    # Verify renewal proposed premium was updated
    db.refresh(renewal)
    assert renewal.selected_calculation_id == uuid.UUID(calc_id)
