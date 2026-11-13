from sqlmodel import Session, create_engine

from app.core.config import settings
from app.models import UserCreate
from app.services.user import user_service

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# Ensure all SQLModel models are imported (app.models) before initializing DB
# so relationships resolve properly.


def init_db(session: Session) -> None:
    user = user_service.get_user_by_email(
        session=session, email=settings.FIRST_SUPERUSER
    )
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user_service.create_user(session=session, user_create=user_in)
