from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings


def test_policy_creation_with_invalid_token(
    client: TestClient, db: Session
) -> None:
    """
    Reproduce/Verify 401 for invalid token.
    """
    data = {
        "policy_number": "TEST-401",
        "client_id": "00000000-0000-0000-0000-000000000000",
        "product_id": "00000000-0000-0000-0000-000000000000",
        "risk_details": {},
        "coverage_end": "2027-01-01"
    }

    # Send request with invalid token
    headers = {"Authorization": "Bearer invalid-token-here"}
    response = client.post(
        f"{settings.API_V1_STR}/policies/",
        json=data,
        headers=headers
    )

    # Should return 401 (not 403)
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"
