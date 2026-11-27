import pytest

pytest_plugins = ["tests.redis"]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
