from collections.abc import AsyncGenerator

import httpx
import pytest_asyncio
from fastapi import FastAPI

from polar.app import app as polar_app
from polar.auth.dependencies import _auth_subject_factory_cache
from polar.auth.models import AuthSubject, Subject
from polar.checkout.ip_geolocation import _get_client_dependency
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.redis import Redis, get_redis


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
async def client(app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
