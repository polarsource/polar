import collections.abc

import pytest
from httpx2 import ASGITransport, AsyncClient
from starlette.types import Receive, Scope, Send

from outpost import app


@pytest.fixture
async def client() -> collections.abc.AsyncGenerator[AsyncClient]:
    async with app.router.lifespan_context(app) as state:

        async def app_with_state(scope: Scope, receive: Receive, send: Send) -> None:
            scope["state"] = dict(state or {})
            await app(scope, receive, send)

        async with AsyncClient(
            base_url="http://testserver", transport=ASGITransport(app_with_state)
        ) as client:
            yield client
