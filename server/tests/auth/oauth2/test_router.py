from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI
from pytest_mock import MockerFixture
from reauth.factors.oauth2.base import OAuth2Account, OAuth2Enrollment
from sqlalchemy import select

from polar.auth.authentication_session import AuthenticationSessionService
from polar.auth.exceptions import UnverifiedEmailError
from polar.auth.oauth2.apple import AppleFactor
from polar.auth.oauth2.google import GoogleFactor
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationDomain, User
from polar.postgres import AsyncSession
from tests.auth.sso.test_endpoints import create_sso_connection
from tests.fixtures.base import IsolatedSessionTestClient
from tests.fixtures.database import SaveFixture


async def create_sso_domain(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    verified: bool = True,
    sso_enforced: bool = True,
    connection_enabled: bool = True,
) -> None:
    organization.sso_enforced = sso_enforced
    await create_sso_connection(save_fixture, organization, enabled=connection_enabled)
    await save_fixture(
        OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verified_at=utc_now() if verified else None,
        )
    )


async def google_callback(
    client: httpx.AsyncClient,
    mocker: MockerFixture,
    callback_result: OAuth2Enrollment | OAuth2Account,
    *,
    sso_discovery: bool = True,
) -> httpx.Response:
    start = await client.post(
        "/v1/auth/start",
        json={"return_to": "/dashboard", "sso_discovery": sso_discovery},
    )
    assert start.status_code == 201

    authorize = await client.get("/v1/auth/google/authorize")
    assert authorize.status_code == 303
    state = parse_qs(urlsplit(authorize.headers["location"]).query)["state"][0]

    result: tuple[OAuth2Enrollment | None, OAuth2Account | None, MagicMock]
    if isinstance(callback_result, OAuth2Enrollment):
        result = (callback_result, None, MagicMock())
    else:
        result = (None, callback_result, MagicMock())
    mocker.patch.object(GoogleFactor, "callback", return_value=result)
    mocker.patch.object(GoogleFactor, "get_email", return_value="jane@acme.com")
    mocker.patch.object(GoogleFactor, "enroll", return_value=MagicMock())

    return await client.get(
        "/v1/auth/google/callback", params={"code": "the-code", "state": state}
    )


def google_account() -> OAuth2Account:
    return OAuth2Account(
        provider="google",
        account_id="google-account",
        access_token="access-token",
        expires_at=None,
        refresh_token=None,
        refresh_token_expires_at=None,
        scope=[],
    )


