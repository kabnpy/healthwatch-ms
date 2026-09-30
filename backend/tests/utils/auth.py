from fastapi import FastAPI

from app.api.deps import get_current_user
from app.models import User, UserRole


class MockAuth:
    """
    Helper to mock authentication in FastAPI tests.
    """

    def __init__(self, app: FastAPI):
        self.app = app
        self._original_get_current_user = app.dependency_overrides.get(get_current_user)

    def mock_user(self, user: User):
        """
        Force all endpoints using CurrentUser to use this user.
        """

        async def override_get_current_user():
            return user

        self.app.dependency_overrides[get_current_user] = override_get_current_user
        return self

    def reset(self):
        """
        Clear all authentication overrides.
        """
        if self._original_get_current_user:
            self.app.dependency_overrides[get_current_user] = (
                self._original_get_original_get_current_user
            )
        else:
            self.app.dependency_overrides.pop(get_current_user, None)

        # We might also need to clear require_role overrides if we add any
        # But since require_role depends on CurrentUser, overriding CurrentUser is usually enough.


def get_mock_user(role: UserRole = UserRole.ADMIN, is_superuser: bool = False) -> User:
    """
    Create a mock user object.
    """
    import uuid

    return User(
        id=uuid.uuid4(),
        email="mock@example.com",
        full_name="Mock User",
        role=role,
        is_active=True,
        is_superuser=is_superuser,
    )
