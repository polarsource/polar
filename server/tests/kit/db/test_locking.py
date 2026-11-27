import pytest
from sqlalchemy import text

from polar.kit.db.locking import pg_advisory_xact_lock, pg_advisory_xact_locks
from polar.postgres import AsyncSession


async def count_advisory_locks(session: AsyncSession) -> int:
    result = await session.execute(
        text(
            "SELECT count(*) FROM pg_locks "
            "WHERE locktype = 'advisory' AND pid = pg_backend_pid()"
        )
    )
    return result.scalar_one()


@pytest.mark.anyio
class TestPgAdvisoryXactLocks:
    async def test_takes_the_single_key_locks(self, session: AsyncSession) -> None:
        await pg_advisory_xact_locks(session, "namespace", ["a", "b"])
        assert await count_advisory_locks(session) == 2

        await pg_advisory_xact_lock(session, "namespace", "a")
        await pg_advisory_xact_lock(session, "namespace", "b")

        assert await count_advisory_locks(session) == 2
