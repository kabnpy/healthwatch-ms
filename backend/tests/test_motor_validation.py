from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import Product
from tests.utils.client import create_random_client
from tests.utils.utils import random_lower_string


def test_motor_private_validation_fails_with_missing_fields(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Create a Motor Private product
    insurer_in = {"name": random_lower_string()}
    insurer = crud.create_insurer(session=db, insurer_in=insurer_in)
    product = Product(
        insurer_id=insurer.id,
        name="Motor Private",
        class_of_insurance="Motor Private"
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    db_client = create_random_client(db)

    # 2. Try to create policy with missing fields via API
    data = {
        "policy_number": random_lower_string(),
        "client_id": str(db_client.id),
        "product_id": str(product.id),
        "coverage_end": str(date.today() + timedelta(days=365)),
        "risk_details": {"something": "irrelevant"} # Missing registration_number, make, etc.
    }

    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )

    assert response.status_code == 400
    assert "Invalid risk details for Motor Private" in response.json()["detail"]

def test_motor_private_validation_passes_with_correct_fields(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # 1. Create a Motor Private product
    insurer_in = {"name": random_lower_string()}
    insurer = crud.create_insurer(session=db, insurer_in=insurer_in)
    product = Product(
        insurer_id=insurer.id,
        name="Motor Private",
        class_of_insurance="Motor Private"
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    db_client = create_random_client(db)

    # 2. Try to create policy with correct fields via API
    data = {
        "policy_number": random_lower_string(),
        "client_id": str(db_client.id),
        "product_id": str(product.id),
        "coverage_end": str(date.today() + timedelta(days=365)),
        "risk_details": {
            "registration_number": "KCM 123X",
            "make": "Toyota",
            "year_of_manufacture": 2020,
            "sum_insured": 5000000.0
        }
    }

    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )

    assert response.status_code == 200
