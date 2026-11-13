import uuid

from sqlmodel import Session, func, select

from app.core.security import get_password_hash, verify_password
from app.models import User, UserCreate, UserUpdate, UserUpdateMe


class UserError(Exception):
    """Base domain error for User operations."""


class UserNotFoundError(UserError):
    """Raised when a requested User does not exist."""


class UserConflictError(UserError):
    """Raised when a User uniqueness invariant (e.g., email) is violated."""


class UserValidationError(UserError):
    """Raised when User input or authentication state validation fails."""


class UserService:
    """Domain service owning User persistence and authentication helpers."""

    @staticmethod
    def get_user_by_id(*, session: Session, user_id: uuid.UUID) -> User | None:
        """Return a User by ID, or None."""
        return session.get(User, user_id)

    @staticmethod
    def get_user_by_email(*, session: Session, email: str) -> User | None:
        """Return a User by email, or None."""
        statement = select(User).where(User.email == email)
        return session.exec(statement).first()

    @staticmethod
    def list_users(
        *, session: Session, skip: int = 0, limit: int = 100
    ) -> tuple[list[User], int]:
        """Return paginated Users and total count."""
        count = session.exec(select(func.count()).select_from(User)).one()
        users = list(session.exec(select(User).offset(skip).limit(limit)).all())
        return users, count

    @staticmethod
    def create_user(*, session: Session, user_create: UserCreate) -> User:
        """Create a new User with a hashed password, enforcing email uniqueness."""
        existing = UserService.get_user_by_email(
            session=session, email=user_create.email
        )
        if existing:
            raise UserConflictError(
                "The user with this email already exists in the system."
            )
        db_obj = User.model_validate(
            user_create,
            update={"hashed_password": get_password_hash(user_create.password)},
        )
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def update_user(
        *,
        session: Session,
        db_user: User,
        user_in: UserUpdate | UserUpdateMe,
    ) -> User:
        """Update a User, enforcing email uniqueness and hashing any new password."""
        user_data = user_in.model_dump(exclude_unset=True)
        email = user_data.get("email")
        if email:
            existing = UserService.get_user_by_email(session=session, email=email)
            if existing and existing.id != db_user.id:
                raise UserConflictError("User with this email already exists")

        extra_data: dict[str, str] = {}
        if "password" in user_data:
            extra_data["hashed_password"] = get_password_hash(user_data["password"])

        db_user.sqlmodel_update(user_data, update=extra_data)
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        return db_user

    @staticmethod
    def update_password(
        *,
        session: Session,
        db_user: User,
        current_password: str,
        new_password: str,
    ) -> None:
        """Update a User's own password after verifying the current password."""
        if not verify_password(current_password, db_user.hashed_password):
            raise UserValidationError("Incorrect password")
        if current_password == new_password:
            raise UserValidationError(
                "New password cannot be the same as the current one"
            )
        db_user.hashed_password = get_password_hash(new_password)
        session.add(db_user)
        session.commit()

    @staticmethod
    def delete_user(*, session: Session, db_user: User) -> None:
        """Delete a User."""
        session.delete(db_user)
        session.commit()

    @staticmethod
    def authenticate(*, session: Session, email: str, password: str) -> User | None:
        """Verify email and password, returning the User if valid or None."""
        db_user = UserService.get_user_by_email(session=session, email=email)
        if not db_user:
            return None
        if not verify_password(password, db_user.hashed_password):
            return None
        return db_user

    @staticmethod
    def reset_password(*, session: Session, email: str, new_password: str) -> User:
        """Reset password for an active User identified by email."""
        db_user = UserService.get_user_by_email(session=session, email=email)
        if not db_user:
            raise UserNotFoundError(
                "The user with this email does not exist in the system."
            )
        if not db_user.is_active:
            raise UserValidationError("Inactive user")
        db_user.hashed_password = get_password_hash(new_password)
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        return db_user


user_service = UserService()
