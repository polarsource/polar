import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import generate_uuid
from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint
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

    @pytest.mark.authenticated
    async def test_not_found(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        params = {"organization_id": str(generate_uuid())}
        response = await client.get("/api/v1/webhooks/endpoints/search", params=params)

        assert response.status_code == 404
        json = response.json()


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
class TestCreateEndpoint:
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

        # get endpoint
        get_response = await client.get(
            f"/api/v1/webhooks/endpoints/{json["id"]}",
        )
        assert get_response.status_code == 200
        assert get_response.json()["id"] == json["id"]

        # delete
        delete_response = await client.delete(
            f"/api/v1/webhooks/endpoints/{json["id"]}",
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["id"] == json["id"]

        # get after delete
        get_response = await client.get(
            f"/api/v1/webhooks/endpoints/{json["id"]}",
        )
        assert get_response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchDeliveries:
    @pytest.mark.authenticated
    async def test_search(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization_admin: UserOrganization,
    ) -> None:
        params = {"webhook_endpoint_id": str(webhook_endpoint.id)}
        response = await client.get("/api/v1/webhooks/deliveries/search", params=params)

        assert response.status_code == 200
        search = response.json()

        assert 1 == len(search["items"])
        assert 1 == search["pagination"]["total_count"]

        assert str(webhook_delivery.id) == search["items"][0]["id"]

    @pytest.mark.authenticated
    async def test_search_member_no_admin(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization: UserOrganization,
    ) -> None:
        params = {"webhook_endpoint_id": str(webhook_endpoint.id)}
        response = await client.get("/api/v1/webhooks/deliveries/search", params=params)

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_search_no_member(
        self,
        client: AsyncClient,
        webhook_endpoint: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
    ) -> None:
        params = {"webhook_endpoint_id": str(webhook_endpoint.id)}
        response = await client.get("/api/v1/webhooks/deliveries/search", params=params)

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_found(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        params = {"webhook_endpoint_id": str(generate_uuid())}
        response = await client.get("/api/v1/webhooks/deliveries/search", params=params)

        assert response.status_code == 404
        json = response.json()


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateEndpoints:
    @pytest.mark.authenticated
    async def test_update(
        self,
        client: AsyncClient,
        webhook_endpoint: WebhookEndpoint,
        user_organization_admin: UserOrganization,
    ) -> None:
        data = {
            "event_subscription_created": True,
            "event_subscription_updated": True,
        }

        response = await client.put(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint.id}", json=data
        )

        assert response.status_code == 200
        updated = response.json()

        assert updated["event_subscription_created"] is True
        assert updated["event_subscription_updated"] is True
        assert updated["event_subscription_tier_created"] is False  # not updated
        assert updated["event_subscription_tier_updated"] is False  # not updated

    @pytest.mark.authenticated
    async def test_search_member_no_admin(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint: WebhookEndpoint,
        user_organization: UserOrganization,
    ) -> None:
        data = {
            "event_subscription_created": True,
            "event_subscription_updated": True,
        }

        response = await client.put(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint.id}", json=data
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_search_no_member(
        self,
        client: AsyncClient,
        webhook_endpoint: WebhookEndpoint,
    ) -> None:
        data = {
            "event_subscription_created": True,
            "event_subscription_updated": True,
        }

        response = await client.put(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint.id}", json=data
        )

        assert response.status_code == 401
