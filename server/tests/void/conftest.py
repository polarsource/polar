from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.types import Receive, Send
from starlette.types import Scope as ASGIScope

from polar.auth.dependencies import _auth_subject_factory_cache
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.config import settings
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.base import IsolatedSessionTestClient


@pytest.fixture
def enable_void(monkeypatch: pytest.MonkeyPatch, organization: Organization) -> None:
    monkeypatch.setattr(settings, "VOID_ENABLED", True)
    monkeypatch.setattr(settings, "VOID_ORGANIZATION_IDS", {organization.id})


@pytest_asyncio.fixture
async def void_client(
    app: FastAPI, session: AsyncSession, redis: Redis, enable_void: None
) -> AsyncIterator[AsyncClient]:
    overrides = {
        dependency: app.dependency_overrides.pop(dependency)
        for dependency in _auth_subject_factory_cache.values()
        if dependency in app.dependency_overrides
    }
    authenticated_app = AuthSubjectMiddleware(app, redis)

    async def app_with_session(scope: ASGIScope, receive: Receive, send: Send) -> None:
        scope.setdefault("state", {})["async_session"] = session
        await authenticated_app(scope, receive, send)

    try:
        async with IsolatedSessionTestClient(
            session=session,
            auto_expunge=True,
            transport=ASGITransport(app=app_with_session),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        app.dependency_overrides.update(overrides)
