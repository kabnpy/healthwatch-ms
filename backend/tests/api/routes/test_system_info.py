from fastapi.testclient import TestClient

from app.core.config import settings


def test_get_system_info(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/utils/system-info")
    assert response.status_code == 200
    data = response.json()
    assert data["app_name"] == "HealthWatch MS"
    assert data["environment"] == settings.ENVIRONMENT
    assert data["currency"] == "KES"
    assert data["timezone"] == "UTC"
    assert data["version"] == "0.1.0"
    assert data["status"] == "operational"
