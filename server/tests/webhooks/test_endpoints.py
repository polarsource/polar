import pytest
from httpx import AsyncClient

from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchOrganization:
    async def test_unauthenticated(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated_not_admin(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = False
        await save_fixture(user_organization)

        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)

        assert response.status_code == 200
        json = response.json()

        assert {"items": [], "pagination": {"total_count": 0, "max_page": 0}} == json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchUser:
    async def test_unauthenticated(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        params = {"user_id": str(user.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        params = {"user_id": str(user.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)

        assert response.status_code == 200
        json = response.json()

        assert {"items": [], "pagination": {"total_count": 0, "max_page": 0}} == json

    @pytest.mark.authenticated
    async def test_authenticated_with_created(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        # create
        params = {
            "user_id": str(user.id),
            "url": "https://example.com/hook",
            "secret": "foo",
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 200
        json = response.json()

        assert json["id"]
        assert "https://example.com/hook" == json["url"]
        assert str(user.id) == json["user_id"]
        assert json["organization_id"] is None

        # verify

        params = {"user_id": str(user.id)}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)

        assert response.status_code == 200
        search = response.json()

        assert 1 == len(search["items"])
        assert 1 == search["pagination"]["total_count"]

        assert json["id"] == search["items"][0]["id"]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreate:
    @pytest.mark.authenticated
    async def test_create_user(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        params = {
            "user_id": str(user.id),
            "url": "https://example.com/hook",
            "secret": "foo",
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 200
        json = response.json()

        assert json["id"]
        assert "https://example.com/hook" == json["url"]
        assert str(user.id) == json["user_id"]
        assert json["organization_id"] is None

    @pytest.mark.authenticated
    async def test_create_organization_non_member(
        self,
        client: AsyncClient,
        user: User,
        organization: Organization,
    ) -> None:
        params = {
            "organization_id": str(organization.id),
            "url": "https://example.com/hook",
            "secret": "foo",
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_create_organization_member_non_admin(
        self,
        client: AsyncClient,
        user: User,
        organization: Organization,
        user_organization: Organization,
    ) -> None:
        params = {
            "organization_id": str(organization.id),
            "url": "https://example.com/hook",
            "secret": "foo",
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_create_organization(
        self,
        client: AsyncClient,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        params = {
            "organization_id": str(organization.id),
            "url": "https://example.com/hook",
            "secret": "foo",
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)
        assert response.status_code == 200
        json = response.json()

        assert json["id"]
        assert "https://example.com/hook" == json["url"]
        assert json["user_id"] is None
        assert str(organization.id) == json["organization_id"]