@pytest.mark.anyio
class TestLoginCallback:
    @pytest.mark.parametrize("error_stage", ["callback", "get_email", "enroll"])
    async def test_unverified_email(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        error_stage: str,
    ) -> None:
        start = await login_client.post("/v1/auth/start", json={})
        assert start.status_code == 201
        authorize = await login_client.get("/v1/auth/google/authorize")
        assert authorize.status_code == 303
        state = parse_qs(urlsplit(authorize.headers["location"]).query)["state"][0]

        mocker.patch.object(
            GoogleFactor, "callback", return_value=(None, google_account(), MagicMock())
        )
        mocker.patch.object(GoogleFactor, "get_email", return_value="jane@acme.com")
        mocker.patch.object(GoogleFactor, "enroll", return_value=MagicMock())
        error = UnverifiedEmailError()
        mocker.patch.object(GoogleFactor, error_stage, side_effect=error)

        response = await login_client.get(
            "/v1/auth/google/callback", params={"code": "the-code", "state": state}
        )

        assert response.status_code == 303
        location = urlsplit(response.headers["location"])
        assert location.path == "/auth"
        assert parse_qs(location.query)["error"] == [error.message]

    async def test_new_user_without_sso(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        response = await google_callback(login_client, mocker, google_account())

        assert response.status_code == 303
        assert response.headers["location"] == settings.generate_frontend_url("/auth")
        result = await session.execute(
            select(User).where(User.email == "jane@acme.com")
        )
        assert result.scalars().unique().one_or_none() is not None

    async def test_new_user_with_sso(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_sso_domain(save_fixture, organization)

        response = await google_callback(login_client, mocker, google_account())

        assert response.status_code == 303
        assert response.headers["location"] == settings.generate_frontend_url(
            f"/auth/sso/{organization.slug}?return_to=%2Fdashboard"
        )
        result = await session.execute(
            select(User).where(User.email == "jane@acme.com")
        )
        assert result.scalars().unique().one_or_none() is None

    async def test_existing_user_with_sso(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        await create_sso_domain(save_fixture, organization)
        user.email = "jane@acme.com"
        await save_fixture(user)

        response = await google_callback(
            login_client,
            mocker,
            OAuth2Enrollment.from_account(user.id, google_account()),
        )

        assert response.status_code == 303
        assert response.headers["location"] == settings.generate_frontend_url(
            f"/auth/sso/{organization.slug}?return_to=%2Fdashboard"
        )

    async def test_sso_discovery_disabled(
        self,
        login_client: httpx.AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_sso_domain(save_fixture, organization)

        response = await google_callback(
            login_client, mocker, google_account(), sso_discovery=False
        )

        assert response.status_code == 303
        assert response.headers["location"] == settings.generate_frontend_url("/auth")


@pytest.fixture
async def https_client_factory(
    app: FastAPI, session: AsyncSession
) -> Callable[[], AbstractAsyncContextManager[httpx.AsyncClient]]:
    def _factory() -> AbstractAsyncContextManager[httpx.AsyncClient]:
        return IsolatedSessionTestClient(
            session=session,
            auto_expunge=False,
            transport=httpx.ASGITransport(app=app),
            base_url="https://127.0.0.1",
        )

    return _factory


async def apple_authorize(client: httpx.AsyncClient) -> httpx.Response:
    start = await client.post("/v1/auth/start", json={"return_to": "/dashboard"})
    assert start.status_code == 201
    authorize = await client.get("/v1/auth/apple/authorize")
    assert authorize.status_code == 303
    return authorize


@pytest.mark.anyio
class TestAppleLoginCallback:
    async def test_state_cookie_is_cross_site(
        self,
        https_client_factory: Callable[
            [], AbstractAsyncContextManager[httpx.AsyncClient]
        ],
    ) -> None:
        async with https_client_factory() as client:
            authorize = await apple_authorize(client)

        set_cookie = next(
            header
            for header in authorize.headers.get_list("set-cookie")
            if header.startswith(f"{settings.OAUTH2_SESSION_STATE_COOKIE_KEY}=")
        ).lower()
        assert "samesite=none" in set_cookie
        assert "secure" in set_cookie

    async def test_same_browser(
        self,
        mocker: MockerFixture,
        https_client_factory: Callable[
            [], AbstractAsyncContextManager[httpx.AsyncClient]
        ],
    ) -> None:
        async with https_client_factory() as client:
            authorize = await apple_authorize(client)
            state = parse_qs(urlsplit(authorize.headers["location"]).query)["state"][0]

            mocker.patch.object(
                AppleFactor,
                "callback",
                return_value=(None, google_account(), MagicMock()),
            )
            mocker.patch.object(AppleFactor, "get_email", return_value="jane@acme.com")
            mocker.patch.object(AppleFactor, "enroll", return_value=MagicMock())

            response = await client.post(
                "/v1/auth/apple/callback", data={"code": "the-code", "state": state}
            )

        assert response.status_code == 303
        assert response.headers["location"] == settings.generate_frontend_url("/auth")

    async def test_state_from_another_browser(
        self,
        mocker: MockerFixture,
        https_client_factory: Callable[
            [], AbstractAsyncContextManager[httpx.AsyncClient]
        ],
    ) -> None:
        async with https_client_factory() as attacker_client:
            authorize = await apple_authorize(attacker_client)
            state = parse_qs(urlsplit(authorize.headers["location"]).query)["state"][0]

        callback_mock = mocker.patch.object(AppleFactor, "callback")
        advance_mock = mocker.patch.object(AuthenticationSessionService, "advance")

        async with https_client_factory() as victim_client:
            response = await victim_client.post(
                "/v1/auth/apple/callback", data={"code": "the-code", "state": state}
            )

        assert response.status_code == 303
        location = urlsplit(response.headers["location"])
        assert location.path == "/auth"
        assert parse_qs(location.query)["error"] == ["Missing OAuth2 state cookie"]
        callback_mock.assert_not_called()
        advance_mock.assert_not_called()
