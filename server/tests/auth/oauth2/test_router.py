from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from pytest_mock import MockerFixture
from reauth.factors.oauth2.base import OAuth2Account, OAuth2Enrollment
from sqlalchemy import select

from polar.auth.oauth2.google import GoogleFactor
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationDomain, User
from polar.postgres import AsyncSession
from tests.auth.sso.test_endpoints import create_sso_connection
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


@pytest.mark.asyncio
class TestLoginCallback:
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
