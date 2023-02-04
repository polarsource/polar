import os
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient
from starlette.testclient import TestClient

os.environ["POLAR_ENV"] = "testing"

from polar.app import app  # noqa: E402
from polar.postgres import AsyncSession, AsyncSessionLocal  # noqa: E402
from scripts.db import _recreate as recreate_database  # noqa: E402
from tests.fixtures.webhook import TestWebhookFactory  # noqa: E402


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture()
async def client(anyio_backend: str) -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture(scope="session", autouse=True)
async def session(anyio_backend: str) -> AsyncGenerator[AsyncSession, None]:
    recreate_database()
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture()
async def github_webhook(
    anyio_backend: str,
    client: TestClient,
) -> AsyncGenerator[TestWebhookFactory, None]:
    factory = TestWebhookFactory(client)
    yield factory
