import base64
import json
import ssl
from datetime import timedelta
from typing import Any
from uuid import UUID

import httpx
import pytest
import respx
from httpx import AsyncClient
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.kit.utils import utc_now
from polar.mcp_event.catalog import MCP_EVENTS
from polar.models import Organization, User, WebhookEndpoint
from polar.models.user_organization import OrganizationRole, UserOrganization
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture

CALLBACK_URL = "https://example.com/callback"
SECRET = "whsec_" + base64.b64encode(b"a" * 32).decode()


@pytest.fixture
def callback_route(respx_mock: respx.MockRouter) -> respx.Route:
    return respx_mock.post(CALLBACK_URL).mock(
        side_effect=lambda request: httpx.Response(
            200, json={"challenge": json.loads(request.content)["challenge"]}
        )
    )


@pytest.mark.anyio
class TestListMCPEvents:
    @pytest.mark.auth
    async def test_user(self, client: AsyncClient) -> None:
        response = await client.get("/v1/mcp/events/")

        assert response.status_code == 200
        items = response.json()["items"]
        assert [item["name"] for item in items] == list(MCP_EVENTS)
        assert items[0]["input_schema"]["required"] == ["organization_id"]
        assert items[0]["input_schema"]["additionalProperties"] is False
        assert "id" in items[0]["payload_schema"]["properties"]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(self, client: AsyncClient) -> None:
        response = await client.get("/v1/mcp/events/")

        assert response.status_code == 200
        input_schema = response.json()["items"][0]["input_schema"]
        assert input_schema["properties"] == {}
        assert input_schema["additionalProperties"] is False


