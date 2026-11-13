import uuid
from datetime import UTC, datetime

import pytest
from sqlmodel import Session

from app.models import (
    Insurer,
    PricingMethod,
    RateTableStatus,
    RateTableVersionCreate,
    RateTableVersionUpdate,
)
from app.services.rate_table import (
    RateTableConflictError,
    RateTableNotFoundError,
    RateTableService,
)


def _create_insurer(db: Session, name: str | None = None) -> Insurer:
    insurer = Insurer(name=name or f"Test Insurer {uuid.uuid4()}")
    db.add(insurer)
    db.commit()
    db.refresh(insurer)
    return insurer


def test_create_and_get_rate_table_version_excludes_soft_deleted(db: Session) -> None:
    insurer = _create_insurer(db)
    service = RateTableService(db)

    created = service.create_version(
        RateTableVersionCreate(
            insurer_id=insurer.id,
            class_of_insurance="Motor Private",
            pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
            currency="KES",
            version_number=1,
            source_reference="Tariff 2026",
        )
    )
    assert created.id is not None
    assert created.status == RateTableStatus.DRAFT

    fetched = service.get_version(created.id)
    assert fetched.id == created.id

    # Soft-delete and verify get_version raises RateTableNotFoundError
    fetched.deleted_at = datetime.now(UTC)
    db.add(fetched)
    db.commit()

    with pytest.raises(RateTableNotFoundError):
        service.get_version(created.id)

    with pytest.raises(RateTableNotFoundError):
        service.get_version(uuid.uuid4())


def test_list_versions_filters_and_excludes_soft_deleted(db: Session) -> None:
    insurer1 = _create_insurer(db, "Insurer One")
    insurer2 = _create_insurer(db, "Insurer Two")
    service = RateTableService(db)

    v1 = service.create_version(
        RateTableVersionCreate(
            insurer_id=insurer1.id,
            class_of_insurance="Motor Private",
            pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
            currency="KES",
            version_number=1,
            source_reference="Tariff 1",
        )
    )
    v2 = service.create_version(
        RateTableVersionCreate(
            insurer_id=insurer1.id,
            class_of_insurance="Motor Private",
            pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
            currency="KES",
            version_number=2,
            source_reference="Tariff 2",
        )
    )
    v3 = service.create_version(
        RateTableVersionCreate(
            insurer_id=insurer2.id,
            class_of_insurance="Medical",
            pricing_method=PricingMethod.FIXED_TIER,
            currency="KES",
            version_number=1,
            source_reference="Tariff 3",
        )
    )

    # Soft-delete v1
    v1.deleted_at = datetime.now(UTC)
    db.add(v1)
    db.commit()

    items, count = service.list_versions(insurer_id=insurer1.id)
    assert count == 1
    assert [item.id for item in items] == [v2.id]

    all_items, total_count = service.list_versions(skip=0, limit=1)
    assert total_count == 2
    assert len(all_items) == 1
    assert v3.id in {v2.id, v3.id}


def test_update_version_transitions_and_draft_only_guards(db: Session) -> None:
    insurer = _create_insurer(db)
    service = RateTableService(db)

    rt = service.create_version(
        RateTableVersionCreate(
            insurer_id=insurer.id,
            class_of_insurance="Motor Private",
            pricing_method=PricingMethod.BRACKETED_PERCENTAGE,
            currency="KES",
            version_number=1,
            source_reference="Initial Tariff",
        )
    )

    # Draft metadata update succeeds
    updated = service.update_version(
        rt.id, RateTableVersionUpdate(source_reference="Updated Tariff")
    )
    assert updated.source_reference == "Updated Tariff"
    assert updated.status == RateTableStatus.DRAFT

    # Invalid transition: draft -> retired
    with pytest.raises(RateTableConflictError):
        service.update_version(
            rt.id, RateTableVersionUpdate(status=RateTableStatus.RETIRED)
        )

    # Valid transition: draft -> published
    published = service.update_version(
        rt.id, RateTableVersionUpdate(status=RateTableStatus.PUBLISHED)
    )
    assert published.status == RateTableStatus.PUBLISHED

    # Non-status metadata edit on published version is rejected
    with pytest.raises(RateTableConflictError):
        service.update_version(
            rt.id, RateTableVersionUpdate(source_reference="Tamper")
        )

    # Invalid transition: published -> draft
    with pytest.raises(RateTableConflictError):
        service.update_version(
            rt.id, RateTableVersionUpdate(status=RateTableStatus.DRAFT)
        )

    # Valid transition: published -> retired
    retired = service.update_version(
        rt.id, RateTableVersionUpdate(status=RateTableStatus.RETIRED)
    )
    assert retired.status == RateTableStatus.RETIRED

    # Invalid transition: retired -> published
    with pytest.raises(RateTableConflictError):
        service.update_version(
            rt.id, RateTableVersionUpdate(status=RateTableStatus.PUBLISHED)
        )

    # Non-existent id raises RateTableNotFoundError
    with pytest.raises(RateTableNotFoundError):
        service.update_version(
            uuid.uuid4(), RateTableVersionUpdate(source_reference="Missing")
        )
