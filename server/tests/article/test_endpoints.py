import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.articles_subscription import ArticlesSubscription
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_create(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
async def test_create_with_slug(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "slug": "this-is-the-slug",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "this-is-the-slug"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_create_with_slug_slugify(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "slug": "this SLUG will be formatted",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "this-slug-will-be-formatted"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_create_non_member(
    user: User, organization: Organization, auth_jwt: str, client: AsyncClient
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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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

    # no auth, can see public posts (both free and premium)
    get = await client.get(
        f"/api/v1/articles/search?platform=github&organization_name={organization.name}",
    )
    assert get.status_code == 200
    list_json = get.json()
    assert len(list_json["items"]) == 2
    assert list_json["pagination"]["total_count"] == 2
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
    await save_fixture(sub)

    # create other subscribers
    for _ in range(5):
        u = await create_user(save_fixture)
        s2 = ArticlesSubscription(
            user_id=u.id,
            organization_id=organization.id,
            paid_subscriber=False,
        )
        await save_fixture(s2)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_pinned(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response_pinned = await client.post(
        "/api/v1/articles",
        json={
            "title": "Is Pinned",
            "body": "Body body",
            "organization_id": str(organization.id),
            "is_pinned": True,
            "published_at": "2023-11-26 00:00:00",  # a date in the past
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response_pinned.status_code == 200
    res = response_pinned.json()
    assert res["slug"] == "is-pinned"
    assert res["is_pinned"] is True

    response_not_pinned = await client.post(
        "/api/v1/articles",
        json={
            "title": "Not Pinned",
            "slug": "not-pinned",
            "body": "Body body",
            "organization_id": str(organization.id),
            "is_pinned": False,
            "published_at": "2023-11-26 00:00:00",  # a date in the past
            "visibility": "public",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response_not_pinned.status_code == 200
    res = response_not_pinned.json()
    assert res["slug"] == "not-pinned"
    assert res["is_pinned"] is False

    # search pinned
    search_pinned = await client.get(
        "/api/v1/articles/search",
        params={
            "platform": "github",
            "organization_name": organization.name,
            "is_pinned": True,
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert search_pinned.status_code == 200
    search_pinned_res = search_pinned.json()

    assert len(search_pinned_res["items"]) == 1
    assert search_pinned_res["items"][0]["slug"] == "is-pinned"

    # search not pinned
    search_not_pinned = await client.get(
        "/api/v1/articles/search",
        params={
            "platform": "github",
            "organization_name": organization.name,
            "is_pinned": False,
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert search_not_pinned.status_code == 200
    search_not_pinned_res = search_not_pinned.json()

    assert len(search_not_pinned_res["items"]) == 1
    assert search_not_pinned_res["items"][0]["slug"] == "not-pinned"

    # search no pinned filter
    search = await client.get(
        "/api/v1/articles/search",
        params={
            "platform": "github",
            "organization_name": organization.name,
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert search.status_code == 200
    search_res = search.json()

    assert len(search_res["items"]) == 2


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_og_image_url(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "og_image_url": "https://polar.sh/foo.png",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["og_image_url"] == "https://polar.sh/foo.png"

    article_id = res["id"]

    # update
    response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={
            "set_og_image_url": "true",
            "og_image_url": "https://polar.sh/foo2.png",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["og_image_url"] == "https://polar.sh/foo2.png"

    # update without set does not change anything
    response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={
            "og_image_url": "https://polar.sh/foo3.png",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["og_image_url"] == "https://polar.sh/foo2.png"

    # unset
    response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={
            "set_og_image_url": "true",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["og_image_url"] is None


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_og_description(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "og_description": "description!",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    res = response.json()
    assert res["og_description"] == "description!"

    article_id = res["id"]

    # update
    response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={
            "set_og_description": "true",
            "og_description": "updated",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["og_description"] == "updated"

    # update without set does not change anything
    response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={
            "og_description": "whaaaaaaa",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["og_description"] == "updated"

    # unset
    response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={
            "set_og_description": "true",
        },
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["og_description"] is None
