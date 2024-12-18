from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient

from polar.app import app as polar_app
from polar.auth.dependencies import _auth_subject_factory_cache
from polar.auth.models import AuthSubject, Subject
from polar.checkout.ip_geolocation import _get_client_dependency
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis


@pytest_asyncio.fixture
async def app(
    auth_subject: AuthSubject[Subject],
    session: AsyncSession,
    redis: Redis,
) -> AsyncGenerator[FastAPI]:
    polar_app.dependency_overrides[get_db_session] = lambda: session
    polar_app.dependency_overrides[get_redis] = lambda: redis
    polar_app.dependency_overrides[_get_client_dependency] = lambda: None
    for auth_subject_getter in _auth_subject_factory_cache.values():
        polar_app.dependency_overrides[auth_subject_getter] = lambda: auth_subject

    yield polar_app

    polar_app.dependency_overrides.pop(get_db_session)


@pytest_asyncio.fixture
async def client(
    app: FastAPI, request: pytest.FixtureRequest, session: AsyncSession
) -> AsyncGenerator[AsyncClient, None]:
    request_hooks = []

    async def expunge_hook(request: Any) -> None:
        session.expunge_all()
        return None

    # add @pytest.mark.http_auto_expunge() to a test to add auto-expunging on the first
    # httpx request.
    #
    # This should only be used if the test doesn't use "session" directly, and only makes
    # a single HTTP request.
    auto_expunge_marker = request.node.get_closest_marker("http_auto_expunge")
    if auto_expunge_marker is not None:
        # can be disabled with @pytest.mark.http_auto_expunge(False)
        if auto_expunge_marker.args != (False,):
            request_hooks.append(expunge_hook)

    async with AsyncClient(
        app=app,
        base_url="http://test",
        event_hooks={"request": request_hooks},
    ) as client:
        client.event_hooks

        yield client
