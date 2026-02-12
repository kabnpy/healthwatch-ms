import pytest


@pytest.fixture(scope="session", autouse=True)
def db():
    return None
