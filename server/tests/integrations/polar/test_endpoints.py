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
        "billing_name": None,
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
        "visibility": "public",
        "visibility_configurable": False,
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


_SUBSCRIPTION: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-000000000010",
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": None,
    "amount": 0,
    "currency": "usd",
    "recurring_interval": "month",
    "recurring_interval_count": 1,
    "status": "canceled",
    "current_period_start": "2026-01-01T00:00:00Z",
    "current_period_end": "2026-02-01T00:00:00Z",
    "trial_start": None,
    "trial_end": None,
    "cancel_at_period_end": False,
    "canceled_at": "2026-01-15T00:00:00Z",
    "started_at": "2026-01-01T00:00:00Z",
    "ends_at": None,
    "ended_at": "2026-01-15T00:00:00Z",
    "customer_id": "00000000-0000-0000-0000-000000000002",
    "product_id": "00000000-0000-0000-0000-0000000000c1",
    "discount_id": None,
    "checkout_id": None,
    "customer_cancellation_reason": None,
    "customer_cancellation_comment": None,
    "metadata": {},
    "customer": {
        "id": "00000000-0000-0000-0000-000000000002",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "metadata": {},
        "email": "c@example.com",
        "email_verified": True,
        "type": "team",
        "name": "c",
        "billing_name": None,
        "billing_address": None,
        "tax_id": None,
        "organization_id": "00000000-0000-0000-0000-000000000099",
        "deleted_at": None,
        "avatar_url": "",
        "external_id": "00000000-0000-0000-0000-00000000000a",
    },
    "product": {
        "id": "00000000-0000-0000-0000-0000000000c1",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "trial_interval": None,
        "trial_interval_count": None,
        "name": "Pro",
        "description": None,
        "visibility": "public",
        "recurring_interval": "month",
        "recurring_interval_count": 1,
        "is_recurring": True,
        "is_archived": False,
        "organization_id": "00000000-0000-0000-0000-000000000099",
        "metadata": {},
        "prices": [],
        "benefits": [],
        "medias": [],
        "attached_custom_fields": [],
    },
    "discount": None,
    "prices": [],
    "meters": [],
    "pending_update": None,
}


def _subscription_event(event_type: str) -> dict[str, Any]:
    return {
        "type": event_type,
        "timestamp": "2026-01-01T00:00:00Z",
        "data": _SUBSCRIPTION,
    }


_ORDER: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-000000000020",
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": None,
    "status": "paid",
    "paid": True,
    "subtotal_amount": 2000,
    "discount_amount": 0,
    "net_amount": 2000,
    "tax_amount": 0,
    "total_amount": 2000,
    "applied_balance_amount": 0,
    "due_amount": 2000,
    "refunded_amount": 0,
    "refunded_tax_amount": 0,
    "refundable_amount": 2000,
    "refundable_tax_amount": 0,
    "receipt_number": None,
    "currency": "usd",
    "billing_reason": "subscription_cycle",
    "billing_name": None,
    "billing_address": None,
    "invoice_number": "POLAR-0001",
    "is_invoice_generated": True,
    "customer_id": "00000000-0000-0000-0000-000000000002",
    "product_id": "00000000-0000-0000-0000-0000000000c1",
    "discount_id": None,
    "subscription_id": "00000000-0000-0000-0000-000000000001",
    "checkout_id": None,
    "metadata": {},
    "platform_fee_amount": 0,
    "platform_fee_currency": None,
    "customer": _SUBSCRIPTION["customer"],
    "product": _SUBSCRIPTION["product"],
    "discount": None,
    "subscription": None,
    "items": [],
    "description": "Pro subscription",
}


def _order_event(event_type: str) -> dict[str, Any]:
    return {
        "type": event_type,
        "timestamp": "2026-01-01T00:00:00Z",
        "data": _ORDER,
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
        body, headers = _sign(_subscription_event("subscription.canceled"))

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
        assert call.kwargs["delay"] is None

    async def test_order_created_is_enqueued_with_delay(
        self,
        client: AsyncClient,
        enqueue_mock: AsyncMock,
    ) -> None:
        # Defer order.created processing so payment settlement and invoice
        # generation have time to complete on Polar's side.
        payload = _order_event("order.created")
        body, headers = _sign(payload, msg_id="msg_order.created")

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        enqueue_mock.assert_awaited_once()
        call = enqueue_mock.await_args
        assert call is not None
        assert call.args[2] == "polar_self.webhook.order.created"
        assert call.kwargs["delay"] == 60_000

    async def test_subscription_revoked_is_ignored(
        self,
        client: AsyncClient,
        enqueue_mock: AsyncMock,
    ) -> None:
        payload = _subscription_event("subscription.revoked")
        body, headers = _sign(payload, msg_id="msg_subscription.revoked")

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        enqueue_mock.assert_not_awaited()
