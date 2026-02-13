import pytest
from pydantic import ValidationError

from app.models import ClientCreate


def test_client_create_valid() -> None:
    client_in = ClientCreate(
        name="John Doe",
        email="john@example.com",
        phone="1234567890",
        postal_address="P.O. Box 1003",
        postal_code="00560",
        town="Nairobi",
    )
    assert client_in.name == "John Doe"
    assert client_in.email == "john@example.com"
    assert client_in.postal_address == "P.O. Box 1003"
    assert client_in.postal_code == "00560"
    assert client_in.town == "Nairobi"


def test_client_create_invalid_email() -> None:
    with pytest.raises(ValidationError):
        ClientCreate(
            name="John Doe",
            email="not-an-email",
            phone="1234567890",
            postal_address="P.O. Box 1003",
        )
