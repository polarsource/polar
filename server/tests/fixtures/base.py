from typing import AsyncGenerator

import pytest
from httpx import AsyncClient

from polar.app import app
from polar.postgres import AsyncSession, AsyncSessionLocal, get_db_session


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture()
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db_session() -> None:
        async with AsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db_session

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
