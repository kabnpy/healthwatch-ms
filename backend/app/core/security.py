from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

# Argon2 is used for new hashes; bcrypt is kept so existing hashes still verify.
password_hash = PasswordHash(
    (
        Argon2Hasher(),
        BcryptHasher(),
    )
)


ALGORITHM = "HS256"


def create_access_token(subject: str | Any, expires_delta: timedelta) -> str:
    """Create a signed JWT access token.

    Args:
        subject: Value stored in the `sub` claim (typically the user id).
        expires_delta: How long the token remains valid.

    Returns:
        The encoded JWT string.
    """
    expire = datetime.now(UTC) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plaintext password against a stored hash.

    Args:
        plain_password: The password supplied by the user.
        hashed_password: The stored Argon2 or bcrypt hash.

    Returns:
        True if the password matches the hash, otherwise False.
    """
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plaintext password.

    Args:
        password: The plaintext password.

    Returns:
        The Argon2 hash of the password.
    """
    return password_hash.hash(password)
