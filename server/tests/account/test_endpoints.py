import uuid

from httpx import AsyncClient
import pytest

from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User
from polar.app import app
from polar.config import settings
from polar.models.user_organization import UserOrganization
from polar.enums import AccountType
from polar.postgres import AsyncSession
from polar.account.service import account as account_service


@pytest.mark.asyncio
async def test_create_open_collective_missing_slug(
    user: User,
    organization: Organization,
    repository: Repository,
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
    repository: Repository,
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
