import uuid
from typing import Any

from sqlmodel import Session, col, func, select

from app.models import Item, ItemCreate, ItemUpdate


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def get_item(*, session: Session, id: uuid.UUID) -> Item | None:
    return session.get(Item, id)


def get_items(
    *,
    session: Session,
    owner_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    count_statement = select(func.count()).select_from(Item)
    if owner_id:
        count_statement = count_statement.where(Item.owner_id == owner_id)
    count = session.exec(count_statement).one()

    statement = (
        select(Item).order_by(col(Item.created_at).desc()).offset(skip).limit(limit)
    )
    if owner_id:
        statement = statement.where(Item.owner_id == owner_id)
    items = session.exec(statement).all()

    return items, count


def update_item(*, session: Session, db_item: Item, item_in: ItemUpdate) -> Item:
    update_dict = item_in.model_dump(exclude_unset=True)
    db_item.sqlmodel_update(update_dict)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def delete_item(*, session: Session, id: uuid.UUID) -> None:
    db_item = session.get(Item, id)
    if db_item:
        session.delete(db_item)
        session.commit()
