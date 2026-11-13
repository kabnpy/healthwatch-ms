import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Client,
    Insurer,
    PricingMethod,
    PricingStrategy,
    Product,
    RateBracket,
    RateTableStatus,
    RateTableVersion,
)


def _seed_client_and_rated_product(db: Session) -> tuple[Client, Product]:
    insurer = Insurer(name=f"RouteInsurer-{uuid.uuid4().hex[:6]}")
    db.add(insurer)
    db.flush()

    product = Product(
        insurer_id=insurer.id,
        name=f"RouteProduct-{uuid.uuid4().hex[:6]}",
        class_of_insurance="Motor Private",
        pricing_strategy=PricingStrategy.PERCENTAGE,
        default_commission_rate=Decimal("10.00"),
    )
    db.add(product)
    db.flush()

    rtv = RateTableVersion(
        insurer_id=insurer.id,
        class_of_insurance="Motor Private",
        version_number=1,
        status=RateTableStatus.PUBLISHED,
        pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
        effective_from=date(2025, 1, 1),
        source_reference="Route test schedule",
    )
    db.add(rtv)
    db.flush()

    db.add(
        RateBracket(
            rate_table_version_id=rtv.id,
            min_value=Decimal("0.00"),
            max_value=None,
            rate_percent=Decimal("0.04"),
            minimum_premium=Decimal("37500.00"),
            display_label="All values",
        )
    )

    client_obj = Client(
        name=f"RouteClient-{uuid.uuid4().hex[:6]}",
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        phone="0711223344",
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)
    db.refresh(product)
    return client_obj, product


def test_policy_routes_lifecycle_and_domain_exception_mapping(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client, product = _seed_client_and_rated_product(db)
    today = date.today()
    policy_number = f"POL-RT-{uuid.uuid4().hex[:6].upper()}"

    # Missing product -> 404
    missing_prod_resp = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json={
            "policy_number": policy_number,
            "client_id": str(db_client.id),
            "product_id": str(uuid.uuid4()),
            "coverage_start": str(today),
            "coverage_end": str(today + timedelta(days=365)),
            "risk_details": {"vehicle": {"sum_insured": "1000000"}},
        },
    )
    assert missing_prod_resp.status_code == 404

    # Valid create -> 200
    create_resp = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json={
            "policy_number": policy_number,
            "client_id": str(db_client.id),
            "product_id": str(product.id),
            "coverage_start": str(today),
            "coverage_end": str(today + timedelta(days=365)),
            "risk_details": {
                "vehicle": {
                    "registration_number": "KCA 111A",
                    "make": "Toyota",
                    "sum_insured": "1000000",
                }
            },
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    policy_id = create_resp.json()["id"]

    # Duplicate policy_number -> 409
    dup_resp = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json={
            "policy_number": policy_number,
            "client_id": str(db_client.id),
            "product_id": str(product.id),
            "coverage_start": str(today),
            "coverage_end": str(today + timedelta(days=365)),
            "risk_details": {"vehicle": {"sum_insured": "1000000"}},
        },
    )
    assert dup_resp.status_code == 409

    # List & Get -> 200
    list_resp = client.get(
        f"{settings.API_V1_STR}/policies/?client_id={db_client.id}",
        headers=superuser_token_headers,
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["count"] == 1

    get_resp = client.get(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
    )
    assert get_resp.status_code == 200

    # Endorse -> 200, missing policy -> 404
    missing_end_resp = client.post(
        f"{settings.API_V1_STR}/policies/{uuid.uuid4()}/endorsements",
        headers=superuser_token_headers,
        json={
            "change_description": "Missing",
            "updated_risk_details": {"vehicle": {"sum_insured": "1500000"}},
        },
    )
    assert missing_end_resp.status_code == 404

    end_resp = client.post(
        f"{settings.API_V1_STR}/policies/{policy_id}/endorsements",
        headers=superuser_token_headers,
        json={
            "change_description": "Increase sum insured",
            "updated_risk_details": {
                "vehicle": {
                    "registration_number": "KCA 111A",
                    "make": "Toyota",
                    "sum_insured": "1500000",
                }
            },
        },
    )
    assert end_resp.status_code == 200, end_resp.text
    endorsed_rn_id = end_resp.json()["id"]

    # Policy risk notes -> 200
    pol_rns_resp = client.get(
        f"{settings.API_V1_STR}/policies/{policy_id}/risk-notes",
        headers=superuser_token_headers,
    )
    assert pol_rns_resp.status_code == 200
    assert pol_rns_resp.json()["count"] == 2

    # RiskNote revision -> 200, then repeating on replaced RN -> 400
    rev_resp = client.post(
        f"{settings.API_V1_STR}/risk-notes/{endorsed_rn_id}/revisions",
        headers=superuser_token_headers,
        json={"special_clauses": ["Updated clause"]},
    )
    assert rev_resp.status_code == 200

    repeat_rev_resp = client.post(
        f"{settings.API_V1_STR}/risk-notes/{endorsed_rn_id}/revisions",
        headers=superuser_token_headers,
        json={"special_clauses": ["Should fail"]},
    )
    assert repeat_rev_resp.status_code == 400

    # Update & Delete -> 200, then Get -> 404
    upd_resp = client.put(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
        json={"policy_number": f"{policy_number}-UPD"},
    )
    assert upd_resp.status_code == 200

    del_resp = client.delete(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
    )
    assert del_resp.status_code == 200

    assert (
        client.get(
            f"{settings.API_V1_STR}/policies/{policy_id}",
            headers=superuser_token_headers,
        ).status_code
        == 404
    )
