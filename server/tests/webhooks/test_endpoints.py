from datetime import timedelta

import pytest
from httpx2 import AsyncClient

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint, WebhookFormat
from polar.version import V2026_04, V2026_10, V2027_01
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import webhook_endpoint_secret


@pytest.mark.anyio
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

    @pytest.mark.auth
    async def test_includes_mcp_endpoints(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        response = await client.get("/v1/webhooks/endpoints")

        assert response.status_code == 200
        [item] = response.json()["items"]
        assert item["id"] == str(webhook_endpoint_mcp.id)
        assert item["format"] == "mcp"

    @pytest.mark.auth
    async def test_excludes_expired_mcp_endpoints(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        await save_fixture(
            WebhookEndpoint(
                url="https://example.com/mcp",
                format=WebhookFormat.mcp,
                organization=organization,
                **await webhook_endpoint_secret("foobar"),
                expires_at=utc_now() - timedelta(minutes=1),
            )
        )

        response = await client.get("/v1/webhooks/endpoints")

        assert response.status_code == 200
        assert response.json()["items"] == []

    @pytest.mark.auth
    @pytest.mark.api_version(V2027_01)
    async def test_format_filter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        response = await client.get(
            "/v1/webhooks/endpoints", params={"format": ["raw", "slack"]}
        )

        assert response.status_code == 200
        [item] = response.json()["items"]
        assert item["id"] == str(webhook_endpoint_organization.id)

    @pytest.mark.auth
    @pytest.mark.api_version(V2026_10)
    async def test_format_filter_ignored_before_v2027_01(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        response = await client.get("/v1/webhooks/endpoints", params={"format": "raw"})

        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 2


@pytest.mark.anyio
class TestCreateWebhookEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_missing_scope(self, client: AsyncClient) -> None:
        params = {"url": "https://example.com/hook", "format": "raw", "events": []}
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 403

    @pytest.mark.auth(
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
    async def test_mcp_format(self, client: AsyncClient) -> None:
        params = {"url": "https://example.com/hook", "format": "mcp", "events": []}
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_valid_creator_webhooks_write_scope(
        self, client: AsyncClient
    ) -> None:
        params = {"url": "https://example.com/hook", "format": "raw", "events": []}
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_url_with_leading_and_trailing_spaces(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        params = {
            "url": "  https://example.com/hook  ",
            "format": "raw",
            "events": [],
            "organization_id": str(organization.id),
        }
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201
        json = response.json()
        assert json["url"] == "https://example.com/hook"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    @pytest.mark.api_version(V2026_04)
    async def test_2026_04_accepts_deprecated_secret(self, client: AsyncClient) -> None:
        custom_secret = "whsec_ovyN6cPrTv56AApvzCaJno08SSmGJmgbWilb33N2JuK"
        params = {
            "url": "https://example.com/hook",
            "format": "raw",
            "events": [],
            "secret": custom_secret,
        }
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201
        assert response.json()["secret"] == custom_secret

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    @pytest.mark.api_version(V2026_10)
    async def test_2026_10_ignores_deprecated_secret(self, client: AsyncClient) -> None:
        custom_secret = "whsec_ovyN6cPrTv56AApvzCaJno08SSmGJmgbWilb33N2JuK"
        params = {
            "url": "https://example.com/hook",
            "format": "raw",
            "events": [],
            "secret": custom_secret,
        }
        response = await client.post("/v1/webhooks/endpoints", json=params)

        assert response.status_code == 201
        assert response.json()["secret"] != custom_secret
        assert response.json()["secret"].startswith("whsec_")


@pytest.mark.anyio
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    @pytest.mark.api_version(V2026_04)
    async def test_2026_04_accepts_deprecated_secret(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        custom_secret = "whsec_ovyN6cPrTv56AApvzCaJno08SSmGJmgbWilb33N2JuK"
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}",
            json={"secret": custom_secret},
        )

        assert response.status_code == 200
        assert response.json()["secret"] == custom_secret

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    @pytest.mark.api_version(V2026_10)
    async def test_2026_10_ignores_deprecated_secret(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        old_secret = await webhook_endpoint_organization.get_secret()
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}",
            json={
                "secret": "whsec_ovyN6cPrTv56AApvzCaJno08SSmGJmgbWilb33N2JuK",
                "url": "https://example.com/hook-updated",
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["secret"] == old_secret
        assert json["url"] == "https://example.com/hook-updated"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_mcp_toggle_enabled(
        self, client: AsyncClient, webhook_endpoint_mcp: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_mcp.id}",
            json={"enabled": False},
        )

        assert response.status_code == 200
        assert response.json()["enabled"] is False

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_mcp_read_only(
        self, client: AsyncClient, webhook_endpoint_mcp: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_mcp.id}",
            json={"name": "Renamed", "enabled": True},
        )

        assert response.status_code == 403


@pytest.mark.anyio
class TestResetWebhookEndpointSecret:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_valid(
        self, client: AsyncClient, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        old_secret = await webhook_endpoint_organization.get_secret()
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_organization.id}/secret"
        )

        assert response.status_code == 200
        assert response.json()["secret"] != old_secret

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_mcp(
        self, client: AsyncClient, webhook_endpoint_mcp: WebhookEndpoint
    ) -> None:
        response = await client.patch(
            f"/v1/webhooks/endpoints/{webhook_endpoint_mcp.id}/secret"
        )

        assert response.status_code == 403


@pytest.mark.anyio
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


@pytest.mark.anyio
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
