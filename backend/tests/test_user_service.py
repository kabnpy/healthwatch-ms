import pytest
from fastapi.encoders import jsonable_encoder
from sqlmodel import Session

from app.core.security import verify_password
from app.models import UserCreate, UserUpdate, UserUpdateMe
from app.services.user import (
    UserConflictError,
    UserNotFoundError,
    UserValidationError,
    user_service,
)
from tests.utils.utils import random_email, random_lower_string


def test_user_create_and_duplicate_email(db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = user_service.create_user(session=db, user_create=user_in)
    assert user.email == email
    assert hasattr(user, "hashed_password")
    assert user.is_active is True
    assert user.is_superuser is False

    with pytest.raises(UserConflictError):
        user_service.create_user(session=db, user_create=user_in)


def test_user_authenticate(db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    user = user_service.create_user(
        session=db, user_create=UserCreate(email=email, password=password)
    )
    authenticated = user_service.authenticate(
        session=db, email=email, password=password
    )
    assert authenticated is not None
    assert authenticated.id == user.id

    assert (
        user_service.authenticate(session=db, email=email, password="wrong-password")
        is None
    )
    assert (
        user_service.authenticate(
            session=db, email=random_email(), password=password
        )
        is None
    )


def test_user_read_list_update_and_delete(db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    user = user_service.create_user(
        session=db,
        user_create=UserCreate(email=email, password=password, is_superuser=True),
    )

    fetched = user_service.get_user_by_id(session=db, user_id=user.id)
    assert fetched is not None
    assert jsonable_encoder(fetched) == jsonable_encoder(user)

    users, total = user_service.list_users(session=db, skip=0, limit=100)
    assert any(u.id == user.id for u in users)
    assert total >= 1

    new_password = random_lower_string()
    updated = user_service.update_user(
        session=db,
        db_user=user,
        user_in=UserUpdate(password=new_password, is_superuser=True),
    )
    assert verify_password(new_password, updated.hashed_password)

    # Duplicate email on update raises UserConflictError
    other = user_service.create_user(
        session=db,
        user_create=UserCreate(email=random_email(), password=random_lower_string()),
    )
    with pytest.raises(UserConflictError):
        user_service.update_user(
            session=db, db_user=user, user_in=UserUpdateMe(email=other.email)
        )

    user_service.delete_user(session=db, db_user=other)
    assert user_service.get_user_by_id(session=db, user_id=other.id) is None


def test_user_update_and_reset_password(db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    user = user_service.create_user(
        session=db, user_create=UserCreate(email=email, password=password)
    )

    with pytest.raises(UserValidationError):
        user_service.update_password(
            session=db,
            db_user=user,
            current_password="wrong",
            new_password="new-password-123",
        )

    with pytest.raises(UserValidationError):
        user_service.update_password(
            session=db,
            db_user=user,
            current_password=password,
            new_password=password,
        )

    new_pw = random_lower_string()
    user_service.update_password(
        session=db, db_user=user, current_password=password, new_password=new_pw
    )
    assert verify_password(new_pw, user.hashed_password)

    reset_pw = random_lower_string()
    user_service.reset_password(session=db, email=email, new_password=reset_pw)
    assert verify_password(reset_pw, user.hashed_password)

    with pytest.raises(UserNotFoundError):
        user_service.reset_password(
            session=db, email=random_email(), new_password=reset_pw
        )
