import pytest_asyncio

from polar.kit.db.postgres import AsyncSession
from tests.fixtures.database import SaveFixture, save_fixture_factory


@pytest_asyncio.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    return save_fixture_factory(session)
