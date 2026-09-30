import pytest
from sqlmodel import Session

from app.models import PolicyCreate
from tests.utils.client import create_random_client
from tests.utils.utils import random_lower_string


def test_policy_status_raises_error_on_invalid_string(db: Session) -> None:
    # Now that Policy.status is an Enum, it should raise ValidationError
    client = create_random_client(db)
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PolicyCreate(
            policy_number=random_lower_string(),
            client_id=client.id,
            status="INVALID_STATUS_STRING",
        )


def test_invoice_status_raises_error_on_invalid_string(db: Session) -> None:
    client = create_random_client(db)
    from decimal import Decimal

    # Invoice also uses Enum for status, SQLAlchemy will raise LookupError on refresh/process
    # if we somehow bypass Pydantic or use raw SQL, but here Pydantic should catch it during init
    from pydantic import ValidationError

    from app.models import Invoice

    with pytest.raises(ValidationError):
        Invoice(
            invoice_number=random_lower_string(),
            client_id=client.id,
            status="GARBAGE",
            total_amount=Decimal("100.00"),
            balance_due=Decimal("100.00"),
        )
