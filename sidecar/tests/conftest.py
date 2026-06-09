import os
import tempfile

_db_dir = tempfile.mkdtemp(prefix="sidecar-test-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db_dir}/test.db"
os.environ.pop("POLAR_ACCESS_TOKEN", None)

from collections.abc import AsyncIterator  # noqa: E402

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402

from polar.app import app  # noqa: E402
from polar.config import DATABASE_URL  # noqa: E402
from polar.db import Base, get_db_session  # noqa: E402


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as setup_connection:
        await setup_connection.run_sync(Base.metadata.create_all)

    connection = await engine.connect()
    transaction = await connection.begin()
    db_session = AsyncSession(bind=connection, expire_on_commit=False)

    yield db_session

    await transaction.rollback()
    await connection.close()
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    app.dependency_overrides[get_db_session] = lambda: session
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db_session, None)
