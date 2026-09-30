from collections.abc import AsyncIterator
from unittest.mock import MagicMock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient
from pytest_mock import MockerFixture
from reauth.amr import AuthenticationMethodReference

from polar.auth.authentication_session import TOKEN_PREFIX
from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession, Organization, User
from polar.postgres import AsyncSession
from tests.auth.oauth2.test_router import create_sso_domain
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
    token, token_hash = generate_token_hash_pair(prefix=TOKEN_PREFIX)
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

    async def test_non_ascii_cookie(self, cookie_client: httpx.AsyncClient) -> None:
        non_ascii_cookie = (
            settings.AUTHENTICATION_SESSION_COOKIE_KEY.encode()
            + b"=token-\xe4\xb8\xad\xe6\x96\x87"
        )
        response = await cookie_client.get(
            "/v1/auth/complete", headers=[(b"cookie", non_ascii_cookie)]
        )

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


async def request_email_otp(
    client: httpx.AsyncClient,
    mocker: MockerFixture,
    email: str,
    *,
    sso_discovery: bool = True,
) -> tuple[httpx.Response, MagicMock]:
    mocker.patch("polar.auth.endpoints.verify_turnstile")
    enqueue_email_template = mocker.patch("polar.auth.factors.enqueue_email_template")

    start = await client.post(
        "/v1/auth/start",
        json={"return_to": "/dashboard", "sso_discovery": sso_discovery},
    )
    assert start.status_code == 201

    response = await client.post(
        "/v1/auth/email-otp/request",
        json={"email": email, "cf-turnstile-response": "turnstile-token"},
    )
    return response, enqueue_email_template


@pytest.mark.asyncio
class TestEmailOTPRequest:
    async def test_without_sso(
        self, login_client: httpx.AsyncClient, mocker: MockerFixture
    ) -> None:
        response, enqueue_email_template = await request_email_otp(
            login_client, mocker, "jane@acme.com"
        )

        assert response.status_code == 202
        enqueue_email_template.assert_called_once()

    @pytest.mark.parametrize(
        "setup",
        [
            {"verified": False},
            {"sso_enforced": False},
            {"connection_enabled": False},
        ],
    )
    async def test_sso_not_enforced_for_domain(
        self,
        setup: dict[str, bool],
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_sso_domain(save_fixture, organization, **setup)

        response, enqueue_email_template = await request_email_otp(
            login_client, mocker, "jane@acme.com"
        )

        assert response.status_code == 202
        enqueue_email_template.assert_called_once()

    async def test_sso_required(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_sso_domain(save_fixture, organization)

        response, enqueue_email_template = await request_email_otp(
            login_client, mocker, "Jane@ACME.com"
        )

        assert response.status_code == 409
        assert response.json() == {
            "error": "SSORequired",
            "detail": "This email domain signs in through single sign-on.",
            "redirect_url": settings.generate_frontend_url(
                f"/auth/sso/{organization.slug}?return_to=%2Fdashboard"
            ),
        }
        enqueue_email_template.assert_not_called()

    async def test_sso_discovery_disabled(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_sso_domain(save_fixture, organization)

        response, enqueue_email_template = await request_email_otp(
            login_client, mocker, "jane@acme.com", sso_discovery=False
        )

        assert response.status_code == 202
        enqueue_email_template.assert_called_once()
