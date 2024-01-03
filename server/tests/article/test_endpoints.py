import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.articles_subscription import ArticlesSubscription
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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
@pytest.mark.http_auto_expunge
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
@pytest.mark.http_auto_expunge
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

    # then
    session.expunge_all()

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

    # then
    session.expunge_all()

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

    # then
    session.expunge_all()

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
    assert get_anon.status_code == 404

    # lookup anon
    lookup = await client.get(
        f"/api/v1/articles/lookup?platform=github&organization_name={organization.name}&slug=hello-world",
    )
    assert lookup.status_code == 404

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

    # then
    session.expunge_all()

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

    # then
    session.expunge_all()

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

    # then
    session.expunge_all()

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

    # then
    session.expunge_all()

    create_1 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
            "published_at": "2023-11-26 00:00:00",  # a date in the past
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_1.status_code == 200

    create_2 = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello Paid Only!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
            "published_at": "2023-11-26 00:00:00",  # a date in the past
            "paid_subscribers_only": True,
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_2.status_code == 200

    # not visible in response by default
    create_private = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello Private!",
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
            "title": "Hello Hidden!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "hidden",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_hidden.status_code == 200

    # not visible in response by default
    create_future = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello Future!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
            "published_at": "2030-11-27 00:00:00",  # a date in the future
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert create_future.status_code == 200

    # no auth
    get = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}",
    )
    assert get.status_code == 200
    list_json = get.json()
    assert len(list_json["items"]) == 1
    assert list_json["pagination"]["total_count"] == 1
    for art in list_json["items"]:
        assert art["visibility"] == "public"

    # authed, expect can see private if enabled
    get_authed = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get_authed.status_code == 200
    list_json_authed = get_authed.json()
    assert len(list_json_authed["items"]) == 2
    assert list_json_authed["pagination"]["total_count"] == 2

    # authed, expect can see private if enabled
    get_show_unpublished = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}&show_unpublished=true",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get_show_unpublished.status_code == 200
    list_json_authed_unpublished = get_show_unpublished.json()
    assert len(list_json_authed_unpublished["items"]) == 5
    assert list_json_authed_unpublished["pagination"]["total_count"] == 5

    # is subscriber
    sub = ArticlesSubscription(
        user_id=user.id,
        organization_id=organization.id,
        paid_subscriber=False,
    )
    session.add(sub)

    # create other subscribers
    for _ in range(5):
        u = await create_user(session)
        s2 = ArticlesSubscription(
            user_id=u.id,
            organization_id=organization.id,
            paid_subscriber=False,
        )
        session.add(s2)

    await session.commit()

    # authed and is subscribed
    get_show_unpublished = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get_show_unpublished.status_code == 200
    list_json_authed_unpublished = get_show_unpublished.json()
    assert len(list_json_authed_unpublished["items"]) == 2
    assert list_json_authed_unpublished["pagination"]["total_count"] == 2

    # authed and is subscribed and want to see unpublished
    get_show_unpublished = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}&show_unpublished=true",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get_show_unpublished.status_code == 200
    list_json_authed_unpublished = get_show_unpublished.json()
    assert len(list_json_authed_unpublished["items"]) == 5
    assert list_json_authed_unpublished["pagination"]["total_count"] == 5

    # authed and is premium subscribed and want to see unpublished
    sub.paid_subscriber = True
    await session.commit()

    get_show_unpublished = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}&show_unpublished=true",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get_show_unpublished.status_code == 200
    list_json_authed_unpublished = get_show_unpublished.json()
    assert len(list_json_authed_unpublished["items"]) == 5
    assert list_json_authed_unpublished["pagination"]["total_count"] == 5


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

    # then
    session.expunge_all()

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

    # then
    session.expunge_all()

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


@pytest.mark.asyncio
async def test_view_counter(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    # then
    session.expunge_all()

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

    for x in range(0, 3):
        viewed = await client.post(
            f"/api/v1/articles/{res['id']}/viewed",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )
        assert viewed.status_code == 200

    # get again
    get = await client.get(
        f"/api/v1/articles/{res['id']}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert get.status_code == 200

    get_json = get.json()

    assert get_json["web_view_count"] == 3
