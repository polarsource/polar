
import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_create(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"


@pytest.mark.asyncio
async def test_create_non_member(
    user: User,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_non_admin(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"

    get = await client.get(
        f"/api/v1/articles/{res['id']}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get.status_code == 200

    # TODO: test get non authed

    get_json = get.json()
    print(get_json)

    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
