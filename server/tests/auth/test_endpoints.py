from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient
from reauth.amr import AuthenticationMethodReference
from reauth.crypto import generate_token_hash_pair

from polar.auth.authentication_session import TOKEN_PREFIX
from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession, User
from polar.postgres import AsyncSession
from tests.fixtures.auth import make_session_stale
from tests.fixtures.base import IsolatedSessionTestClient
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def cookie_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx.AsyncClient]:
    # https://test matches the Secure session cookies' domain
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx.ASGITransport(app=app),
        base_url="https://test",
    ) as client:
        yield client


async def create_completable_authentication_session(
    save_fixture: SaveFixture, user: User
) -> str:
    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    authentication_session = AuthenticationSession(
        token_hash=token_hash,
        expires_at=int(utc_now().timestamp()) + 900,
        step=1,
        authentication_method_references=[AuthenticationMethodReference.EMAIL],
        used_factors=["email_otp"],
        context=None,
        identity_id=user.id,
    )
    await save_fixture(authentication_session)
    return token


@pytest.mark.asyncio
class TestComplete:
    async def test_anonymous(self, cookie_client: httpx.AsyncClient) -> None:
        response = await cookie_client.get("/v1/auth/complete")

        assert response.status_code == 401
        assert response.json()["error"] == "InvalidAuthenticationSession"

    async def test_valid(
        self,
        cookie_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        token = await create_completable_authentication_session(save_fixture, user)
        cookie_client.cookies.set(settings.AUTHENTICATION_SESSION_COOKIE_KEY, token)

        response = await cookie_client.get("/v1/auth/complete")

        assert response.status_code == 303
        assert settings.USER_SESSION_COOKIE_KEY in response.cookies

    @pytest.mark.auth
    async def test_replay_with_user_session(
        self,
        cookie_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        token = await create_completable_authentication_session(save_fixture, user)
        cookie_client.cookies.set(settings.AUTHENTICATION_SESSION_COOKIE_KEY, token)

        first = await cookie_client.get("/v1/auth/complete")
        assert first.status_code == 303

        cookie_client.cookies.clear()
        replay = await cookie_client.get("/v1/auth/complete")

        assert replay.status_code == 303
        assert replay.headers["location"] == settings.generate_frontend_url(
            settings.FRONTEND_DEFAULT_RETURN_PATH
        )


@pytest.mark.asyncio
class TestTOTPEnroll:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/totp")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post("/v1/auth/totp")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/totp")

        assert response.status_code == 201
        json = response.json()
        assert json["secret"]
        assert json["provisioning_uri"]


@pytest.mark.asyncio
class TestTOTPEnable:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post("/v1/auth/totp/enable", json={"code": "123456"})

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session_not_enrolled(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/totp/enable", json={"code": "123456"})

        assert response.status_code == 403
        assert response.json()["error"] != "SessionNotFreshError"


@pytest.mark.asyncio
class TestTOTPDelete:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.delete("/v1/auth/totp")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session_not_enrolled(self, client: AsyncClient) -> None:
        response = await client.delete("/v1/auth/totp")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestBackupCodesEnroll:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 201
        assert len(response.json()["codes"]) > 0
