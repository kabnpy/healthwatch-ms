from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.insurance import create_random_policy


def test_vehicle_lifecycle(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    policy = create_random_policy(db)

    # 1. Create Vehicle
    payload = {
        "policy_id": str(policy.id),
        "registration_number": "KDD 123X",
        "make": "Toyota",
        "model": "Land Cruiser Prado",
        "year_of_manufacture": 2022,
        "insured_value": "6500000.00",
        "chassis_number": "JTEBU25J800123456",
        "engine_number": "1GD-FTV-987654",
    }
    create_res = client.post(
        f"{settings.API_V1_STR}/vehicles/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert create_res.status_code == 201
    veh_data = create_res.json()
    veh_id = veh_data["id"]
    assert veh_data["registration_number"] == "KDD 123X"
    assert veh_data["insured_value"] == "6500000.00"

    # 2. Get Vehicle by ID
    get_res = client.get(
        f"{settings.API_V1_STR}/vehicles/{veh_id}",
        headers=superuser_token_headers,
    )
    assert get_res.status_code == 200
    assert get_res.json()["model"] == "Land Cruiser Prado"

    # 3. List Vehicles with policy filter
    list_res = client.get(
        f"{settings.API_V1_STR}/vehicles/?policy_id={policy.id}",
        headers=superuser_token_headers,
    )
    assert list_res.status_code == 200
    assert list_res.json()["count"] >= 1

    # 4. Update Vehicle
    patch_res = client.patch(
        f"{settings.API_V1_STR}/vehicles/{veh_id}",
        headers=superuser_token_headers,
        json={"insured_value": "6200000.00"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["insured_value"] == "6200000.00"

    # 5. Soft Delete Vehicle
    del_res = client.delete(
        f"{settings.API_V1_STR}/vehicles/{veh_id}",
        headers=superuser_token_headers,
    )
    assert del_res.status_code == 200

    # 6. Cannot retrieve deleted vehicle
    get_deleted = client.get(
        f"{settings.API_V1_STR}/vehicles/{veh_id}",
        headers=superuser_token_headers,
    )
    assert get_deleted.status_code == 404
