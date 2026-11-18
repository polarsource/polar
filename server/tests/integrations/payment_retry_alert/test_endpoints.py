import base64
import json
from datetime import UTC, datetime
from math import floor
from typing import Any
from unittest.mock import AsyncMock

import pytest
from httpx2 import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy import select
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.models.external_event import ExternalEvent, ExternalEventSource
from polar.postgres import AsyncSession

WEBHOOK_SECRET = "whsec_" + base64.b64encode(b"test_payment_retry_alert").decode()
WEBHOOK_URL = "/v1/integrations/payment-retry-alert/webhook"


def _event(
    *, type: str = "alert.created", organisation_mode: str = "TEST"
) -> dict[str, Any]:
    return {
        "id": "evt_test",
        "object": "event",
        "type": type,
        "api_version": "2026-10-05",
        "organisation_mode": organisation_mode,
        "created_at": "2026-11-18T10:00:00.000Z",
        "data": {"object": {"id": "alrt_test", "notification_type": "RETRY_NOW"}},
    }


def _sign(payload: dict[str, Any]) -> tuple[bytes, dict[str, str]]:
    body = json.dumps(payload).encode()
    now = datetime.now(UTC)
    signature = StandardWebhook(WEBHOOK_SECRET.removeprefix("whsec_")).sign(
        "msg_test", now, body.decode()
    )
    headers = {
        "webhook-id": "msg_test",
        "webhook-timestamp": str(floor(now.timestamp())),
        "webhook-signature": signature,
        "content-type": "application/json",
    }
    return body, headers


@pytest.fixture(autouse=True)
def webhook_secret(mocker: MockerFixture) -> None:
    mocker.patch(
        "polar.integrations.payment_retry_alert.endpoints.settings.PAYMENT_RETRY_ALERT_WEBHOOK_SECRET",
        WEBHOOK_SECRET,
    )


@pytest.fixture
def enqueue_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch(
        "polar.integrations.payment_retry_alert.endpoints.external_event_service.enqueue",
        new_callable=AsyncMock,
    )


@pytest.mark.anyio
class TestWebhook:
    async def test_invalid_signature(
        self, client: AsyncClient, enqueue_mock: AsyncMock
    ) -> None:
        body, headers = _sign(_event())
        headers["webhook-signature"] = "v1,invalid"

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 400
        enqueue_mock.assert_not_called()

    async def test_missing_secret(
        self, client: AsyncClient, enqueue_mock: AsyncMock, mocker: MockerFixture
    ) -> None:
        mocker.patch(
            "polar.integrations.payment_retry_alert.endpoints.settings.PAYMENT_RETRY_ALERT_WEBHOOK_SECRET",
            "",
        )
        body, headers = _sign(_event())

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 500
        enqueue_mock.assert_not_called()

    @pytest.mark.parametrize(
        "event",
        [
            pytest.param(_event(organisation_mode="LIVE"), id="other_mode"),
            pytest.param(_event(type="enrolment.updated"), id="unhandled_type"),
        ],
    )
    async def test_ignored(
        self, event: dict[str, Any], client: AsyncClient, enqueue_mock: AsyncMock
    ) -> None:
        body, headers = _sign(event)

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        enqueue_mock.assert_not_called()

    async def test_alert_created_is_stored(
        self, client: AsyncClient, session: AsyncSession
    ) -> None:
        event = _event()
        body, headers = _sign(event)

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == 202
        stored_event = (
            await session.execute(
                select(ExternalEvent).where(
                    ExternalEvent.source == ExternalEventSource.payment_retry_alert,
                    ExternalEvent.external_id == "evt_test",
                )
            )
        ).scalar_one()
        assert stored_event.task_name == "payment_retry_alert.webhook.alert.created"
        assert stored_event.data == event
