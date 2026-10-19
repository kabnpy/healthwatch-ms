from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.insurance import create_random_policy


def test_create_renewal(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)
    payload = {
        "policy_id": str(policy.id),
        "renewal_period_start": str(date.today() + timedelta(days=365)),
        "renewal_period_end": str(date.today() + timedelta(days=730)),
        "proposed_premium": "50000.00",
        "notes": "Annual renewal",
    }
    response = client.post(
        f"{settings.API_V1_STR}/renewals/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["policy_id"] == str(policy.id)
    assert data["status"] == "awaiting_carrier"
    assert data["version"] == 1
    assert data["proposed_premium"] == "50000.00"


def test_single_active_renewal_invariant(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)
    payload = {
        "policy_id": str(policy.id),
        "renewal_period_start": str(date.today() + timedelta(days=365)),
        "renewal_period_end": str(date.today() + timedelta(days=730)),
    }
    # First renewal succeeds
    r1 = client.post(
        f"{settings.API_V1_STR}/renewals/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r1.status_code == 201

    # Second concurrent renewal is rejected
    r2 = client.post(
        f"{settings.API_V1_STR}/renewals/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r2.status_code == 400
    assert "already has an active renewal" in r2.json()["detail"].lower()


def test_renewal_transition_lifecycle(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)
    create_payload = {
        "policy_id": str(policy.id),
        "renewal_period_start": str(date.today() + timedelta(days=365)),
        "renewal_period_end": str(date.today() + timedelta(days=730)),
    }
    r = client.post(
        f"{settings.API_V1_STR}/renewals/",
        headers=superuser_token_headers,
        json=create_payload,
    )
    renewal_id = r.json()["id"]

    # 1. awaiting_carrier -> carrier_received
    t1 = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}/transition",
        headers=superuser_token_headers,
        json={"target_status": "carrier_received", "expected_version": 1},
    )
    assert t1.status_code == 200
    assert t1.json()["status"] == "carrier_received"
    assert t1.json()["version"] == 2
    assert t1.json()["carrier_received_at"] is not None

    # 2. carrier_received -> client_invited
    t2 = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}/transition",
        headers=superuser_token_headers,
        json={"target_status": "client_invited", "expected_version": 2},
    )
    assert t2.status_code == 200
    assert t2.json()["status"] == "client_invited"
    assert t2.json()["version"] == 3
    assert t2.json()["invited_at"] is not None

    # 3. client_invited -> paid
    t3 = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}/transition",
        headers=superuser_token_headers,
        json={"target_status": "paid", "expected_version": 3},
    )
    assert t3.status_code == 200
    assert t3.json()["status"] == "paid"
    assert t3.json()["version"] == 4
    assert t3.json()["paid_at"] is not None

    # 4. paid -> completed
    t4 = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}/transition",
        headers=superuser_token_headers,
        json={"target_status": "completed", "expected_version": 4},
    )
    assert t4.status_code == 200
    assert t4.json()["status"] == "completed"
    assert t4.json()["version"] == 5
    assert t4.json()["completed_at"] is not None


def test_invalid_renewal_transition(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)
    create_payload = {
        "policy_id": str(policy.id),
        "renewal_period_start": str(date.today() + timedelta(days=365)),
        "renewal_period_end": str(date.today() + timedelta(days=730)),
    }
    r = client.post(
        f"{settings.API_V1_STR}/renewals/",
        headers=superuser_token_headers,
        json=create_payload,
    )
    renewal_id = r.json()["id"]

    # Try invalid jump: awaiting_carrier -> completed
    bad_t = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}/transition",
        headers=superuser_token_headers,
        json={"target_status": "completed", "expected_version": 1},
    )
    assert bad_t.status_code == 400
    assert "invalid renewal transition" in bad_t.json()["detail"].lower()


def test_occ_conflict_on_transition_and_update(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)
    create_payload = {
        "policy_id": str(policy.id),
        "renewal_period_start": str(date.today() + timedelta(days=365)),
        "renewal_period_end": str(date.today() + timedelta(days=730)),
    }
    r = client.post(
        f"{settings.API_V1_STR}/renewals/",
        headers=superuser_token_headers,
        json=create_payload,
    )
    renewal_id = r.json()["id"]

    # Mismatched expected_version returns 409
    occ_response = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}/transition",
        headers=superuser_token_headers,
        json={"target_status": "carrier_received", "expected_version": 99},
    )
    assert occ_response.status_code == 409
    assert occ_response.json()["detail"]["error"] == "renewal_modified_concurrently"

    # Successful update increments version
    update_res = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}",
        headers=superuser_token_headers,
        json={"notes": "Updated notes", "expected_version": 1},
    )
    assert update_res.status_code == 200
    assert update_res.json()["version"] == 2
    assert update_res.json()["notes"] == "Updated notes"

    # Repeating same update with stale expected_version=1 fails with 409
    stale_update = client.patch(
        f"{settings.API_V1_STR}/renewals/{renewal_id}",
        headers=superuser_token_headers,
        json={"notes": "Stale notes", "expected_version": 1},
    )
    assert stale_update.status_code == 409
