from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.client import create_random_client
from tests.utils.insurance import create_random_policy


def test_create_and_read_activities(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    client_obj = create_random_client(db)
    policy = create_random_policy(db, client_id=client_obj.id)

    activity_payload = {
        "client_id": str(client_obj.id),
        "policy_id": str(policy.id),
        "activity_type": "call",
        "body": "Followed up with client regarding renewal invitation terms.",
    }

    response = client.post(
        f"{settings.API_V1_STR}/activities/",
        headers=superuser_token_headers,
        json=activity_payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["client_id"] == str(client_obj.id)
    assert data["policy_id"] == str(policy.id)
    assert data["activity_type"] == "call"
    assert data["body"] == activity_payload["body"]
    assert data["created_by_id"] is not None

    # Retrieve activities for client
    list_res = client.get(
        f"{settings.API_V1_STR}/activities/?client_id={client_obj.id}",
        headers=superuser_token_headers,
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["count"] >= 1
    assert any(a["id"] == data["id"] for a in list_data["data"])
