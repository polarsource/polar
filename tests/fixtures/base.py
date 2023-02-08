from typing import AsyncGenerator

import pytest
from httpx import AsyncClient

from polar.api.deps import get_db_session
from polar.app import app
from polar.models import Model
from polar.postgres import AsyncSession, AsyncSessionLocal, engine
from tests.fixtures.webhook import TestWebhookFactory


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
async def initialize_test_database() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)

    async with engine.begin() as conn:
        await conn.run_sync(Model.metadata.create_all)


@pytest.fixture()
async def session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture()
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db_session() -> None:
        async with AsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db_session

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture()
async def github_webhook(
    client: AsyncClient,
) -> AsyncGenerator[TestWebhookFactory, None]:
    factory = TestWebhookFactory(client)
    yield factory
