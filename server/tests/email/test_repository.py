from datetime import timedelta

import pytest

from polar.email.repository import EmailLogRepository
from polar.kit.utils import utc_now
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_email_log


@pytest.mark.asyncio
class TestDeleteBefore:
    async def test_deletes_only_logs_created_before_cutoff(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        cutoff = utc_now() - timedelta(days=30)
        old = await create_email_log(
            save_fixture, created_at=cutoff - timedelta(days=1)
        )
        recent = await create_email_log(
            save_fixture, created_at=cutoff + timedelta(days=1)
        )

        repository = EmailLogRepository.from_session(session)
        await repository.delete_before(cutoff)

        assert await repository.get_by_id(old.id) is None
        assert await repository.get_by_id(recent.id) is not None
