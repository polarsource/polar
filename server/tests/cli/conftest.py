from unittest.mock import AsyncMock

import pytest

from polar.kit.db.postgres import AsyncSession


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Override: CLI tests don't need the database."""


@pytest.fixture
async def session() -> AsyncSession:
    """Override: provide a mock session so patch_middlewares doesn't hit Postgres."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture(autouse=True)
def patch_middlewares() -> None:
    """Override: CLI tests don't need worker middleware patching."""
