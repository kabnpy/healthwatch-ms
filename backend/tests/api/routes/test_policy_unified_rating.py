import uuid
from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    BusinessEvent,
    Client,
    Insurer,
    PremiumCalculation,
    PricingMethod,
    PricingStrategy,
    Product,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
    RiskNote,
)


def _create_insurer_and_product(
    db: Session,
    *,
    pricing_strategy: PricingStrategy = PricingStrategy.PERCENTAGE,
    default_commission_rate: Decimal = Decimal("10.00"),
    class_of_insurance: str = "Motor Private",
) -> Product:
    insurer = Insurer(name=f"Insurer-{uuid.uuid4().hex[:6]}", paybill_number="123456")
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name=f"Product-{uuid.uuid4().hex[:6]}",
        class_of_insurance=class_of_insurance,
        pricing_strategy=pricing_strategy,
        default_commission_rate=default_commission_rate,
    )
    db.add(product)
    db.flush()
    return product


def _create_published_rate_table(
    db: Session,
    *,
    product: Product,
    rate_value: Decimal = Decimal("0.04"),
    min_premium: Decimal = Decimal("37500.00"),
) -> RateTableVersion:
    rtv = RateTableVersion(
        insurer_id=product.insurer_id,
        class_of_insurance=product.class_of_insurance,
        version_number=1,
        status=RateTableStatus.PUBLISHED,
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        effective_from=date(2025, 1, 1),
        source_reference="Test schedule",
    )
    db.add(rtv)
    db.flush()

    bracket = RateBracket(
        rate_table_version_id=rtv.id,
        min_value=Decimal("0.00"),
        max_value=None,
        rate_percent=rate_value,
        minimum_premium=min_premium,
        display_label="All values",
    )
    db.add(bracket)
    db.commit()
    db.refresh(rtv)
    return rtv


def test_policy_quote_uses_published_rate_table_version(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    product = _create_insurer_and_product(db)
    _create_published_rate_table(db, product=product)

    resp = client.post(
        f"{settings.API_V1_STR}/policies/quote",
        headers=superuser_token_headers,
        json={
            "product_id": str(product.id),
            "risk_details": {
                "vehicle": {
                    "registration_number": "KAA 123A",
                    "make": "Toyota",
                    "sum_insured": "1000000",
                }
            },
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    breakdown = data["breakdown"]
    assert Decimal(breakdown["net_premium"]) == Decimal("40000.00")
    assert Decimal(breakdown["taxes"]["Training Levy"]) == Decimal("80.00")
    assert Decimal(breakdown["taxes"]["PHCF"]) == Decimal("100.00")
    assert Decimal(breakdown["taxes"]["Stamp Duty"]) == Decimal("40.00")
    assert Decimal(breakdown["commission_amount"]) == Decimal("4000.00")
    assert Decimal(breakdown["total_amount"]) == Decimal("40220.00")


def test_policy_quote_missing_published_rate_table_returns_400(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    product = _create_insurer_and_product(db)
    db.commit()

    resp = client.post(
        f"{settings.API_V1_STR}/policies/quote",
        headers=superuser_token_headers,
        json={
            "product_id": str(product.id),
            "risk_details": {
                "vehicle": {
                    "registration_number": "KAA 123A",
                    "make": "Toyota",
                    "sum_insured": "1000000",
                }
            },
        },
    )
    assert resp.status_code == 400


def test_policy_issuance_persists_selected_premium_calculation_and_risk_note(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    product = _create_insurer_and_product(db)
    rtv = _create_published_rate_table(db, product=product)

    client_obj = Client(
        name=f"Client-{uuid.uuid4().hex[:6]}",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        phone="+254700000001",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy_number = f"POL-{uuid.uuid4().hex[:8].upper()}"
    resp = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json={
            "policy_number": policy_number,
            "client_id": str(client_obj.id),
            "product_id": str(product.id),
            "coverage_start": "2025-01-01",
            "coverage_end": "2025-12-31",
            "risk_details": {
                "vehicle": {
                    "registration_number": "KAA 123A",
                    "make": "Toyota",
                    "sum_insured": "1000000",
                }
            },
        },
    )
    assert resp.status_code == 200, resp.text
    policy_id = uuid.UUID(resp.json()["id"])

    calc = db.exec(
        select(PremiumCalculation).where(
            PremiumCalculation.policy_id == policy_id,
            PremiumCalculation.is_selected.is_(True),
        )
    ).first()
    assert calc is not None
    assert calc.business_event == BusinessEvent.NEW_BUSINESS
    assert calc.rate_table_version_id == rtv.id
    assert calc.total_premium == Decimal("40220.00")

    rn = db.exec(select(RiskNote).where(RiskNote.policy_id == policy_id)).first()
    assert rn is not None
    assert rn.net_premium == Decimal("40000.00")
    assert rn.commission_amount == Decimal("4000.00")
    assert rn.total_amount == Decimal("40220.00")


def test_endorsement_creation_persists_selected_premium_calculation(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    product = _create_insurer_and_product(db)
    rtv = _create_published_rate_table(db, product=product)

    client_obj = Client(
        name=f"Client-{uuid.uuid4().hex[:6]}",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        phone="+254700000001",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)

    policy_number = f"POL-{uuid.uuid4().hex[:8].upper()}"
    create_resp = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json={
            "policy_number": policy_number,
            "client_id": str(client_obj.id),
            "product_id": str(product.id),
            "coverage_start": "2025-01-01",
            "coverage_end": "2025-12-31",
            "risk_details": {
                "vehicle": {
                    "registration_number": "KAA 123A",
                    "make": "Toyota",
                    "sum_insured": "1000000",
                }
            },
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    policy_id = uuid.UUID(create_resp.json()["id"])

    endorse_resp = client.post(
        f"{settings.API_V1_STR}/policies/{policy_id}/endorsements",
        headers=superuser_token_headers,
        json={
            "updated_risk_details": {
                "vehicle": {
                    "registration_number": "KAA 123A",
                    "make": "Toyota",
                    "sum_insured": "1500000",
                }
            },
            "change_description": "Increased sum insured",
            "effective_date": "2025-07-02",
        },
    )
    assert endorse_resp.status_code == 200, endorse_resp.text

    endorsement_calc = db.exec(
        select(PremiumCalculation).where(
            PremiumCalculation.policy_id == policy_id,
            PremiumCalculation.business_event == BusinessEvent.COVER_CHANGE,
            PremiumCalculation.is_selected.is_(True),
        )
    ).first()
    assert endorsement_calc is not None
    assert endorsement_calc.rate_table_version_id == rtv.id
    assert endorsement_calc.total_premium == Decimal("60310.00")
