import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListWebhookEndpoints:
    async def test_unauthenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_authenticated_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.auth
    async def test_authenticated_not_admin(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        user_organization.is_admin = False
        await save_fixture(user_organization)

        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)

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
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        params = {"organization_id": str(organization.id)}
        response = await client.get("/api/v1/webhooks/endpoints", params=params)

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_endpoint_organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        params = {
            "url": "https://example.com/hook",
            "secret": "foo",
            "events": [],
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.backer_webhooks_write}),
    )
    async def test_user_valid(self, client: AsyncClient) -> None:
        params = {
            "url": "https://example.com/hook",
            "secret": "foo",
            "events": [],
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(self, client: AsyncClient) -> None:
        params = {
            "url": "https://example.com/hook",
            "secret": "foo",
            "events": [],
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient
    ) -> None:
        params = {
            "url": "https://example.com/hook",
            "secret": "foo",
            "events": [],
        }
        response = await client.post("/api/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_webhooks_write}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 200

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}", json={}
        )

        assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestDeleteWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_webhooks_write}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 204

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.delete(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        response = await client.delete(
            f"/api/v1/webhooks/endpoints/{webhook_endpoint_organization.id}"
        )

        assert response.status_code == 204


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListWebhookDeliveries:
    @pytest.mark.auth
    async def test_search(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.get("/api/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(webhook_delivery.id)

    @pytest.mark.auth
    async def test_search_member_no_admin(
        self,
        client: AsyncClient,
        user: User,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/api/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.auth
    async def test_search_no_member(
        self,
        client: AsyncClient,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_delivery: WebhookDelivery,
    ) -> None:
        response = await client.get("/api/v1/webhooks/deliveries")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0
