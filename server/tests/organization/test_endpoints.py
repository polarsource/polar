from datetime import datetime
from typing import Any

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import Organization as OrganizationSchema
from polar.postgres import AsyncSession
from polar.user_organization.schemas import OrganizationMember


@pytest.mark.asyncio
async def test_get_organization(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.parse_obj(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id


@pytest.mark.asyncio
async def test_get_organization_member_only_fields_no_member(
    session: AsyncSession,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    organization.billing_email = "billing@polar.sh"
    await organization.save(session)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.parse_obj(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email is None


@pytest.mark.asyncio
async def test_get_organization_member_only_fields_is_member(
    session: AsyncSession,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    organization.billing_email = "billing@polar.sh"
    await organization.save(session)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.parse_obj(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email == "billing@polar.sh"


@pytest.mark.asyncio
async def test_update_organization_billing_email(
    session: AsyncSession,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.parse_obj(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email is None

    # edit
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "billing_email": "billing_via_api@polar.sh",
        },
    )

    assert response.status_code == 200
    org = OrganizationSchema.parse_obj(response.json())
    assert org.billing_email == "billing_via_api@polar.sh"

    # get again!
    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    org = OrganizationSchema.parse_obj(response.json())
    assert org.billing_email == "billing_via_api@polar.sh"


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
    organization.deleted_at = utc_now()
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


@pytest.mark.asyncio
async def test_list_members(
    session: AsyncSession,
    organization: Organization,
    user_organization_admin: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}/members",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    items_r: list[dict[str, Any]] = response.json()["items"]
    items = [OrganizationMember.parse_obj(r) for r in items_r]

    assert len(items) == 2

    admins = [i for i in items if i.is_admin]
    non_admins = [i for i in items if not i.is_admin]

    assert len(admins) == 1
    assert len(non_admins) == 1


@pytest.mark.asyncio
async def test_list_members_not_member(
    session: AsyncSession,
    organization: Organization,
    # user_organization_admin: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}/members",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 401
