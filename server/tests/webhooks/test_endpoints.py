import pytest
from httpx import AsyncClient

from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListWebhookEndpoints:
    async def test_unauthenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        webhook_endpoint: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
        webhook_endpoint: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.authenticated
    async def test_authenticated_not_admin(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        webhook_endpoint: WebhookEndpoint,
    ) -> None:
        user_organization.is_admin = False
        await save_fixture(user_organization)

        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.authenticated
    async def test_authenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        webhook_endpoint: WebhookEndpoint,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_endpoint.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateWebhookEndpoint:
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
            "events": [],
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201
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
            "events": [],
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
            "events": [],
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
            "events": [],
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)
        assert response.status_code == 201
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
        assert delete_response.status_code == 204

        # get after delete
        get_response = await client.get(
            f"/api/v1/webhooks/endpoints/{json["id"]}",
        )
        assert get_response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateWebhookEndpoint:
    @pytest.mark.authenticated
    async def test_update(
        self,
        client: AsyncClient,
        webhook_endpoint: WebhookEndpoint,
        user_organization_admin: UserOrganization,
    ) -> None:
        data = {"events": ["subscription.created", "subscription.updated"]}

        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint.id}", json=data
        )

        assert response.status_code == 200
        updated = response.json()

        assert updated["events"] == data["events"]

    @pytest.mark.authenticated
    async def test_search_member_no_admin(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint: WebhookEndpoint,
        user_organization: UserOrganization,
    ) -> None:
        data = {"events": ["subscription.created", "subscription.updated"]}

        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint.id}", json=data
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_search_no_member(
        self,
        client: AsyncClient,
        webhook_endpoint: WebhookEndpoint,
    ) -> None:
        data = {"events": ["subscription.created", "subscription.updated"]}

        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint.id}", json=data
        )

        assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListWebhookDeliveries:
    @pytest.mark.authenticated
    async def test_search(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.get("/api/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_delivery.id)

    @pytest.mark.authenticated
    async def test_search_member_no_admin(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/api/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.authenticated
    async def test_search_no_member(
        self,
        client: AsyncClient,
        webhook_endpoint: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
    ) -> None:
        response = await client.get("/api/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0
