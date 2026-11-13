import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    MedicalTierCreate,
    MedicalTierPublic,
    RateBenefitCreate,
    RateBenefitPublic,
    RateBracketCreate,
    RateBracketPublic,
    RateTableStatus,
    RateTableVersion,
    RateTableVersionCreate,
    RateTableVersionPublic,
    RateTableVersionsPublic,
    RateTableVersionUpdate,
)
from app.services.premium_calculation import (
    create_medical_tier,
    create_rate_benefit,
    create_rate_bracket,
    get_rate_table_version,
)
from app.services.rate_table import (
    RateTableConflictError,
    RateTableNotFoundError,
    RateTableService,
)

router = APIRouter()


def _get_rate_table_or_404(
    session: SessionDep, rate_table_id: uuid.UUID
) -> RateTableVersion:
    db_rate_table = get_rate_table_version(
        session=session, rate_table_id=rate_table_id
    )
    if not db_rate_table or db_rate_table.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Rate table version not found")
    return db_rate_table


def _get_draft_rate_table_or_409(
    session: SessionDep, rate_table_id: uuid.UUID
) -> RateTableVersion:
    db_rate_table = _get_rate_table_or_404(session, rate_table_id)
    if db_rate_table.status != RateTableStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Rate table version in '{db_rate_table.status.value}' status "
                "cannot be modified; only 'draft' versions are mutable."
            ),
        )
    return db_rate_table


@router.get("/", response_model=RateTableVersionsPublic)
def read_rate_tables(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    insurer_id: uuid.UUID | None = None,
    class_of_insurance: str | None = None,
    status: RateTableStatus | None = None,
) -> Any:
    """Retrieve advisory rate table versions with optional filters."""
    rate_tables, count = RateTableService(session).list_versions(
        skip=skip,
        limit=limit,
        insurer_id=insurer_id,
        class_of_insurance=class_of_insurance,
        status=status,
    )
    return RateTableVersionsPublic(data=rate_tables, count=count)


@router.get("/{id}", response_model=RateTableVersionPublic)
def read_rate_table(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """Get single rate table version details with brackets, benefits, and tiers."""
    try:
        return RateTableService(session).get_version(id)
    except RateTableNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/", response_model=RateTableVersionPublic, status_code=status.HTTP_201_CREATED
)
def create_rate_table(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    rate_table_in: RateTableVersionCreate,
) -> Any:
    """Create a new rate table version."""
    return RateTableService(session).create_version(rate_table_in)


@router.patch("/{id}", response_model=RateTableVersionPublic)
def update_rate_table(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    rate_table_in: RateTableVersionUpdate,
) -> Any:
    """Update a rate table version (e.g. activate, archive, update dates)."""
    try:
        return RateTableService(session).update_version(id, rate_table_in)
    except RateTableNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RateTableConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/{id}/brackets",
    response_model=RateBracketPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_rate_bracket(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    bracket_in: RateBracketCreate,
) -> Any:
    """Add a pricing bracket to a rate table version."""
    _get_draft_rate_table_or_409(session, id)
    bracket_in.rate_table_version_id = id
    return create_rate_bracket(session=session, bracket_in=bracket_in)


@router.post(
    "/{id}/benefits",
    response_model=RateBenefitPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_rate_benefit(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    benefit_in: RateBenefitCreate,
) -> Any:
    """Add a benefit/rider rule to a rate table version."""
    _get_draft_rate_table_or_409(session, id)
    benefit_in.rate_table_version_id = id
    return create_rate_benefit(session=session, benefit_in=benefit_in)


@router.post(
    "/{id}/medical-tiers",
    response_model=MedicalTierPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_medical_tier(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    tier_in: MedicalTierCreate,
) -> Any:
    """Add a medical census tier to a rate table version."""
    _get_draft_rate_table_or_409(session, id)
    tier_in.rate_table_version_id = id
    return create_medical_tier(session=session, tier_in=tier_in)
