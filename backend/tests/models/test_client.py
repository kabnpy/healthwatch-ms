import pytest
from pydantic import ValidationError
from app.models import ClientCreate

def test_client_create_valid() -> None:
    client_in = ClientCreate(
        name="John Doe",
        email="john@example.com",
        phone="1234567890",
        address="123 Main St",
        date_of_birth="1990-01-01"
    )
    assert client_in.name == "John Doe"
    assert client_in.email == "john@example.com"

def test_client_create_invalid_email() -> None:
    with pytest.raises(ValidationError):
        ClientCreate(
            name="John Doe",
            email="not-an-email",
            phone="1234567890",
            address="123 Main St",
            date_of_birth="1990-01-01"
        )
