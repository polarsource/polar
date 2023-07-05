import uuid

from httpx import AsyncClient
import pytest
import pytest_asyncio

from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user import User
from polar.app import app
from polar.config import settings
from polar.models.user_organization import UserOrganization
from polar.enums import AccountType
from polar.postgres import AsyncSession
from polar.account.service import account as account_service


@pytest_asyncio.fixture
async def open_collective_account(
    session: AsyncSession,
    user: User,
    organization: Organization,
    user_organization: UserOrganization,
) -> Account:
    account = Account(
        account_type=AccountType.open_collective,
        organization=organization,
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
async def test_create_open_collective_missing_slug(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            f"/api/v1/github/{organization.name}/accounts",
            json={
                "account_type": "open_collective",
                "country": "US",
            },
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_open_collective(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            f"/api/v1/github/{organization.name}/accounts",
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
    assert account.currency == "USD"
    assert account.is_details_submitted is True
    assert account.is_charges_enabled is True
    assert account.is_payouts_enabled is True
    assert account.business_type == "fiscal_host"


@pytest.mark.asyncio
async def test_onboarding_link_not_existing_account(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/accounts/3794dd38-54d1-4a64-bd68-fa22e1659e7b/onboarding_link",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
async def test_onboarding_link_open_collective(
    organization: Organization, open_collective_account: Account, auth_jwt: str
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/accounts/{open_collective_account.id}/onboarding_link",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

        assert response.status_code == 400


@pytest.mark.asyncio
async def test_dashboard_link_not_existing_account(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/accounts/3794dd38-54d1-4a64-bd68-fa22e1659e7b/dashboard_link",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
async def test_dashboard_link_open_collective(
    organization: Organization, open_collective_account: Account, auth_jwt: str
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/accounts/{open_collective_account.id}/dashboard_link",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

        assert response.status_code == 200

        json = response.json()
        assert json == {
            "type": "account_link",
            "created": 1,
            "url": "https://opencollective.com/polar",
        }
