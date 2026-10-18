from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.client import create_random_client
from tests.utils.insurance import (
    create_random_insurer,
    create_random_policy,
    create_random_product,
)
from tests.utils.utils import random_email, random_lower_string


def test_create_insurer(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"name": random_lower_string(), "email": random_email()}
    response = client.post(
        f"{settings.API_V1_STR}/insurers/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert "id" in content


def test_create_product(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    insurer = create_random_insurer(db)
    data = {
        "name": random_lower_string(),
        "insurer_id": str(insurer.id),
        "class_of_insurance": "Motor Private",
    }
    response = client.post(
        f"{settings.API_V1_STR}/products/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert content["insurer_id"] == str(insurer.id)


def test_create_policy(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    db_client = create_random_client(db)
    product = create_random_product(db)
    data = {
        "policy_number": random_lower_string(),
        "client_id": str(db_client.id),
        "product_id": str(product.id),
        "coverage_end": str(date.today() + timedelta(days=365)),
        "risk_details": {"info": "some generic info"},
    }
    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["policy_number"] == data["policy_number"]
    assert content["client_id"] == str(db_client.id)


def test_create_claim(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)
    data = {
        "claim_number": random_lower_string(),
        "policy_id": str(policy.id),
        "date_of_loss": "2024-02-01",
        "description": "Accident on highway",
    }
    response = client.post(
        f"{settings.API_V1_STR}/claims/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["claim_number"] == data["claim_number"]
    assert content["policy_id"] == str(policy.id)
