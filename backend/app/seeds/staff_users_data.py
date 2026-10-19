"""
Staff Users Seed Data.
Seeds staff users across all five UserRole permissions:
Admin, Underwriter, Cashier, Operations, Viewer.
"""

import logging
from typing import Any

from sqlmodel import Session, select

from app import crud
from app.models import User, UserCreate, UserRole

logger = logging.getLogger(__name__)

STAFF_USERS_DATA: list[dict[str, Any]] = [
    {
        "email": "admin@healthwatch.co.ke",
        "full_name": "Antony Gitonga - Managing Director",
        "role": UserRole.ADMIN,
        "is_superuser": True,
        "password": "changethis123",
    },
    {
        "email": "underwriter@healthwatch.co.ke",
        "full_name": "Grace Muthoni - Senior Underwriter",
        "role": UserRole.UNDERWRITER,
        "is_superuser": False,
        "password": "changethis123",
    },
    {
        "email": "cashier@healthwatch.co.ke",
        "full_name": "Kelvin Mwangi - Finance & Cashier",
        "role": UserRole.CASHIER,
        "is_superuser": False,
        "password": "changethis123",
    },
    {
        "email": "operations@healthwatch.co.ke",
        "full_name": "Daniel Otieno - Operations Manager",
        "role": UserRole.OPERATIONS,
        "is_superuser": False,
        "password": "changethis123",
    },
    {
        "email": "auditor@healthwatch.co.ke",
        "full_name": "Sarah Chebet - Compliance Auditor",
        "role": UserRole.VIEWER,
        "is_superuser": False,
        "password": "changethis123",
    },
]


def seed_staff_users(session: Session) -> dict[str, User]:
    """Idempotently seed staff user accounts for the admin and RBAC views."""
    users_by_email: dict[str, User] = {}

    for u_data in STAFF_USERS_DATA:
        email = u_data["email"]
        user = session.exec(select(User).where(User.email == email)).first()

        if not user:
            user_in = UserCreate(
                email=email,
                full_name=u_data["full_name"],
                role=u_data["role"],
                is_superuser=u_data["is_superuser"],
                password=u_data["password"],
            )
            user = crud.create_user(session=session, user_create=user_in)
            logger.info(f"Created staff user: {user.full_name} ({user.role.value})")
        else:
            user.full_name = u_data["full_name"]
            user.role = u_data["role"]
            user.is_superuser = u_data["is_superuser"]
            session.add(user)
            session.commit()
            session.refresh(user)

        users_by_email[email] = user

    return users_by_email
