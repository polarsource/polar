import pytest

from polar.kit.db.postgres import AsyncSession
from polar.redis import Redis
from scripts.seeds_load import create_seed_data


@pytest.mark.asyncio
class TestSeedsLoad:
    async def test_create_seed_data(
        self,
        session: AsyncSession,
        redis: Redis,
    ) -> None:
        await create_seed_data(session, redis)
