from fastapi.testclient import TestClient

from app.core.config import settings
from tests.utils.utils import random_email


def test_create_client(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "name": "Test Client",
        "email": random_email(),
        "phone": "1234567890",
        "postal_address": "P.O. Box 123",
        "postal_code": "00100",
        "town": "Nairobi",
    }
    response = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert content["email"] == data["email"]
    assert "id" in content


def test_read_client(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "name": "Read Test Client",
        "email": random_email(),
    }
    response = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=data,
    )
    created_client = response.json()
    client_id = created_client["id"]

    response = client.get(
        f"{settings.API_V1_STR}/clients/{client_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == data["name"]
    assert content["id"] == client_id


def test_read_clients(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert "data" in content
    assert "count" in content


def test_update_client(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "name": "Update Test Client",
        "email": random_email(),
    }
    response = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=data,
    )
    created_client = response.json()
    client_id = created_client["id"]

    update_data = {"name": "Updated Name"}
    response = client.patch(
        f"{settings.API_V1_STR}/clients/{client_id}",
        headers=superuser_token_headers,
        json=update_data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name"] == "Updated Name"


def test_delete_client(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "name": "Delete Test Client",
        "email": random_email(),
    }
    response = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=data,
    )
    created_client = response.json()
    client_id = created_client["id"]

    response = client.delete(
        f"{settings.API_V1_STR}/clients/{client_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 204

    response = client.get(
        f"{settings.API_V1_STR}/clients/{client_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
