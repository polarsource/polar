"""Test configuration for backoffice tests."""

from collections.abc import AsyncGenerator

import httpx
import pytest_asyncio
from fastapi import FastAPI

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import User
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from tests.fixtures.random_objects import SaveFixture, create_user


@pytest_asyncio.fixture
async def admin_user(save_fixture: SaveFixture) -> User:
    """Create an admin user for backoffice tests."""
    user = await create_user(save_fixture)
    user.is_admin = True
    await save_fixture(user)
    return user


@pytest_asyncio.fixture
async def backoffice_client(
    admin_user: User, session: AsyncSession, redis: Redis
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create a test client specifically for the backoffice app."""
    # Override dependencies for the backoffice app
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_redis] = lambda: redis
    
    # Mock the admin authentication
    mock_session = UserSession(user=admin_user, user_id=admin_user.id)
    backoffice_app.dependency_overrides[get_admin] = lambda: mock_session

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=backoffice_app),
        base_url="http://test",
    ) as client:
        yield client

    # Clean up overrides
    backoffice_app.dependency_overrides.clear()
