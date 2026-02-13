from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import PolicyStatus, PolicyType
from tests.utils.utils import random_email


def test_create_policy(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # First create a client
    client_data = {
        "name": "Policy Owner",
        "email": random_email(),
    }
    r = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=client_data,
    )
    created_client = r.json()
    client_id = created_client["id"]

    data = {
        "policy_number": "POL-TEST-123",
        "type": PolicyType.HEALTH,
        "provider": "Test Provider",
        "start_date": "2024-01-01",
        "end_date": "2025-01-01",
        "status": PolicyStatus.ACTIVE,
        "client_id": client_id,
    }
    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["policy_number"] == data["policy_number"]
    assert content["client_id"] == client_id


def test_read_policy(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # First create a client
    client_data = {"name": "Policy Owner 2", "email": random_email()}
    r = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=client_data,
    )
    client_id = r.json()["id"]

    data = {
        "policy_number": "POL-READ-456",
        "type": PolicyType.AUTO,
        "provider": "Read Provider",
        "start_date": "2024-02-01",
        "client_id": client_id,
    }
    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )
    policy_id = response.json()["id"]

    response = client.get(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["policy_number"] == data["policy_number"]
    assert content["id"] == policy_id


def test_read_policies(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert "data" in content
    assert "count" in content


def test_update_policy(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # First create a client
    client_data = {"name": "Policy Owner 3", "email": random_email()}
    r = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=client_data,
    )
    client_id = r.json()["id"]

    data = {
        "policy_number": "POL-UPDATE-789",
        "type": PolicyType.LIFE,
        "provider": "Update Provider",
        "start_date": "2024-03-01",
        "client_id": client_id,
    }
    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )
    policy_id = response.json()["id"]

    update_data = {"policy_number": "POL-UPDATED-999"}
    response = client.patch(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
        json=update_data,
    )
    assert response.status_code == 200
    content = response.json()
    assert content["policy_number"] == "POL-UPDATED-999"


def test_delete_policy(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # First create a client
    client_data = {"name": "Policy Owner 4", "email": random_email()}
    r = client.post(
        f"{settings.API_V1_STR}/clients/",
        headers=superuser_token_headers,
        json=client_data,
    )
    client_id = r.json()["id"]

    data = {
        "policy_number": "POL-DELETE-000",
        "type": PolicyType.HOME,
        "provider": "Delete Provider",
        "start_date": "2024-04-01",
        "client_id": client_id,
    }
    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        headers=superuser_token_headers,
        json=data,
    )
    policy_id = response.json()["id"]

    response = client.delete(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 204

    response = client.get(
        f"{settings.API_V1_STR}/policies/{policy_id}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
