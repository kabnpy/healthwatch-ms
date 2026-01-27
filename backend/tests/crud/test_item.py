from sqlmodel import Session

from app import crud
from app.models import ItemCreate, ItemUpdate
from tests.utils.item import create_random_item
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def test_create_item(db: Session) -> None:
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    user = create_random_user(db)
    assert user.id is not None
    item = crud.create_item(session=db, item_in=item_in, owner_id=user.id)
    assert item.title == title
    assert item.description == description
    assert item.owner_id == user.id


def test_get_item(db: Session) -> None:
    item = create_random_item(db)
    stored_item = crud.get_item(session=db, id=item.id)
    assert stored_item
    assert item.id == stored_item.id
    assert item.title == stored_item.title
    assert item.description == stored_item.description
    assert item.owner_id == stored_item.owner_id


def test_update_item(db: Session) -> None:
    item = create_random_item(db)
    description2 = random_lower_string()
    item_update = ItemUpdate(description=description2)
    updated_item = crud.update_item(session=db, db_item=item, item_in=item_update)
    assert updated_item.id == item.id
    assert updated_item.title == item.title
    assert updated_item.description == description2
    assert updated_item.owner_id == item.owner_id


def test_delete_item(db: Session) -> None:
    item = create_random_item(db)
    crud.delete_item(session=db, id=item.id)
    deleted_item = crud.get_item(session=db, id=item.id)
    assert deleted_item is None
