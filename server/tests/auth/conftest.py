from collections.abc import AsyncIterator

import httpx
import pytest_asyncio
from fastapi import FastAPI

from polar.postgres import AsyncSession
from tests.fixtures.base import IsolatedSessionTestClient


@pytest_asyncio.fixture
async def login_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx.AsyncClient]:
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1",
    ) as client:
        yield client
