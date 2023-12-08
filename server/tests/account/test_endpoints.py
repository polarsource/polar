import uuid
from typing import Any

import pytest
import pytest_asyncio
import stripe as stripe_lib
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.account.service import account as account_service
from polar.config import settings
from polar.enums import AccountType
from polar.integrations.open_collective.service import (
    CollectiveNotFoundError,
    OpenCollectiveAPIError,
    OpenCollectiveCollective,
    OpenCollectiveServiceError,
    open_collective,
)
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession


@pytest_asyncio.fixture
async def open_collective_account(session: AsyncSession, user: User) -> Account:
    account = Account(
        account_type=AccountType.open_collective,
        admin_id=user.id,
        open_collective_slug="polar",
        country="US",
        currency="USD",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="fiscal_host",
    )
    await account.save(session)
    await session.commit()
    return account


@pytest.mark.asyncio
async def test_create_invalid_account_type(auth_jwt: str, client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "account_type": "unknown",
            "country": "US",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("slug", [None, ""])
async def test_create_open_collective_missing_slug(
    slug: str | None, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "account_type": "open_collective",
            "country": "US",
            **({"open_collective_slug": slug} if slug is not None else {}),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error",
    [
        OpenCollectiveAPIError("Error"),
        CollectiveNotFoundError("Not found"),
    ],
)
async def test_create_open_collective_get_collective_error(
    error: OpenCollectiveServiceError,
    auth_jwt: str,
    mocker: MockerFixture,
    client: AsyncClient,
) -> None:
    open_collective_mock = mocker.patch.object(open_collective, "get_collective")
    open_collective_mock.side_effect = error

    response = await client.post(
        "/api/v1/accounts",
        json={
            "account_type": "open_collective",
            "open_collective_slug": "polar",
            "country": "US",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 400

    json = response.json()
    assert json["detail"] == error.message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "collective",
    [
        OpenCollectiveCollective("polar", "custom", True, True, False, False),
        OpenCollectiveCollective("polar", "opensource", False, True, False, False),
    ],
)
async def test_create_open_collective_not_eligible(
    collective: OpenCollectiveCollective,
    auth_jwt: str,
    mocker: MockerFixture,
    session: AsyncSession,
    client: AsyncClient,
) -> None:
    open_collective_mock = mocker.patch.object(open_collective, "get_collective")
    open_collective_mock.return_value = collective

    response = await client.post(
        "/api/v1/accounts",
        json={
            "account_type": "open_collective",
            "open_collective_slug": "polar",
            "country": "US",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 400

    json = response.json()
    assert "not eligible" in json["detail"]


@pytest.mark.asyncio
async def test_create_open_collective(
    auth_jwt: str, session: AsyncSession, mocker: MockerFixture, client: AsyncClient
) -> None:
    open_collective_mock = mocker.patch.object(open_collective, "get_collective")
    open_collective_mock.return_value = OpenCollectiveCollective(
        "polar", "opensource", True, True, False, False
    )

    response = await client.post(
        "/api/v1/accounts",
        json={
            "account_type": "open_collective",
            "open_collective_slug": "polar",
            "country": "US",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    json = response.json()
    account_id = json["id"]

    account = await account_service.get(session, uuid.UUID(account_id))
    assert account is not None
    assert account.account_type == AccountType.open_collective
    assert account.open_collective_slug == "polar"
    assert account.currency == "usd"
    assert account.is_details_submitted is True
    assert account.is_charges_enabled is True
    assert account.is_payouts_enabled is True
    assert account.business_type == "fiscal_host"


@pytest.mark.asyncio
async def test_create_personal_stripe(
    user: User,
    auth_jwt: str,
    mocker: MockerFixture,
    client: AsyncClient,
) -> None:
    stripe_mock = mocker.patch.object(stripe_lib.Account, "create")

    class FakeStripeAccount:
        id = "fake_stripe_id"
        email = "foo@example.com"
        country = "SE"
        default_currency = "USD"
        details_submitted = False
        charges_enabled = False
        payouts_enabled = False
        business_type = "company"

        def to_dict(self) -> dict[str, Any]:
            return {"lol": "wut"}

    stripe_mock.return_value = FakeStripeAccount()

    create_response = await client.post(
        "/api/v1/accounts",
        json={
            "account_type": "stripe",
            "country": "US",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert create_response.status_code == 200
    assert create_response.json()["account_type"] == "stripe"
    assert create_response.json()["stripe_id"] == "fake_stripe_id"


@pytest.mark.asyncio
async def test_onboarding_link_open_collective(
    open_collective_account: Account, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.post(
        f"/api/v1/accounts/{open_collective_account.id}/onboarding_link",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_link_not_existing_account(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/accounts/3794dd38-54d1-4a64-bd68-fa22e1659e7b/dashboard_link",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_link_open_collective(
    open_collective_account: Account, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.post(
        f"/api/v1/accounts/{open_collective_account.id}/dashboard_link",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    json = response.json()
    assert json == {
        "url": "https://opencollective.com/polar",
    }
