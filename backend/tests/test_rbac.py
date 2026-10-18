from fastapi.testclient import TestClient

from app.core.config import settings
from tests.utils.utils import random_email, random_lower_string


def test_viewer_cannot_create_client(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    # Verify that a regular user (VIEWER) cannot create a client
    data = {
        "name": random_lower_string(),
        "kra_pin": random_lower_string(),
        "email": random_email(),
        "phone": random_lower_string(),
    }
    response = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 403


def test_viewer_cannot_delete_client(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
) -> None:
    # Create a client as superuser
    data = {
        "name": random_lower_string(),
        "kra_pin": random_lower_string(),
        "email": random_email(),
        "phone": random_lower_string(),
    }
    r = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=data,
    )
    client_id = r.json()["id"]

    # Delete as VIEWER
    response = client.delete(
        f"{settings.API_V1_STR}/clients/{client_id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
