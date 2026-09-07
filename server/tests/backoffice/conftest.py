import time
from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from pytest_mock import MockerFixture

from polar.app import create_app
from polar.backoffice import app as backoffice_app
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.models import OAuth2Client, OAuth2Token, User
from polar.oauth2.sub_type import SubType
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.redis import Redis, get_redis
from tests.fixtures.database import SaveFixture

PRIVATE_URL = "https://backoffice.example.ts.net"


@pytest.fixture
def private_app(mocker: MockerFixture, session: AsyncSession, redis: Redis) -> FastAPI:
    mocker.patch.object(settings, "BACKOFFICE_PRIVATE_URL", PRIVATE_URL)
    mocker.patch.object(settings, "BACKOFFICE_OAUTH_CLIENT_ID", "backoffice-client")
    mocker.patch.object(settings, "BACKOFFICE_MODE", "private")
    app = create_app()
    for target in (app, backoffice_app):
        mocker.patch.dict(
            target.dependency_overrides,
            {
                get_db_session: lambda: session,
                get_db_read_session: lambda: session,
                get_redis: lambda: redis,
            },
        )
    return app


@pytest_asyncio.fixture
async def private_client(private_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=private_app, client=("127.0.0.1", 12345)),
        base_url=PRIVATE_URL,
        headers={"Tailscale-User-Login": "admin@example.com", "Origin": PRIVATE_URL},
    ) as client:
        yield client


@pytest_asyncio.fixture
async def admin_token(user: User, save_fixture: SaveFixture) -> OAuth2Token:
    user.email = "admin@example.com"
    user.is_admin = True
    await save_fixture(user)
    client = OAuth2Client(
        client_id="backoffice-client",
        client_secret="unused",
        registration_access_token="unused",
    )
    client.set_client_metadata(
        {
            "redirect_uris": [f"{PRIVATE_URL}/auth/callback"],
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code"],
            "response_types": ["code"],
            "scope": "openid email",
            "client_name": "Backoffice",
        }
    )
    await save_fixture(client)
    token = OAuth2Token(
        client_id=client.client_id,
        user=user,
        sub_type=SubType.user,
        token_type="bearer",
        scope="openid email",
        access_token=get_token_hash("backoffice-token", secret=settings.SECRET),
        issued_at=int(time.time()),
        expires_in=3600,
    )
    await save_fixture(token)
    return token


@pytest_asyncio.fixture
async def public_client(
    private_app: FastAPI,
    mocker: MockerFixture,
    session: AsyncSession,
    redis: Redis,
    request: pytest.FixtureRequest,
) -> AsyncIterator[httpx.AsyncClient]:
    mocker.patch.object(
        settings, "BACKOFFICE_MODE", getattr(request, "param", "disabled")
    )
    mocker.patch.object(settings, "BASE_URL", "https://api.polar.sh")
    mocker.patch.object(settings, "FRONTEND_BASE_URL", "https://polar.sh")
    mocker.patch.object(settings, "USER_SESSION_COOKIE_DOMAIN", "polar.sh")
    app = create_app()
    app.dependency_overrides[get_db_session] = lambda: session
    app.dependency_overrides[get_redis] = lambda: redis
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://api.polar.sh"
    ) as client:
        yield client
