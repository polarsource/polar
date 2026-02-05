from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio

from polar.kit.db.postgres import AsyncSession


@pytest_asyncio.fixture(scope="session", loop_scope="session", autouse=True)
async def initialize_test_database() -> AsyncIterator[None]:
    """Override: eventstream subscribe tests don't need the database."""
    yield


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """Override: provide a mock session so patch_middlewares doesn't hit Postgres."""
    yield AsyncMock(spec=AsyncSession)


@pytest.fixture(autouse=True)
def patch_middlewares() -> None:
    """Override: eventstream tests don't need worker middleware patching."""
    pass
