import uuid
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models import (
    MedicalTier,
    MedicalTierCreate,
    RateBenefit,
    RateBenefitCreate,
    RateBracket,
    RateBracketCreate,
    RateTableStatus,
    RateTableVersion,
    RateTableVersionCreate,
    RateTableVersionUpdate,
)


class RateTableError(Exception):
    """Base domain error for RateTableVersion lifecycle operations."""


class RateTableNotFoundError(RateTableError):
    """Raised when a requested RateTableVersion does not exist or is deleted."""


class RateTableConflictError(RateTableError):
    """Raised when a RateTableVersion state transition or mutation is invalid."""


class RateTableService:
    """Domain service owning RateTableVersion lifecycle and status transitions."""

    _ALLOWED_STATUS_TRANSITIONS: dict[RateTableStatus, set[RateTableStatus]] = {
        RateTableStatus.DRAFT: {RateTableStatus.PUBLISHED},
        RateTableStatus.PUBLISHED: {RateTableStatus.RETIRED},
        RateTableStatus.RETIRED: set(),
    }

    def __init__(self, session: Session) -> None:
        self.session = session

    def create_version(
        self, rate_table_in: RateTableVersionCreate
    ) -> RateTableVersion:
        """Persist a new RateTableVersion atomically."""
        db_obj = RateTableVersion.model_validate(rate_table_in)
        self.session.add(db_obj)
        self.session.commit()
        self.session.refresh(db_obj)
        return db_obj

    def get_version(self, rate_table_id: uuid.UUID) -> RateTableVersion:
        """Fetch a non-deleted RateTableVersion with brackets, benefits, and tiers."""
        statement = (
            select(RateTableVersion)
            .where(
                RateTableVersion.id == rate_table_id,
                RateTableVersion.deleted_at.is_(None),
            )
            .options(
                selectinload(RateTableVersion.brackets),
                selectinload(RateTableVersion.benefits),
                selectinload(RateTableVersion.medical_tiers),
            )
        )
        db_rate_table = self.session.exec(statement).first()
        if db_rate_table is None:
            raise RateTableNotFoundError("Rate table version not found")
        return db_rate_table

    def _base_query(
        self,
        *,
        insurer_id: uuid.UUID | None = None,
        class_of_insurance: str | None = None,
        status: RateTableStatus | None = None,
    ):
        statement = select(RateTableVersion).where(
            RateTableVersion.deleted_at.is_(None)
        )
        if insurer_id is not None:
            statement = statement.where(RateTableVersion.insurer_id == insurer_id)
        if class_of_insurance is not None:
            statement = statement.where(
                RateTableVersion.class_of_insurance == class_of_insurance
            )
        if status is not None:
            statement = statement.where(RateTableVersion.status == status)
        return statement

    def list_versions(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        insurer_id: uuid.UUID | None = None,
        class_of_insurance: str | None = None,
        status: RateTableStatus | None = None,
    ) -> tuple[list[RateTableVersion], int]:
        """List non-deleted RateTableVersions with optional filters and total count."""
        base_stmt = self._base_query(
            insurer_id=insurer_id,
            class_of_insurance=class_of_insurance,
            status=status,
        )
        items_stmt = (
            base_stmt.options(
                selectinload(RateTableVersion.brackets),
                selectinload(RateTableVersion.benefits),
                selectinload(RateTableVersion.medical_tiers),
            )
            .order_by(RateTableVersion.version_number.desc())
            .offset(skip)
            .limit(limit)
        )
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        items = list(self.session.exec(items_stmt).all())
        count = self.session.exec(count_stmt).one()
        return items, count

    def update_version(
        self,
        rate_table_id: uuid.UUID,
        rate_table_in: RateTableVersionUpdate,
    ) -> RateTableVersion:
        """Update draft metadata or transition RateTableVersion status atomically."""
        db_rate_table = self.get_version(rate_table_id)
        update_data = rate_table_in.model_dump(exclude_unset=True)

        new_status = update_data.get("status")
        if new_status is not None and new_status != db_rate_table.status:
            allowed = self._ALLOWED_STATUS_TRANSITIONS.get(
                db_rate_table.status, set()
            )
            if new_status not in allowed:
                raise RateTableConflictError(
                    f"Invalid status transition from '{db_rate_table.status.value}' "
                    f"to '{new_status.value}'."
                )

        non_status_fields = {k for k in update_data if k != "status"}
        if non_status_fields and db_rate_table.status != RateTableStatus.DRAFT:
            raise RateTableConflictError(
                f"Rate table version in '{db_rate_table.status.value}' status "
                "cannot be edited; only 'draft' versions are mutable."
            )

        db_rate_table.sqlmodel_update(update_data)
        self.session.add(db_rate_table)
        self.session.commit()
        self.session.refresh(db_rate_table)
        return db_rate_table

    def _require_draft_version(self, rate_table_id: uuid.UUID) -> RateTableVersion:
        db_rate_table = self.get_version(rate_table_id)
        if db_rate_table.status != RateTableStatus.DRAFT:
            raise RateTableConflictError(
                f"Rate table version in '{db_rate_table.status.value}' status "
                "cannot be modified; only 'draft' versions are mutable."
            )
        return db_rate_table

    def _add_child(
        self, rate_table_id: uuid.UUID, model_cls: type, child_in: Any
    ) -> Any:
        self._require_draft_version(rate_table_id)
        payload = child_in.model_copy(update={"rate_table_version_id": rate_table_id})
        db_obj = model_cls.model_validate(payload)
        self.session.add(db_obj)
        self.session.commit()
        self.session.refresh(db_obj)
        return db_obj

    def add_bracket(
        self, rate_table_id: uuid.UUID, bracket_in: RateBracketCreate
    ) -> RateBracket:
        """Add a RateBracket to a draft RateTableVersion atomically."""
        return self._add_child(rate_table_id, RateBracket, bracket_in)

    def add_benefit(
        self, rate_table_id: uuid.UUID, benefit_in: RateBenefitCreate
    ) -> RateBenefit:
        """Add a RateBenefit to a draft RateTableVersion atomically."""
        return self._add_child(rate_table_id, RateBenefit, benefit_in)

    def add_medical_tier(
        self, rate_table_id: uuid.UUID, tier_in: MedicalTierCreate
    ) -> MedicalTier:
        """Add a MedicalTier to a draft RateTableVersion atomically."""
        return self._add_child(rate_table_id, MedicalTier, tier_in)
