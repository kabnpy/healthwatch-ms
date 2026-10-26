import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, delete

from app.api.deps import get_db
from app.core import db as core_db
from app.core.config import settings
from app.main import app
from app.models import (
    Activity,
    Claim,
    Client,
    Correspondence,
    Document,
    DocumentJob,
    Insurer,
    Invoice,
    InvoiceLineItem,
    PaymentAllocation,
    PaymentRecord,
    Policy,
    Product,
    Receipt,
    ReceiptAllocation,
    Renewal,
    RiskNote,
    User,
    Vehicle,
)
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers


def _init_test_engine():
    """Returns PostgreSQL engine if reachable, otherwise in-memory SQLite engine."""
    if os.getenv("FORCE_SQLITE_TEST", "false").lower() == "true":
        return create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    try:
        # Check if configured PostgreSQL database is live and accepting queries
        with core_db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return core_db.engine
    except Exception:
        # Fall back to in-memory SQLite engine
        return create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )


test_engine = _init_test_engine()
core_db.engine = test_engine


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)
    with Session(test_engine) as session:
        core_db.init_db(session)
        yield session
        # Cleanup
        try:
            for model in [
                DocumentJob,
                Document,
                Claim,
                Activity,
                PaymentAllocation,
                PaymentRecord,
                ReceiptAllocation,
                InvoiceLineItem,
                Receipt,
                Invoice,
                Renewal,
                Vehicle,
                RiskNote,
                Policy,
                Product,
                Correspondence,
                Client,
                Insurer,
                User,
            ]:
                session.execute(delete(model))
            session.commit()
        except Exception:
            session.rollback()


@pytest.fixture(scope="module")
def client(db: Session) -> Generator[TestClient]:
    def _override_get_db() -> Generator[Session]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
