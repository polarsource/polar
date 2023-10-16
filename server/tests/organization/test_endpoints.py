from datetime import datetime

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_get_organization(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_list_organization_member(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/organizations",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 0


@pytest.mark.asyncio
async def test_list_organization_member_allow_non_admin(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/organizations?is_admin_only=false",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_list_organization_member_admin(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.get(
        "/api/v1/organizations",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_organization_lookup_not_found(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/organizations/lookup?platform=github&organization_name=foobar",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_organization_lookup(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/lookup?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_organization_search(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_organization_search_no_matches(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/organizations/search?platform=github&organization_name=foobar",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_get_organization_deleted(
    session: AsyncSession,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    # soft-delete the organization
    organization.deleted_at = datetime.utcnow()
    await organization.save(session)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_organization_no_admin(
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "set_default_upfront_split_to_contributors": True,
            "default_upfront_split_to_contributors": 85,
        },
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_organization(
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "set_default_upfront_split_to_contributors": True,
            "default_upfront_split_to_contributors": 85,
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] == 85

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "default_upfront_split_to_contributors": 70,  # no change
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] == 85

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "set_default_upfront_split_to_contributors": True,  # unset!
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] is None