@pytest.mark.anyio
class TestSubscribeMCPEvent:
    @pytest.mark.auth
    async def test_create(
        self,
        client: AsyncClient,
        session: AsyncSession,
        callback_route: respx.Route,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        before = utc_now()

        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "order.paid",
                "arguments": {"organization_id": str(organization.id)},
                "url": CALLBACK_URL,
                "secret": SECRET,
                "ttl_ms": 60_000,
            },
        )

        assert response.status_code == 200
        json_response = response.json()
        request = callback_route.calls.last.request
        StandardWebhook(SECRET).verify(request.content, dict(request.headers))
        assert request.headers["X-MCP-Subscription-Id"] == json_response["id"]

        endpoint = await session.get(WebhookEndpoint, UUID(json_response["id"]))
        assert endpoint is not None
        assert endpoint.format == WebhookFormat.mcp
        assert endpoint.events == [WebhookEventType.order_paid]
        assert endpoint.organization_id == organization.id
        assert endpoint.expires_at is not None
        assert (
            before + timedelta(minutes=1)
            <= endpoint.expires_at
            <= utc_now() + timedelta(minutes=1)
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_ttl_clamped(
        self,
        client: AsyncClient,
        session: AsyncSession,
        callback_route: respx.Route,
    ) -> None:
        before = utc_now()

        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "order.paid",
                "arguments": {},
                "url": CALLBACK_URL,
                "secret": SECRET,
                "ttl_ms": 10**18,
            },
        )

        assert response.status_code == 200
        endpoint = await session.get(WebhookEndpoint, UUID(response.json()["id"]))
        assert endpoint is not None
        assert endpoint.expires_at is not None
        assert (
            before + timedelta(hours=24)
            <= endpoint.expires_at
            <= utc_now() + timedelta(hours=24)
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_refresh_skips_verification(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        session: AsyncSession,
        respx_mock: respx.MockRouter,
        organization: Organization,
    ) -> None:
        route = respx_mock.post(CALLBACK_URL)
        expires_at = utc_now() + timedelta(minutes=5)
        endpoint = WebhookEndpoint(
            format=WebhookFormat.mcp,
            events=[WebhookEventType.order_paid],
            url=CALLBACK_URL,
            secret="whsec_old",
            organization=organization,
            expires_at=expires_at,
        )
        await save_fixture(endpoint)

        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "order.paid",
                "arguments": {},
                "url": CALLBACK_URL,
                "secret": SECRET,
            },
        )

        assert response.status_code == 200
        assert response.json()["id"] == str(endpoint.id)
        assert not route.called
        refreshed = await session.get(WebhookEndpoint, endpoint.id)
        assert refreshed is not None
        assert refreshed.secret == SECRET
        assert refreshed.secret_generated_at is not None
        assert refreshed.expires_at is not None
        assert refreshed.expires_at > expires_at

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize(
        "override",
        [
            pytest.param({"arguments": {"foo": "bar"}}, id="arguments"),
            pytest.param({"secret": "whsec_c2hvcnQ="}, id="secret"),
        ],
    )
    async def test_invalid_payload(
        self, client: AsyncClient, override: dict[str, Any]
    ) -> None:
        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "order.paid",
                "arguments": {},
                "url": CALLBACK_URL,
                "secret": SECRET,
                **override,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize(
        ("mock", "reason"),
        [
            pytest.param(
                {"side_effect": httpx.ConnectError("refused")},
                "connection_refused",
                id="connection_refused",
            ),
            pytest.param(
                {"side_effect": httpx.ConnectTimeout("timeout")},
                "timeout",
                id="timeout",
            ),
            pytest.param({"side_effect": ssl.SSLError()}, "tls_error", id="tls_error"),
            pytest.param(
                {"return_value": httpx.Response(404)}, "http_4xx", id="http_4xx"
            ),
            pytest.param(
                {"return_value": httpx.Response(502)}, "http_5xx", id="http_5xx"
            ),
            pytest.param(
                {"return_value": httpx.Response(200, json={"challenge": "wrong"})},
                "challenge_failed",
                id="challenge_failed",
            ),
            pytest.param(
                {"return_value": httpx.Response(200, json={"challenge": "é"})},
                "challenge_failed",
                id="challenge_non_ascii",
            ),
        ],
    )
    async def test_callback_error(
        self,
        client: AsyncClient,
        respx_mock: respx.MockRouter,
        mock: dict[str, Any],
        reason: str,
    ) -> None:
        respx_mock.post(CALLBACK_URL).mock(**mock)

        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "order.paid",
                "arguments": {},
                "url": CALLBACK_URL,
                "secret": SECRET,
            },
        )

        assert response.status_code == 400
        assert response.json() == {"error": "CallbackEndpointError", "detail": reason}

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_unknown_event(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "checkout.created",
                "arguments": {},
                "url": CALLBACK_URL,
                "secret": SECRET,
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_missing_permission(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
    ) -> None:
        await save_fixture(
            UserOrganization(
                user=user, organization=organization, role=OrganizationRole.member
            )
        )

        response = await client.post(
            "/v1/mcp/events/subscribe",
            json={
                "name": "order.paid",
                "arguments": {"organization_id": str(organization.id)},
                "url": CALLBACK_URL,
                "secret": SECRET,
            },
        )

        assert response.status_code == 403


@pytest.mark.anyio
class TestUnsubscribeMCPEvent:
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_soft_deletes(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        endpoint = WebhookEndpoint(
            format=WebhookFormat.mcp,
            events=[WebhookEventType.order_paid],
            url=CALLBACK_URL,
            secret=SECRET,
            organization=organization,
            expires_at=utc_now() + timedelta(hours=1),
        )
        await save_fixture(endpoint)

        response = await client.post(
            "/v1/mcp/events/unsubscribe",
            json={"name": "order.paid", "arguments": {}, "url": CALLBACK_URL},
        )

        assert response.status_code == 204
        deleted = await session.get(WebhookEndpoint, endpoint.id)
        assert deleted is not None
        assert deleted.deleted_at is not None

        response = await client.post(
            "/v1/mcp/events/unsubscribe",
            json={"name": "order.paid", "arguments": {}, "url": CALLBACK_URL},
        )
        assert response.status_code == 204
