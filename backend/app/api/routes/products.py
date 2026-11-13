import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep, StaffUser
from app.models import (
    Message,
    ProductCreate,
    ProductPublic,
    ProductsPublic,
    ProductUpdate,
)
from app.services.catalog import (
    CatalogConflictError,
    CatalogNotFoundError,
    catalog_service,
)

router = APIRouter()


@router.get("/", response_model=ProductsPublic)
def read_products(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    insurer_id: uuid.UUID | None = None,
) -> Any:
    """
    Retrieve products.
    """
    products, count = catalog_service.list_products(
        session=session, skip=skip, limit=limit, insurer_id=insurer_id
    )
    return ProductsPublic(data=products, count=count)


@router.get("/{id}", response_model=ProductPublic)
def read_product(session: SessionDep, _current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get product by ID.
    """
    try:
        return catalog_service.get_product_or_raise(session=session, product_id=id)
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", response_model=ProductPublic)
def create_product(
    *, session: SessionDep, _current_user: StaffUser, product_in: ProductCreate
) -> Any:
    """
    Create new product.
    """
    try:
        return catalog_service.create_product(session=session, product_in=product_in)
    except CatalogConflictError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{id}", response_model=ProductPublic)
def update_product(
    *,
    session: SessionDep,
    _current_user: StaffUser,
    id: uuid.UUID,
    product_in: ProductUpdate,
) -> Any:
    """
    Update a product.
    """
    try:
        return catalog_service.update_product(
            session=session, product_id=id, product_in=product_in
        )
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{id}", response_model=Message)
def delete_product(session: SessionDep, _current_user: StaffUser, id: uuid.UUID) -> Any:
    """
    Delete a product.
    """
    try:
        catalog_service.delete_product(session=session, product_id=id)
    except CatalogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Message(message="Product deleted successfully")
