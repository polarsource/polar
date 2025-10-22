from collections.abc import AsyncGenerator
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from polar.app import app as polar_app
from polar.auth.dependencies import _auth_subject_factory_cache
from polar.auth.models import AuthSubject, Subject
from polar.checkout.ip_geolocation import _get_client_dependency
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.redis import Redis, get_redis


class IsolatedSessionTestClient(httpx.AsyncClient):
    """
    Test client that mimics production behavior by clearing session before requests.

    In production, each HTTP request gets a fresh database session. This client
    simulates that by expunging all objects from the test session before each
    request, catching lazy='raise' errors that would otherwise pass in tests.

    Disable for specific tests with @pytest.mark.keep_session_state marker.
    """

    def __init__(
        self, session: AsyncSession, auto_expunge: bool, *args: Any, **kwargs: Any
    ):
        super().__init__(*args, **kwargs)
        self._session = session
        self._auto_expunge = auto_expunge

    async def request(self, *args: Any, **kwargs: Any) -> httpx.Response:
        """Expunge session before each request to simulate production."""
        if self._auto_expunge:
            self._session.expunge_all()
        return await super().request(*args, **kwargs)


@pytest_asyncio.fixture
async def app(
    auth_subject: AuthSubject[Subject], session: AsyncSession, redis: Redis
) -> AsyncGenerator[FastAPI]:
    polar_app.dependency_overrides[get_db_session] = lambda: session
    polar_app.dependency_overrides[get_db_read_session] = lambda: session
    polar_app.dependency_overrides[get_redis] = lambda: redis
    polar_app.dependency_overrides[_get_client_dependency] = lambda: None
    for auth_subject_getter in _auth_subject_factory_cache.values():
        polar_app.dependency_overrides[auth_subject_getter] = lambda: auth_subject

    yield polar_app

    polar_app.dependency_overrides.pop(get_db_session)


@pytest_asyncio.fixture
async def client(
    app: FastAPI, session: AsyncSession, request: pytest.FixtureRequest
) -> AsyncGenerator[httpx.AsyncClient, None]:
    # Check if test wants to keep session state (opt-out)
    keep_state = request.node.get_closest_marker("keep_session_state") is not None
    auto_expunge = not keep_state

    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=auto_expunge,
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
