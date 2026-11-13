import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import (
    ActivityCreate,
    ActivityType,
    ClientCreate,
    ClientUpdate,
    Policy,
    PolicyStatus,
    VehicleCreate,
    VehicleUpdate,
)
from app.services.portfolio import (
    PortfolioConflictError,
    PortfolioNotFoundError,
    portfolio_service,
)
from tests.utils.utils import random_email, random_lower_string


def _make_client_in() -> ClientCreate:
    return ClientCreate(
        name=random_lower_string(),
        kra_pin=f"A{uuid.uuid4().hex[:9].upper()}",
        email=random_email(),
        phone="+254700000000",
    )


def test_portfolio_client_lifecycle_and_soft_delete(db: Session) -> None:
    client_in = _make_client_in()
    created = portfolio_service.create_client(session=db, client_in=client_in)
    assert created.id is not None
    assert created.kra_pin == client_in.kra_pin

    # Duplicate KRA PIN raises PortfolioConflictError
    with pytest.raises(PortfolioConflictError):
        portfolio_service.create_client(session=db, client_in=client_in)

    # Read by id and kra_pin
    fetched = portfolio_service.get_client(session=db, client_id=created.id)
    assert fetched is not None
    assert fetched.id == created.id

    by_pin = portfolio_service.get_client_by_kra_pin(
        session=db, kra_pin=client_in.kra_pin
    )
    assert by_pin is not None
    assert by_pin.id == created.id

    # Update
    updated = portfolio_service.update_client(
        session=db,
        client_id=created.id,
        client_in=ClientUpdate(name="Updated Client Name"),
    )
    assert updated.name == "Updated Client Name"

    # List & count include it
    clients, total = portfolio_service.list_clients(session=db, skip=0, limit=100)
    assert any(c.id == created.id for c in clients)
    assert total >= 1

    # Soft delete excludes from reads and allows KRA PIN reuse? (deleted_at is set)
    portfolio_service.delete_client(session=db, client_id=created.id)
    assert portfolio_service.get_client(session=db, client_id=created.id) is None
    assert (
        portfolio_service.get_client_by_kra_pin(session=db, kra_pin=client_in.kra_pin)
        is None
    )
    clients_after, _ = portfolio_service.list_clients(session=db, skip=0, limit=100)
    assert not any(c.id == created.id for c in clients_after)

    with pytest.raises(PortfolioNotFoundError):
        portfolio_service.delete_client(session=db, client_id=created.id)


def test_portfolio_vehicle_lifecycle_and_policy_filter(db: Session) -> None:
    client = portfolio_service.create_client(session=db, client_in=_make_client_in())
    policy = Policy(
        policy_number=f"POL-{uuid.uuid4().hex[:8].upper()}",
        client_id=client.id,
        status=PolicyStatus.ACTIVE,
        inception_date=date.today(),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    vehicle_in = VehicleCreate(
        policy_id=policy.id,
        registration_number=f"KDA {uuid.uuid4().hex[:3].upper()}",
        make="Toyota",
        model="Land Cruiser",
        year_of_manufacture=2022,
        insured_value=Decimal("5000000.00"),
    )
    vehicle = portfolio_service.create_vehicle(session=db, vehicle_in=vehicle_in)
    assert vehicle.policy_id == policy.id

    vehicles, count = portfolio_service.list_vehicles(
        session=db, policy_id=policy.id
    )
    assert count == 1
    assert vehicles[0].id == vehicle.id

    updated = portfolio_service.update_vehicle(
        session=db,
        vehicle_id=vehicle.id,
        vehicle_in=VehicleUpdate(make="Lexus"),
    )
    assert updated.make == "Lexus"

    portfolio_service.delete_vehicle(session=db, vehicle_id=vehicle.id)
    assert portfolio_service.get_vehicle(session=db, vehicle_id=vehicle.id) is None

    with pytest.raises(PortfolioNotFoundError):
        portfolio_service.update_vehicle(
            session=db,
            vehicle_id=vehicle.id,
            vehicle_in=VehicleUpdate(make="Subaru"),
        )


def test_portfolio_activity_create_and_list(db: Session) -> None:
    client = portfolio_service.create_client(session=db, client_in=_make_client_in())
    act = portfolio_service.create_activity(
        session=db,
        activity_in=ActivityCreate(
            client_id=client.id,
            activity_type=ActivityType.NOTE,
            body="Initial onboarding call completed.",
        ),
    )
    assert act.client_id == client.id

    items, count = portfolio_service.list_activities(
        session=db, client_id=client.id
    )
    assert count == 1
    assert items[0].id == act.id
