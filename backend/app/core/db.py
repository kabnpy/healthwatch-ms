from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.models import User, UserCreate

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# Ensure all SQLModel models are imported (app.models) before initializing DB
# so relationships resolve properly.


def init_db(session: Session) -> None:
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        from app import crud

        user = crud.create_user(session=session, user_create=user_in)
