import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.main import app
from app.models import UserRole
from tests.utils.auth import MockAuth, get_mock_user
from tests.utils.utils import random_lower_string


@pytest.fixture
def mock_auth():
    auth = MockAuth(app)
    yield auth
    auth.reset()


def test_read_clients_with_mock_user(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    # Setup mock user
    mock_user = get_mock_user(role=UserRole.VIEWER)
    mock_auth.mock_user(mock_user)

    # Try to read clients
    response = client.get(f"{settings.API_V1_STR}/clients/")

    # Should work because read_clients only requires CurrentUser
    assert response.status_code == 200


def test_create_client_with_unauthorized_role(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    # Setup mock user with Viewer role (not Staff)
    mock_user = get_mock_user(role=UserRole.VIEWER)
    mock_auth.mock_user(mock_user)

    data = {
        "full_name": "Test Client",
        "email": "test@client.com",
        "phone": "123456",
        "kra_pin": "A123456789Z",
    }

    # Try to create client
    response = client.post(f"{settings.API_V1_STR}/clients/", json=data)

    # Should fail with 403 because create_client requires StaffUser
    assert response.status_code == 403


def test_document_endpoints_missing_auth(client: TestClient, db: Session) -> None:
    """
    Audit: Check if document endpoints are properly protected.
    """
    # Try to read documents without token
    response = client.get(f"{settings.API_V1_STR}/documents/")

    assert response.status_code == 401


def test_download_document_missing_auth(client: TestClient, db: Session) -> None:
    """
    Audit: Check if download endpoint is protected.
    """
    import uuid

    dummy_id = uuid.uuid4()
    response = client.get(f"{settings.API_V1_STR}/documents/{dummy_id}/download")

    assert response.status_code == 401


def test_read_policy_with_mock_user(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.insurance import create_random_policy

    policy = create_random_policy(db)

    mock_user = get_mock_user()
    mock_auth.mock_user(mock_user)

    response = client.get(f"{settings.API_V1_STR}/policies/{policy.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(policy.id)


def test_read_policy_risk_notes(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.insurance import create_random_policy

    policy = create_random_policy(db)

    mock_user = get_mock_user()
    mock_auth.mock_user(mock_user)

    response = client.get(f"{settings.API_V1_STR}/policies/{policy.id}/risk-notes")
    assert response.status_code == 200
    assert "data" in response.json()


def test_update_policy_unauthorized(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.insurance import create_random_policy

    policy = create_random_policy(db)

    # Viewer role cannot update
    mock_user = get_mock_user(role=UserRole.VIEWER)
    mock_auth.mock_user(mock_user)

    response = client.put(
        f"{settings.API_V1_STR}/policies/{policy.id}", json={"policy_number": "UPDATED"}
    )
    assert response.status_code == 403


def test_update_policy_success(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.insurance import create_random_policy

    policy = create_random_policy(db)

    mock_user = get_mock_user(role=UserRole.ADMIN)
    mock_auth.mock_user(mock_user)

    new_number = "POLICY-" + random_lower_string()[:5]
    response = client.put(
        f"{settings.API_V1_STR}/policies/{policy.id}",
        json={"policy_number": new_number},
    )
    assert response.status_code == 200
    assert response.json()["policy_number"] == new_number


def test_upload_document_success(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    import io
    import unittest.mock

    from app.core.storage import storage
    from tests.utils.client import create_random_client

    client_obj = create_random_client(db)

    with unittest.mock.patch.object(storage, "save_file") as mock_save:
        mock_save.return_value = "uploads/test.pdf"

        mock_user = get_mock_user(role=UserRole.ADMIN)
        mock_auth.mock_user(mock_user)

        data = {
            "entity_type": "Client",
            "entity_id": str(client_obj.id),
            "document_type": "Other",
            "metadata_json": '{"source": "test"}',
        }
        files = {"file": ("test.pdf", io.BytesIO(b"dummy content"), "application/pdf")}

        response = client.post(
            f"{settings.API_V1_STR}/documents/upload", data=data, files=files
        )
        assert response.status_code == 200
        assert response.json()["file_path"] == "uploads/test.pdf"
        mock_save.assert_called_once()


def test_delete_policy_staff(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.insurance import create_random_policy

    policy = create_random_policy(db)

    mock_user = get_mock_user(role=UserRole.ADMIN)
    mock_auth.mock_user(mock_user)

    response = client.delete(f"{settings.API_V1_STR}/policies/{policy.id}")
    assert response.status_code == 200


def test_read_documents_with_mock_user(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.documents import create_random_document

    create_random_document(db)

    mock_user = get_mock_user()
    mock_auth.mock_user(mock_user)

    response = client.get(f"{settings.API_V1_STR}/documents/")
    assert response.status_code == 200
    assert "data" in response.json()


def test_read_document_by_id_with_mock_user(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.documents import create_random_document

    doc = create_random_document(db)

    mock_user = get_mock_user()
    mock_auth.mock_user(mock_user)

    response = client.get(f"{settings.API_V1_STR}/documents/{doc.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(doc.id)


def test_delete_document_staff(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.documents import create_random_document

    doc = create_random_document(db)

    # Mock storage.delete_file to avoid errors
    import unittest.mock

    from app.core.storage import storage

    with unittest.mock.patch.object(storage, "delete_file") as mock_del:
        mock_user = get_mock_user(role=UserRole.ADMIN)
        mock_auth.mock_user(mock_user)

        response = client.delete(f"{settings.API_V1_STR}/documents/{doc.id}")
        assert response.status_code == 200
        mock_del.assert_called_once()


def test_download_document_with_mock_user(
    client: TestClient, mock_auth: MockAuth, db: Session
) -> None:
    from tests.utils.documents import create_random_document

    doc = create_random_document(db)

    # Mock storage to avoid real file issues
    import unittest.mock
    from pathlib import Path

    from app.core.storage import storage

    with unittest.mock.patch.object(storage, "get_file_path") as mock_get:
        # Create a real temporary file to satisfy FileResponse
        import tempfile

        with tempfile.NamedTemporaryFile() as tmp:
            mock_get.return_value = Path(tmp.name)

            mock_user = get_mock_user()
            mock_auth.mock_user(mock_user)

            response = client.get(f"{settings.API_V1_STR}/documents/{doc.id}/download")
            assert response.status_code == 200
