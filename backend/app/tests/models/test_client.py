import pytest
from pydantic import ValidationError
from app.models.client import ClientCreate

def test_client_kra_pin_valid():
    # KRA PIN format: [A-P][0-9]{9}[A-Z]
    client_in = ClientCreate(
        name="Test Client",
        email="test@example.com",
        kra_pin="P051234567A"
    )
    assert client_in.kra_pin == "P051234567A"

def test_client_kra_pin_invalid_format():
    with pytest.raises(ValidationError):
        ClientCreate(
            name="Test Client",
            email="test@example.com",
            kra_pin="INVALID"
        )

def test_client_kra_pin_too_short():
    with pytest.raises(ValidationError):
        ClientCreate(
            name="Test Client",
            email="test@example.com",
            kra_pin="A12345678B" # 10 chars
        )

def test_client_kra_pin_too_long():
    with pytest.raises(ValidationError):
        ClientCreate(
            name="Test Client",
            email="test@example.com",
            kra_pin="A1234567890B" # 12 chars
        )
