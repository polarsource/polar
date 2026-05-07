import base64
import json
from datetime import UTC, datetime
from math import floor
from typing import Any
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture
from standardwebhooks.webhooks import Webhook as StandardWebhook

WEBHOOK_SECRET = "test_polar_webhook_secret"
WEBHOOK_URL = "/v1/integrations/polar/webhook"

_BENEFIT_GRANT: dict[str, Any] = {
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": None,
    "id": "00000000-0000-0000-0000-0000000000a1",
    "is_granted": True,
    "is_revoked": False,
    "subscription_id": "00000000-0000-0000-0000-000000000001",
    "order_id": None,
    "customer_id": "00000000-0000-0000-0000-000000000002",
    "benefit_id": "00000000-0000-0000-0000-0000000000b1",
    "customer": {
        "id": "00000000-0000-0000-0000-000000000002",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "metadata": {},
        "email": "c@example.com",
        "email_verified": True,
        "type": "individual",
        "name": "c",
        "billing_address": None,
        "tax_id": None,
        "organization_id": "00000000-0000-0000-0000-000000000099",
        "deleted_at": None,
        "avatar_url": "",
    },
    "benefit": {
        "id": "00000000-0000-0000-0000-0000000000b1",
        "type": "custom",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "description": "",
        "selectable": True,
        "deletable": True,
        "is_deleted": False,
        "organization_id": "00000000-0000-0000-0000-000000000099",
        "metadata": {},
        "properties": {"note": None},
    },
    "properties": {},
}


def _benefit_grant_event(event_type: str) -> dict[str, Any]:
    return {
        "type": event_type,
        "timestamp": "2026-01-01T00:00:00Z",
        "data": _BENEFIT_GRANT,
    }


def _sign(
    payload: dict[str, Any], *, msg_id: str = "msg_test"
) -> tuple[bytes, dict[str, str]]:
    body = json.dumps(payload).encode("utf-8")
    b64 = base64.b64encode(WEBHOOK_SECRET.encode("utf-8")).decode("utf-8")
    wh = StandardWebhook(b64)
    now = datetime.now(UTC)
    signature = wh.sign(msg_id, now, body.decode("utf-8"))
    headers = {
        "webhook-id": msg_id,
        "webhook-timestamp": str(floor(now.timestamp())),
        "webhook-signature": signature,
        "content-type": "application/json",
    }
    return body, headers


@pytest.fixture(autouse=True)
def _set_webhook_secret(mocker: MockerFixture) -> None:
    mocker.patch(
        "polar.integrations.polar.endpoints.settings.POLAR_WEBHOOK_SECRET",
        WEBHOOK_SECRET,
    )


@pytest.fixture
def enqueue_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch(
        "polar.integrations.polar.endpoints.external_event_service.enqueue",
        new=AsyncMock(),
    )


@pytest.mark.asyncio
class TestWebhook:
    async def test_invalid_signature_returns_401(
        self, client: AsyncClient, enqueue_mock: AsyncMock
    ) -> None:
        body = json.dumps(_benefit_grant_event("subscription.active")).encode()
        response = await client.post(
            WEBHOOK_URL,
            content=body,
            headers={
                "webhook-id": "msg_x",
                "webhook-timestamp": "1",
                "webhook-signature": "v1,bogus",
                "content-type": "application/json",
            },
        )

        assert response.status_code == 401
        enqueue_mock.assert_not_called()

    async def test_missing_secret_returns_500(
        self,
        client: AsyncClient,
        enqueue_mock: AsyncMock,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.integrations.polar.endpoints.settings.POLAR_WEBHOOK_SECRET", ""
        )
        body, headers = _sign(_benefit_grant_event("subscription.active"))

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 500
        enqueue_mock.assert_not_called()

    async def test_unhandled_event_type_is_ignored(
        self, client: AsyncClient, enqueue_mock: AsyncMock
    ) -> None:
        # subscription.canceled is a valid (parseable) Polar event type, but
        # not in IMPLEMENTED_WEBHOOKS.
        body, headers = _sign(_benefit_grant_event("subscription.canceled"))

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        enqueue_mock.assert_not_called()

    async def test_unknown_event_type_is_ignored(
        self, client: AsyncClient, enqueue_mock: AsyncMock
    ) -> None:
        # Event type the SDK doesn't know about — forward-compat path.
        body, headers = _sign({"type": "future.event", "data": {}})

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        enqueue_mock.assert_not_called()

    @pytest.mark.parametrize(
        "event_type",
        [
            "benefit_grant.created",
            "benefit_grant.updated",
            "benefit_grant.revoked",
        ],
    )
    async def test_implemented_event_is_enqueued(
        self,
        client: AsyncClient,
        enqueue_mock: AsyncMock,
        event_type: str,
    ) -> None:
        payload = _benefit_grant_event(event_type)
        body, headers = _sign(payload, msg_id=f"msg_{event_type}")

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        enqueue_mock.assert_awaited_once()
        call = enqueue_mock.await_args
        assert call is not None
        assert call.args[1].value == "polar"
        assert call.args[2] == f"polar_self.webhook.{event_type}"
        assert call.args[3] == f"msg_{event_type}"
        assert call.args[4] == payload
