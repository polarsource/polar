import os
import tempfile

_db_dir = tempfile.mkdtemp(prefix="sidecar-test-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db_dir}/test.db"
os.environ.pop("POLAR_ACCESS_TOKEN", None)

from collections.abc import AsyncIterator  # noqa: E402

import pytest_asyncio  # noqa: E402

from polar.db import Base, engine  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def reset_database() -> AsyncIterator[None]:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield
