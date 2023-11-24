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
async def test_get_public(
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
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"

    get = await client.get(
        f"/api/v1/articles/{res['id']}",
    )
    assert get.status_code == 200
    get_json = get.json()

    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "public"

    # lookup
    lookup = await client.get(
        f"/api/v1/articles/lookup?platform=github&organization_name={organization.name}&slug=hello-world",
    )
    assert lookup.status_code == 200
    lookup_json = lookup.json()
    assert lookup_json["id"] == res["id"]
    assert lookup_json["title"] == "Hello World!"
    assert lookup_json["visibility"] == "public"


@pytest.mark.asyncio
async def test_get_hidden(
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
            "visibility": "hidden",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"

    get = await client.get(
        f"/api/v1/articles/{res['id']}",
    )
    assert get.status_code == 200
    get_json = get.json()

    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "hidden"


@pytest.mark.asyncio
async def test_get_private(
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
            "visibility": "private",
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

    get_json = get.json()

    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "private"

    get_anon = await client.get(
        f"/api/v1/articles/{res['id']}",
    )
    assert get_anon.status_code == 401

    # lookup anon
    lookup = await client.get(
        f"/api/v1/articles/lookup?platform=github&organization_name={organization.name}&slug=hello-world",
    )
    assert lookup.status_code == 401

    # lookup auth
    lookup = await client.get(
        f"/api/v1/articles/lookup?platform=github&organization_name={organization.name}&slug=hello-world",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert lookup.status_code == 200


@pytest.mark.asyncio
async def test_byline_default(
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
    assert res["byline"]["name"] == organization.name


@pytest.mark.asyncio
async def test_byline_user(
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
            "byline": "user",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["byline"]["name"] == user.username


@pytest.mark.asyncio
async def test_byline_org(
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
            "byline": "organization",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["byline"]["name"] == organization.name


@pytest.mark.asyncio
async def test_list(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    create_1 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_1.status_code == 200

    create_2 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello Universe!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_2.status_code == 200

    # not visible in response by default
    create_private = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello Universe!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "private",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_private.status_code == 200

    # not visible in response by default
    create_hidden = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello Universe!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "hidden",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_hidden.status_code == 200

    # no auth
    get = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}",
    )
    assert get.status_code == 200
    list_json = get.json()
    assert len(list_json["items"]) == 2

    # authed, expect can see private
    get_authed = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get_authed.status_code == 200
    list_json_authed = get_authed.json()
    assert len(list_json_authed["items"]) == 4


@pytest.mark.asyncio
async def test_slug_collision(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    create_0 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_0.status_code == 200
    assert create_0.json()["slug"] == "hello-world"

    create_1 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_1.status_code == 200
    assert create_1.json()["slug"] == "hello-world-1"

    create_2 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_2.status_code == 200
    assert create_2.json()["slug"] == "hello-world-2"


@pytest.mark.asyncio
async def test_update(
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
            "visibility": "private",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"

    get = await client.put(
        f"/api/v1/articles/{res['id']}",
        json={
            "body": "Here comes the post...",
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get.status_code == 200

    get_json = get.json()

    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "public"
    assert get_json["body"] == "Here comes the post..."
