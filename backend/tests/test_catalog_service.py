import uuid

import pytest
from sqlmodel import Session

from app.models import InsurerCreate, InsurerUpdate, ProductCreate, ProductUpdate
from app.services.catalog import (
    CatalogConflictError,
    CatalogNotFoundError,
    catalog_service,
)
from tests.utils.utils import random_email, random_lower_string


def test_catalog_insurer_lifecycle_and_soft_delete(db: Session) -> None:
    insurer_in = InsurerCreate(
        name=f"Insurer-{uuid.uuid4().hex[:8]}",
        email=random_email(),
    )
    created = catalog_service.create_insurer(session=db, insurer_in=insurer_in)
    assert created.name == insurer_in.name

    with pytest.raises(CatalogConflictError):
        catalog_service.create_insurer(session=db, insurer_in=insurer_in)

    fetched = catalog_service.get_insurer(session=db, insurer_id=created.id)
    assert fetched is not None
    assert fetched.id == created.id

    by_name = catalog_service.get_insurer_by_name(session=db, name=insurer_in.name)
    assert by_name is not None
    assert by_name.id == created.id

    updated = catalog_service.update_insurer(
        session=db,
        insurer_id=created.id,
        insurer_in=InsurerUpdate(phone="+254711111111"),
    )
    assert updated.phone == "+254711111111"

    insurers, total = catalog_service.list_insurers(session=db, skip=0, limit=100)
    assert any(i.id == created.id for i in insurers)
    assert total >= 1

    catalog_service.delete_insurer(session=db, insurer_id=created.id)
    assert catalog_service.get_insurer(session=db, insurer_id=created.id) is None
    assert (
        catalog_service.get_insurer_by_name(session=db, name=insurer_in.name) is None
    )

    with pytest.raises(CatalogNotFoundError):
        catalog_service.delete_insurer(session=db, insurer_id=created.id)


def test_catalog_product_lifecycle_and_filters(db: Session) -> None:
    insurer1 = catalog_service.create_insurer(
        session=db,
        insurer_in=InsurerCreate(
            name=f"Ins1-{uuid.uuid4().hex[:8]}", email=random_email()
        ),
    )
    insurer2 = catalog_service.create_insurer(
        session=db,
        insurer_in=InsurerCreate(
            name=f"Ins2-{uuid.uuid4().hex[:8]}", email=random_email()
        ),
    )

    product_name = f"Motor-{random_lower_string()}"
    p1 = catalog_service.create_product(
        session=db,
        product_in=ProductCreate(
            insurer_id=insurer1.id,
            name=product_name,
            class_of_insurance="Motor Private",
        ),
    )
    assert p1.insurer_id == insurer1.id

    # Same name for same insurer -> CatalogConflictError
    with pytest.raises(CatalogConflictError):
        catalog_service.create_product(
            session=db,
            product_in=ProductCreate(
                insurer_id=insurer1.id,
                name=product_name,
                class_of_insurance="Motor Private",
            ),
        )

    # Filter by insurer_id
    p2 = catalog_service.create_product(
        session=db,
        product_in=ProductCreate(
            insurer_id=insurer2.id,
            name=f"Medical-{random_lower_string()}",
            class_of_insurance="Medical",
        ),
    )
    items, count = catalog_service.list_products(
        session=db, insurer_id=insurer1.id
    )
    assert count == 1
    assert items[0].id == p1.id
    assert all(p.id != p2.id for p in items)

    updated = catalog_service.update_product(
        session=db,
        product_id=p1.id,
        product_in=ProductUpdate(name=f"Updated-{product_name}"),
    )
    assert updated.name == f"Updated-{product_name}"

    catalog_service.delete_product(session=db, product_id=p1.id)
    assert catalog_service.get_product(session=db, product_id=p1.id) is None

    with pytest.raises(CatalogNotFoundError):
        catalog_service.update_product(
            session=db,
            product_id=p1.id,
            product_in=ProductUpdate(name="Nope"),
        )
