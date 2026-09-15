import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncConnection

from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import AsyncSession
from polar.void.postgres import get_snapshot_session


@pytest.mark.asyncio
async def test_snapshot_starts_fresh_primary_transaction_after_request_reads(
    session: AsyncSession,
) -> None:
    await session.execute(select(1))
    assert isinstance(session.bind, AsyncConnection)
    sessionmaker = create_async_sessionmaker(session.bind.engine)
    snapshots = get_snapshot_session(sessionmaker)
    snapshot = await anext(snapshots)
    try:
        assert snapshot is not session
        connection = await snapshot.connection()
        assert await connection.get_isolation_level() == "REPEATABLE READ"
        initial = await snapshot.scalar(select(func.txid_current_snapshot()))
        async with sessionmaker() as writer:
            await writer.scalar(select(func.txid_current()))
            await writer.commit()
        assert await snapshot.scalar(select(func.txid_current_snapshot())) == initial
        assert await session.bind.get_isolation_level() == "READ COMMITTED"
    finally:
        await anext(snapshots, None)
