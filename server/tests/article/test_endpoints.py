import pytest
from httpx import AsyncClient

from polar.models import Article
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create_no_body(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create_with_slug(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "slug": "this-is-the-slug",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "this-is-the-slug"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create_with_slug_slugify(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "slug": "this SLUG will be formatted",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "this-slug-will-be-formatted"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create_non_member(
    user: User, organization: Organization, client: AsyncClient
) -> None:
    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_create_non_admin(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_public(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
    )

    assert response.status_code == 201
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

    get = await client.get(f"/api/v1/articles/{res['id']}")
    assert get.status_code == 200
    get_json = get.json()
    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "public"


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_hidden(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "hidden",
        },
    )

    assert response.status_code == 201
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
@pytest.mark.auth
async def test_get_private_user(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    article = article = Article(
        slug="hello-world",
        title="Hello World!",
        body="Body body",
        user=user,
        organization=organization,
        visibility=Article.Visibility.private,
    )
    await save_fixture(article)

    # then
    session.expunge_all()

    get = await client.get(f"/api/v1/articles/{article.id}")
    assert get.status_code == 200

    get_json = get.json()

    assert get_json["id"] == str(article.id)
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "private"


@pytest.mark.asyncio
async def test_get_private_anonymous(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    article = article = Article(
        slug="hello-world",
        title="Hello World!",
        body="Body body",
        user=user,
        organization=organization,
        visibility=Article.Visibility.private,
    )
    await save_fixture(article)

    # then
    session.expunge_all()

    get_anon = await client.get(f"/api/v1/articles/{article.id}")
    assert get_anon.status_code == 404


@pytest.mark.asyncio
@pytest.mark.auth
async def test_byline_default(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["byline"]["name"] == organization.name


@pytest.mark.asyncio
@pytest.mark.auth
async def test_byline_user_github(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "byline": "user",
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["byline"]["name"] == user.public_name


@pytest.mark.asyncio
@pytest.mark.auth
async def test_byline_user_no_oauth(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "byline": "user",
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["byline"]["name"].startswith("t")  # ??


@pytest.mark.asyncio
@pytest.mark.auth
async def test_byline_org(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "byline": "organization",
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["byline"]["name"] == organization.name


@pytest.mark.asyncio
@pytest.mark.auth
async def test_slug_collision(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    create_0 = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
    )
    assert create_0.status_code == 201
    assert create_0.json()["slug"] == "hello-world"

    create_1 = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
    )
    assert create_1.status_code == 201
    assert create_1.json()["slug"] == "hello-world-1"

    create_2 = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "public",
        },
    )
    assert create_2.status_code == 201
    assert create_2.json()["slug"] == "hello-world-2"


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body": "Body body",
            "organization_id": str(organization.id),
            "visibility": "private",
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["title"] == "Hello World!"
    assert res["slug"] == "hello-world"

    get = await client.patch(
        f"/api/v1/articles/{res['id']}",
        json={
            "body": "Here comes the post...",
            "visibility": "public",
        },
    )
    assert get.status_code == 200

    get_json = get.json()

    assert get_json["id"] == res["id"]
    assert get_json["title"] == "Hello World!"
    assert get_json["visibility"] == "public"
    assert get_json["body"] == "Here comes the post..."


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_body_base64(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.post(
        "/api/v1/articles/",
        json={
            "title": "Hello World!",
            "body_base64": "aGVsbG8gaW4gYjY0",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 201
    res = response.json()
    assert res["slug"] == "hello-world"
    assert res["body"] == "hello in b64"
    article_id = res["id"]

    # update
    response = await client.patch(
        f"/api/v1/articles/{article_id}",
        json={
            "body_base64": "dXBkYXRlZCBiNjQ=",
        },
    )
    assert response.status_code == 200
    res = response.json()
    assert res["body"] == "updated b64"
