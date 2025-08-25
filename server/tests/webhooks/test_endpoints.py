import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestListWebhookEndpoints:
    async def test_unauthenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/v1/webhooks/endpoints", params=params)
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_authenticated_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.auth
    async def test_authenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_endpoint_organization.id)


@pytest.mark.asyncio
class TestCreateWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(self, client: AsyncClient) -> None:
        params = {"url": "https://example.com/hook", "format": "raw", "events": []}
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        params = {
            "url": "https://example.com/hook",
            "format": "raw",
            "events": [],
            "organization_id": str(organization.id),
        }
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(self, client: AsyncClient) -> None:
        params = {"url": "https://example.com/hook", "format": "raw", "events": []}
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient
    ) -> None:
        params = {"url": "https://example.com/hook", "format": "raw", "events": []}
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201


@pytest.mark.asyncio
class TestUpdateWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 200

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 200


@pytest.mark.asyncio
class TestDeleteWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 204

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.delete(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.delete(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 204


@pytest.mark.asyncio
class TestListWebhookDeliveries:
    @pytest.mark.auth
    async def test_user_not_member(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
    ) -> None:
        response = await client.get("/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.auth
    async def test_user(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_delivery.id)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
    ) -> None:
        response = await client.get("/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_delivery.id)
