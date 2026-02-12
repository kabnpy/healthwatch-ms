import pytest
from pydantic import ValidationError
from app.models import PolicyCreate, PolicyStatus, PolicyType

def test_policy_create_valid() -> None:
    policy_in = PolicyCreate(
        policy_number="POL123",
        type=PolicyType.HEALTH,
        provider="HealthCorp",
        start_date="2023-01-01",
        end_date="2024-01-01",
        premium_amount=100.0,
        status=PolicyStatus.ACTIVE,
        client_id="00000000-0000-0000-0000-000000000000" # Placeholder
    )
    assert policy_in.policy_number == "POL123"
    assert policy_in.premium_amount == 100.0

def test_policy_create_invalid_premium() -> None:
    with pytest.raises(ValidationError):
        PolicyCreate(
            policy_number="POL123",
            type=PolicyType.HEALTH,
            provider="HealthCorp",
            start_date="2023-01-01",
            end_date="2024-01-01",
            premium_amount=-10.0,
            status=PolicyStatus.ACTIVE,
            client_id="00000000-0000-0000-0000-000000000000"
        )
