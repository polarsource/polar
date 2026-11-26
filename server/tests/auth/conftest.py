from collections.abc import AsyncIterator

import httpx2
import pytest
from fastapi import FastAPI

from polar.postgres import AsyncSession
from tests.fixtures.base import IsolatedSessionTestClient


@pytest.fixture
async def login_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx2.AsyncClient]:
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx2.ASGITransport(app=app),
        base_url="http://127.0.0.1",
    ) as client:
        yield client
