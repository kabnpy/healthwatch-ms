import uuid
from typing import Any

from sqlmodel import Session, func, select

from app.models import (
    Activity,
    ActivityCreate,
    Client,
    ClientCreate,
    ClientUpdate,
    Vehicle,
    VehicleCreate,
    VehicleUpdate,
    get_datetime_utc,
)


class PortfolioError(Exception):
    """Base domain error for Portfolio operations."""


class PortfolioNotFoundError(PortfolioError):
    """Raised when a requested Client or Vehicle does not exist."""


class PortfolioConflictError(PortfolioError):
    """Raised when a Portfolio uniqueness invariant is violated."""


class PortfolioValidationError(PortfolioError):
    """Raised when Portfolio input or state validation fails."""


class PortfolioService:
    """Domain service owning Client, Vehicle, and Activity persistence."""

    # ==========================================
    # Client Operations
    # ==========================================

    @staticmethod
    def create_client(*, session: Session, client_in: ClientCreate) -> Client:
        """Create a new Client, enforcing KRA PIN uniqueness among active clients."""
        existing = PortfolioService.get_client_by_kra_pin(
            session=session, kra_pin=client_in.kra_pin
        )
        if existing:
            raise PortfolioConflictError(
                "The client with this KRA PIN already exists in the system."
            )
        db_obj = Client.model_validate(client_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def get_client(*, session: Session, client_id: uuid.UUID) -> Client | None:
        """Return an active (non-deleted) Client by ID, or None."""
        statement = select(Client).where(
            Client.id == client_id, Client.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def get_client_or_raise(*, session: Session, client_id: uuid.UUID) -> Client:
        """Return an active Client by ID or raise PortfolioNotFoundError."""
        client = PortfolioService.get_client(session=session, client_id=client_id)
        if not client:
            raise PortfolioNotFoundError("Client not found")
        return client

    @staticmethod
    def get_client_by_kra_pin(*, session: Session, kra_pin: str) -> Client | None:
        """Return an active Client by KRA PIN, or None."""
        statement = select(Client).where(
            Client.kra_pin == kra_pin, Client.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def get_client_by_email(*, session: Session, email: str) -> Client | None:
        """Return an active Client by email, or None."""
        statement = select(Client).where(
            Client.email == email, Client.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def list_clients(
        *, session: Session, skip: int = 0, limit: int = 100
    ) -> tuple[list[Client], int]:
        """Return a paginated list of active Clients and total count."""
        base = select(Client).where(Client.deleted_at.is_(None))
        count = session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(session.exec(base.offset(skip).limit(limit)).all())
        return items, count

    @staticmethod
    def update_client(
        *, session: Session, client_id: uuid.UUID, client_in: ClientUpdate
    ) -> Client:
        """Update an active Client."""
        db_client = PortfolioService.get_client_or_raise(
            session=session, client_id=client_id
        )
        client_data = client_in.model_dump(exclude_unset=True)
        db_client.sqlmodel_update(client_data)
        session.add(db_client)
        session.commit()
        session.refresh(db_client)
        return db_client

    @staticmethod
    def delete_client(*, session: Session, client_id: uuid.UUID) -> None:
        """Soft-delete an active Client."""
        db_client = PortfolioService.get_client_or_raise(
            session=session, client_id=client_id
        )
        db_client.deleted_at = get_datetime_utc()
        session.add(db_client)
        session.commit()

    # ==========================================
    # Vehicle Operations
    # ==========================================

    @staticmethod
    def _vehicle_base_query(policy_id: uuid.UUID | None = None) -> Any:
        statement = select(Vehicle).where(Vehicle.deleted_at.is_(None))
        if policy_id is not None:
            statement = statement.where(Vehicle.policy_id == policy_id)
        return statement

    @staticmethod
    def create_vehicle(*, session: Session, vehicle_in: VehicleCreate) -> Vehicle:
        """Register a new Vehicle asset."""
        db_vehicle = Vehicle.model_validate(vehicle_in)
        session.add(db_vehicle)
        session.commit()
        session.refresh(db_vehicle)
        return db_vehicle

    @staticmethod
    def get_vehicle(*, session: Session, vehicle_id: uuid.UUID) -> Vehicle | None:
        """Return an active (non-deleted) Vehicle by ID, or None."""
        statement = select(Vehicle).where(
            Vehicle.id == vehicle_id, Vehicle.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def get_vehicle_or_raise(*, session: Session, vehicle_id: uuid.UUID) -> Vehicle:
        """Return an active Vehicle by ID or raise PortfolioNotFoundError."""
        vehicle = PortfolioService.get_vehicle(session=session, vehicle_id=vehicle_id)
        if not vehicle:
            raise PortfolioNotFoundError("Vehicle not found")
        return vehicle

    @staticmethod
    def list_vehicles(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        policy_id: uuid.UUID | None = None,
    ) -> tuple[list[Vehicle], int]:
        """Return paginated active Vehicles (optionally filtered by policy_id) and total count."""
        base = PortfolioService._vehicle_base_query(policy_id=policy_id)
        count = session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(session.exec(base.offset(skip).limit(limit)).all())
        return items, count

    @staticmethod
    def get_vehicles_by_policy(
        *, session: Session, policy_id: uuid.UUID
    ) -> list[Vehicle]:
        """Return all active Vehicles associated with a Policy."""
        statement = PortfolioService._vehicle_base_query(policy_id=policy_id)
        return list(session.exec(statement).all())

    @staticmethod
    def update_vehicle(
        *, session: Session, vehicle_id: uuid.UUID, vehicle_in: VehicleUpdate
    ) -> Vehicle:
        """Update an active Vehicle."""
        db_vehicle = PortfolioService.get_vehicle_or_raise(
            session=session, vehicle_id=vehicle_id
        )
        vehicle_data = vehicle_in.model_dump(exclude_unset=True)
        db_vehicle.sqlmodel_update(vehicle_data)
        session.add(db_vehicle)
        session.commit()
        session.refresh(db_vehicle)
        return db_vehicle

    @staticmethod
    def delete_vehicle(*, session: Session, vehicle_id: uuid.UUID) -> None:
        """Soft-delete an active Vehicle."""
        db_vehicle = PortfolioService.get_vehicle_or_raise(
            session=session, vehicle_id=vehicle_id
        )
        db_vehicle.deleted_at = get_datetime_utc()
        session.add(db_vehicle)
        session.commit()

    # ==========================================
    # Activity Operations
    # ==========================================

    @staticmethod
    def _activity_base_query(
        *,
        client_id: uuid.UUID | None = None,
        policy_id: uuid.UUID | None = None,
        renewal_id: uuid.UUID | None = None,
    ) -> Any:
        statement = select(Activity)
        if client_id is not None:
            statement = statement.where(Activity.client_id == client_id)
        if policy_id is not None:
            statement = statement.where(Activity.policy_id == policy_id)
        if renewal_id is not None:
            statement = statement.where(Activity.renewal_id == renewal_id)
        return statement

    @staticmethod
    def create_activity(
        *,
        session: Session,
        activity_in: ActivityCreate,
        created_by_id: uuid.UUID | None = None,
    ) -> Activity:
        """Append an immutable operational Activity log entry."""
        db_activity = Activity(
            client_id=activity_in.client_id,
            policy_id=activity_in.policy_id,
            renewal_id=activity_in.renewal_id,
            activity_type=activity_in.activity_type,
            body=activity_in.body,
            created_by_id=created_by_id,
        )
        session.add(db_activity)
        session.commit()
        session.refresh(db_activity)
        return db_activity

    @staticmethod
    def list_activities(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        client_id: uuid.UUID | None = None,
        policy_id: uuid.UUID | None = None,
        renewal_id: uuid.UUID | None = None,
    ) -> tuple[list[Activity], int]:
        """Return paginated Activities ordered newest-first and total count."""
        base = PortfolioService._activity_base_query(
            client_id=client_id, policy_id=policy_id, renewal_id=renewal_id
        )
        count = session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(
            session.exec(
                base.order_by(Activity.created_at.desc()).offset(skip).limit(limit)
            ).all()
        )
        return items, count


portfolio_service = PortfolioService()
