import base64
import json
from datetime import UTC, datetime
from math import floor
from typing import Any

import pytest
from httpx2 import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy import select
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.models.external_event import ExternalEvent, ExternalEventSource
from polar.postgres import AsyncSession

WEBHOOK_SECRET = base64.b64encode(b"test_payment_retry_alert").decode()
WEBHOOK_URL = "/v1/integrations/payment-retry-alert/webhook"


def sign(event: dict[str, Any]) -> tuple[bytes, dict[str, str]]:
    body = json.dumps(event).encode()
    now = datetime.now(UTC)
    headers = {
        "webhook-id": "msg_test",
        "webhook-timestamp": str(floor(now.timestamp())),
        "webhook-signature": StandardWebhook(WEBHOOK_SECRET).sign(
            "msg_test", now, body.decode()
        ),
    }
    return body, headers


@pytest.fixture(autouse=True)
def webhook_secret(mocker: MockerFixture) -> None:
    mocker.patch(
        "polar.integrations.payment_retry_alert.endpoints.settings.PAYMENT_RETRY_ALERT_WEBHOOK_SECRET",
        f"whsec_{WEBHOOK_SECRET}",
    )


@pytest.mark.anyio
class TestWebhook:
    @pytest.mark.parametrize(
        ("signature", "status_code", "stored"),
        [
            pytest.param(None, 202, True, id="valid"),
            pytest.param("v1,invalid", 400, False, id="invalid_signature"),
        ],
    )
    async def test_alert_created(
        self,
        signature: str | None,
        status_code: int,
        stored: bool,
        client: AsyncClient,
        session: AsyncSession,
    ) -> None:
        event = {
            "id": "evt_test",
            "type": "alert.created",
            "data": {"object": {"id": "alrt_test"}},
        }
        body, headers = sign(event)
        if signature is not None:
            headers["webhook-signature"] = signature

        response = await client.post(WEBHOOK_URL, content=body, headers=headers)

        assert response.status_code == status_code
        stored_event = (
            await session.execute(
                select(ExternalEvent).where(
                    ExternalEvent.source == ExternalEventSource.payment_retry_alert,
                    ExternalEvent.external_id == "evt_test",
                )
            )
        ).scalar_one_or_none()
        assert (stored_event is not None) == stored
        if stored_event is not None:
            assert stored_event.data == event
