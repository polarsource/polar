import asyncio
from collections.abc import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.app import app
from polar.config import settings
from polar.postgres import AsyncSession, get_db_session

# We used to use anyio, but it was causing garbage collection issues
# with SQLAlchemy (known issue - https://stackoverflow.com/a/74221652)
#
# However, since we're using asyncio, it's clearer and cleaner to use it
# throughout vs. anyio with an asyncio backend. We need to setup the
# event loop though as per:
# https://pytest-asyncio.readthedocs.io/en/latest/reference/fixtures.html


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture()
async def client(
    request: pytest.FixtureRequest, session: AsyncSession, auth_jwt: str
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db_session] = lambda: session

    cookies = {}
    authenticated_marker = request.node.get_closest_marker("authenticated")
    if authenticated_marker is not None:
        cookies[settings.AUTH_COOKIE_KEY] = auth_jwt

    async with AsyncClient(app=app, base_url="http://test", cookies=cookies) as client:
        yield client
