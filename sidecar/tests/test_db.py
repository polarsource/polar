import pytest
from sqlalchemy import text

from polar.config import SQLITE_BUSY_TIMEOUT_MS
from polar.db import engine


@pytest.mark.asyncio
async def test_sqlite_pragmas_applied_on_connect() -> None:
    async with engine.connect() as connection:
        journal_mode = (await connection.execute(text("PRAGMA journal_mode"))).scalar()
        busy_timeout = (await connection.execute(text("PRAGMA busy_timeout"))).scalar()

    assert journal_mode == "wal"
    assert busy_timeout == SQLITE_BUSY_TIMEOUT_MS
