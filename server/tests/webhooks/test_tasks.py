from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.models import WebhookEndpoint, WebhookEvent
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from polar.webhook.service import webhook as webhook_service
from polar.webhook.tasks import _webhook_event_send
from tests.fixtures.database import SaveFixture


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.tasks.enqueue_job")


@pytest.mark.asyncio
class TestWebhookEventSend:
    async def test_disabled_endpoint_skips_send(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Disable the endpoint
        webhook_endpoint_organization.enabled = False
        await save_fixture(webhook_endpoint_organization)

        # Create an event for the disabled endpoint
        event = WebhookEvent(
            webhook_endpoint_id=webhook_endpoint_organization.id,
            type=WebhookEventType.customer_created,
            payload='{"foo":"bar"}',
        )
        await save_fixture(event)

        # Send should skip without error
        await _webhook_event_send(session, webhook_event_id=event.id)

        # Event should not be marked as succeeded or failed
        await session.refresh(event)
        assert event.succeeded is None


@pytest.mark.asyncio
class TestOnEventFailed:
    async def test_disables_endpoint_after_threshold_failures(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Create multiple failed events
        events = []
        for i in range(settings.WEBHOOK_FAILURE_THRESHOLD):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Trigger the failure handler
        await webhook_service.on_event_failed(session, events[-1].id)

        # Check that the endpoint is now disabled
        await session.refresh(webhook_endpoint_organization)
        assert webhook_endpoint_organization.enabled is False

    async def test_does_not_disable_endpoint_below_threshold(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Create fewer failed events than threshold
        events = []
        for i in range(settings.WEBHOOK_FAILURE_THRESHOLD - 1):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Trigger the failure handler
        await webhook_service.on_event_failed(session, events[-1].id)

        # Check that the endpoint is still enabled
        await session.refresh(webhook_endpoint_organization)
        assert webhook_endpoint_organization.enabled is True

    async def test_does_not_disable_with_mixed_results(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Create failed events
        events = []
        for i in range(settings.WEBHOOK_FAILURE_THRESHOLD - 2):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Add a successful event in the middle
        success_event = WebhookEvent(
            webhook_endpoint_id=webhook_endpoint_organization.id,
            type=WebhookEventType.customer_created,
            payload='{"foo":"bar"}',
            succeeded=True,
        )
        await save_fixture(success_event)

        # Add more failed events
        for i in range(2):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Trigger the failure handler
        await webhook_service.on_event_failed(session, events[-1].id)

        # Check that the endpoint is still enabled (success broke the streak)
        await session.refresh(webhook_endpoint_organization)
        assert webhook_endpoint_organization.enabled is True

    async def test_ignores_already_disabled_endpoint(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Disable the endpoint first
        webhook_endpoint_organization.enabled = False
        await save_fixture(webhook_endpoint_organization)

        # Create a failed event
        event = WebhookEvent(
            webhook_endpoint_id=webhook_endpoint_organization.id,
            type=WebhookEventType.customer_created,
            payload='{"foo":"bar"}',
            succeeded=False,
        )
        await save_fixture(event)

        # Trigger the failure handler
        await webhook_service.on_event_failed(session, event.id)

        # Endpoint should remain disabled
        await session.refresh(webhook_endpoint_organization)
        assert webhook_endpoint_organization.enabled is False

    async def test_disables_endpoint_ignoring_pending_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Create threshold number of failed events
        events = []
        for i in range(settings.WEBHOOK_FAILURE_THRESHOLD):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Add some pending events (succeeded=None) - these should be ignored
        for i in range(5):
            pending_event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=None,
            )
            await save_fixture(pending_event)

        # Trigger the failure handler on one of the failed events
        await webhook_service.on_event_failed(session, events[-1].id)

        # Check that the endpoint is disabled (pending events should not block this)
        await session.refresh(webhook_endpoint_organization)
        assert webhook_endpoint_organization.enabled is False

    async def test_marks_pending_events_as_skipped_when_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        # Create threshold number of failed events
        events = []
        for i in range(settings.WEBHOOK_FAILURE_THRESHOLD):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Add some pending events (succeeded=None)
        pending_events = []
        for i in range(3):
            pending_event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                payload='{"foo":"bar"}',
                succeeded=None,
                skipped=False,
            )
            await save_fixture(pending_event)
            pending_events.append(pending_event)

        # Trigger the failure handler
        await webhook_service.on_event_failed(session, events[-1].id)

        # Check that the endpoint is disabled
        await session.refresh(webhook_endpoint_organization)
        assert webhook_endpoint_organization.enabled is False

        # Check that pending events are now marked as skipped
        for pending_event in pending_events:
            await session.refresh(pending_event)
            assert pending_event.skipped is True
