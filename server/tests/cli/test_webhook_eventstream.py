import uuid
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.redis import Redis
from polar.webhook.eventstream import publish_webhook_event


@pytest.fixture
def publish_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.eventstream.publish")


@pytest.mark.asyncio
class TestPublishWebhookEvent:
    async def test_skips_when_no_listener(
        self, publish_mock: MagicMock, redis: Redis
    ) -> None:
        org_id = uuid.uuid4()

        await publish_webhook_event(org_id, '{"type": "test"}')

        publish_mock.assert_not_called()

    async def test_publishes_when_listener_active(
        self, publish_mock: MagicMock, redis: Redis
    ) -> None:
        from polar.cli.listener import mark_active

        org_id = uuid.uuid4()
        await mark_active(redis, org_id)

        await publish_webhook_event(org_id, '{"type": "test"}')

        publish_mock.assert_called_once()
        call_kwargs = publish_mock.call_args
        assert call_kwargs[0][0] == "webhook.created"
        assert call_kwargs[1]["organization_id"] == org_id
        payload = call_kwargs[0][1]
        assert payload["payload"] == '{"type": "test"}'
        assert "webhook_event_id" in payload

    async def test_skips_after_listener_disconnects(
        self, publish_mock: MagicMock, redis: Redis
    ) -> None:
        from polar.cli.listener import mark_active, mark_inactive

        org_id = uuid.uuid4()
        await mark_active(redis, org_id)
        await mark_inactive(redis, org_id)

        await publish_webhook_event(org_id, '{"type": "test"}')

        publish_mock.assert_not_called()

    async def test_only_publishes_to_listening_org(
        self, publish_mock: MagicMock, redis: Redis
    ) -> None:
        from polar.cli.listener import mark_active

        listening_org = uuid.uuid4()
        other_org = uuid.uuid4()

        await mark_active(redis, listening_org)

        await publish_webhook_event(other_org, '{"type": "test"}')
        publish_mock.assert_not_called()

        await publish_webhook_event(listening_org, '{"type": "test"}')
        publish_mock.assert_called_once()
