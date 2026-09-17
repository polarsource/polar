import json
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

import polar.worker._health as health_module
from polar.kit.utils import utc_now
from polar.models import WebhookDelivery, WebhookEndpoint, WebhookEvent
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestWebhooks:
    async def test_counts_only_unattempted_pending_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
        mocker: MockerFixture,
    ) -> None:
        now = utc_now()
        mocker.patch.object(health_module, "utc_now", return_value=now)
        request = MagicMock()
        request.state.async_sessionmaker.return_value.__aenter__.return_value = session
        event_fields = {
            "webhook_endpoint": webhook_endpoint_organization,
            "type": WebhookEventType.customer_created,
            "payload": "{}",
            "created_at": now - timedelta(minutes=10),
        }

        excluded_event_fields: list[dict[str, object]] = [
            {"created_at": now - timedelta(minutes=5)},
            {"created_at": now - timedelta(hours=6)},
            {"payload": None},
            {"skipped": True},
            {"deleted_at": now},
            {"succeeded": True},
            {"succeeded": False},
        ]
        for excluded_fields in excluded_event_fields:
            await save_fixture(WebhookEvent(**(event_fields | excluded_fields)))

        for succeeded, deleted_at in [(True, None), (False, None), (False, now)]:
            event = WebhookEvent(**event_fields)
            await save_fixture(event)
            await save_fixture(
                WebhookDelivery(
                    webhook_event=event,
                    webhook_endpoint=webhook_endpoint_organization,
                    succeeded=succeeded,
                    deleted_at=deleted_at,
                )
            )

        for count in range(13):
            if count:
                await save_fixture(WebhookEvent(**event_fields))

            response = await health_module.webhooks(request)

            assert response.status_code == (503 if count > 10 else 200)
            assert json.loads(bytes(response.body)) == (
                {"status": "error", "undelivered_webhooks": count}
                if count > 10
                else {"status": "ok"}
            )
