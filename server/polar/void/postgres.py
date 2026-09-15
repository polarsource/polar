from collections.abc import AsyncIterator

from fastapi import Depends

from polar.kit.db.postgres import AsyncSessionMaker
from polar.postgres import AsyncSession, get_db_sessionmaker


async def get_snapshot_session(
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> AsyncIterator[AsyncSession]:
    async with sessionmaker() as session:
        await session.connection(
            execution_options={"isolation_level": "REPEATABLE READ"}
        )
        yield session
