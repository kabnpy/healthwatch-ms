import uuid
from typing import Any

from sqlmodel import Session, func, select

from app.models import (
    Insurer,
    InsurerCreate,
    InsurerUpdate,
    Product,
    ProductCreate,
    ProductUpdate,
    get_datetime_utc,
)


class CatalogError(Exception):
    """Base domain error for Catalog operations."""


class CatalogNotFoundError(CatalogError):
    """Raised when a requested Insurer or Product does not exist."""


class CatalogConflictError(CatalogError):
    """Raised when a Catalog uniqueness invariant is violated."""


class CatalogService:
    """Domain service owning Insurer and Product persistence."""

    # ==========================================
    # Insurer Operations
    # ==========================================

    @staticmethod
    def create_insurer(*, session: Session, insurer_in: InsurerCreate) -> Insurer:
        """Create a new Insurer, enforcing name uniqueness among active insurers."""
        existing = CatalogService.get_insurer_by_name(
            session=session, name=insurer_in.name
        )
        if existing:
            raise CatalogConflictError(
                "The insurer with this name already exists in the system."
            )
        db_obj = Insurer.model_validate(insurer_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def get_insurer(*, session: Session, insurer_id: uuid.UUID) -> Insurer | None:
        """Return an active (non-deleted) Insurer by ID, or None."""
        statement = select(Insurer).where(
            Insurer.id == insurer_id, Insurer.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def get_insurer_or_raise(*, session: Session, insurer_id: uuid.UUID) -> Insurer:
        """Return an active Insurer by ID or raise CatalogNotFoundError."""
        insurer = CatalogService.get_insurer(session=session, insurer_id=insurer_id)
        if not insurer:
            raise CatalogNotFoundError("Insurer not found")
        return insurer

    @staticmethod
    def get_insurer_by_name(*, session: Session, name: str) -> Insurer | None:
        """Return an active Insurer by name, or None."""
        statement = select(Insurer).where(
            Insurer.name == name, Insurer.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def list_insurers(
        *, session: Session, skip: int = 0, limit: int = 100
    ) -> tuple[list[Insurer], int]:
        """Return paginated active Insurers and total count."""
        base = select(Insurer).where(Insurer.deleted_at.is_(None))
        count = session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(session.exec(base.offset(skip).limit(limit)).all())
        return items, count

    @staticmethod
    def update_insurer(
        *, session: Session, insurer_id: uuid.UUID, insurer_in: InsurerUpdate
    ) -> Insurer:
        """Update an active Insurer."""
        db_insurer = CatalogService.get_insurer_or_raise(
            session=session, insurer_id=insurer_id
        )
        insurer_data = insurer_in.model_dump(exclude_unset=True)
        db_insurer.sqlmodel_update(insurer_data)
        session.add(db_insurer)
        session.commit()
        session.refresh(db_insurer)
        return db_insurer

    @staticmethod
    def delete_insurer(*, session: Session, insurer_id: uuid.UUID) -> None:
        """Soft-delete an active Insurer."""
        db_insurer = CatalogService.get_insurer_or_raise(
            session=session, insurer_id=insurer_id
        )
        db_insurer.deleted_at = get_datetime_utc()
        session.add(db_insurer)
        session.commit()

    # ==========================================
    # Product Operations
    # ==========================================

    @staticmethod
    def _product_base_query(insurer_id: uuid.UUID | None = None) -> Any:
        statement = select(Product).where(Product.deleted_at.is_(None))
        if insurer_id is not None:
            statement = statement.where(Product.insurer_id == insurer_id)
        return statement

    @staticmethod
    def create_product(*, session: Session, product_in: ProductCreate) -> Product:
        """Create a new Product, enforcing name uniqueness per insurer."""
        existing = CatalogService.get_product_by_name(
            session=session, name=product_in.name
        )
        if existing and existing.insurer_id == product_in.insurer_id:
            raise CatalogConflictError(
                "The product with this name already exists for this insurer."
            )
        db_obj = Product.model_validate(product_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def get_product(*, session: Session, product_id: uuid.UUID) -> Product | None:
        """Return an active (non-deleted) Product by ID, or None."""
        statement = select(Product).where(
            Product.id == product_id, Product.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def get_product_or_raise(*, session: Session, product_id: uuid.UUID) -> Product:
        """Return an active Product by ID or raise CatalogNotFoundError."""
        product = CatalogService.get_product(session=session, product_id=product_id)
        if not product:
            raise CatalogNotFoundError("Product not found")
        return product

    @staticmethod
    def get_product_by_name(*, session: Session, name: str) -> Product | None:
        """Return an active Product by name, or None."""
        statement = select(Product).where(
            Product.name == name, Product.deleted_at.is_(None)
        )
        return session.exec(statement).first()

    @staticmethod
    def list_products(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        insurer_id: uuid.UUID | None = None,
    ) -> tuple[list[Product], int]:
        """Return paginated active Products (optionally filtered by insurer_id) and total count."""
        base = CatalogService._product_base_query(insurer_id=insurer_id)
        count = session.exec(select(func.count()).select_from(base.subquery())).one()
        items = list(session.exec(base.offset(skip).limit(limit)).all())
        return items, count

    @staticmethod
    def update_product(
        *, session: Session, product_id: uuid.UUID, product_in: ProductUpdate
    ) -> Product:
        """Update an active Product."""
        db_product = CatalogService.get_product_or_raise(
            session=session, product_id=product_id
        )
        product_data = product_in.model_dump(exclude_unset=True)
        db_product.sqlmodel_update(product_data)
        session.add(db_product)
        session.commit()
        session.refresh(db_product)
        return db_product

    @staticmethod
    def delete_product(*, session: Session, product_id: uuid.UUID) -> None:
        """Soft-delete an active Product."""
        db_product = CatalogService.get_product_or_raise(
            session=session, product_id=product_id
        )
        db_product.deleted_at = get_datetime_utc()
        session.add(db_product)
        session.commit()


catalog_service = CatalogService()
