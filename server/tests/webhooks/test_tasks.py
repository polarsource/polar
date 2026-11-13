import json
import uuid
from unittest.mock import MagicMock

import httpx
import pytest
import respx
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.versioning import api_version_context
from polar.models import (
    Organization,
    Subscription,
    UserOrganization,
    WebhookEndpoint,
    WebhookEvent,
)
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from polar.subscription.schemas import Subscription as SubscriptionSchema
from polar.version import CURRENT_API_VERSION
from polar.webhook.service import webhook as webhook_service
from polar.webhook.tasks import (
    _webhook_event_failed_debounce_key,
    _webhook_event_send,
)
from tests.fixtures.database import SaveFixture


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.tasks.enqueue_job")


@pytest.mark.anyio
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
            api_version=CURRENT_API_VERSION,
            payload='{"foo":"bar"}',
        )
        await save_fixture(event)

        # Send should skip without error
        await _webhook_event_send(session, webhook_event_id=event.id)

        # Event should not be marked as succeeded or failed
        await session.refresh(event)
        assert event.succeeded is None

    async def test_missing_event_skips_send(self, session: AsyncSession) -> None:
        await _webhook_event_send(session, webhook_event_id=uuid.uuid4())

    async def test_mcp_envelope_and_headers(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        respx_mock: respx.MockRouter,
        organization: Organization,
        subscription: Subscription,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        mocker.patch("polar.webhook.service.enqueue_job")
        route = respx_mock.post(webhook_endpoint_mcp.url).mock(
            return_value=httpx.Response(200)
        )
        [event] = await webhook_service.send(
            session, organization, WebhookEventType.subscription_created, subscription
        )
        event_id, timestamp = event.id, event.created_at

        await _webhook_event_send(session, webhook_event_id=event_id)

        with api_version_context(CURRENT_API_VERSION):
            expected_data = SubscriptionSchema.model_validate(subscription).model_dump(
                mode="json"
            )
        request = route.calls.last.request
        assert json.loads(request.content) == {
            "eventId": str(event_id),
            "name": "subscription.created",
            "timestamp": timestamp.isoformat(),
            "data": expected_data,
            "cursor": None,
        }
        assert request.headers["webhook-id"] == str(event_id)
        assert request.headers["X-MCP-Subscription-Id"] == str(webhook_endpoint_mcp.id)

    async def test_mcp_gone_soft_deletes_endpoint(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        respx_mock: respx.MockRouter,
        enqueue_job_mock: MagicMock,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        respx_mock.post(webhook_endpoint_mcp.url).mock(return_value=httpx.Response(410))
        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_mcp,
            type=WebhookEventType.subscription_created,
            api_version=CURRENT_API_VERSION,
            payload='{"foo":"bar"}',
        )
        await save_fixture(event)

        await _webhook_event_send(session, webhook_event_id=event.id)

        await session.refresh(event)
        await session.refresh(webhook_endpoint_mcp)
        assert event.succeeded is False
        assert webhook_endpoint_mcp.deleted_at is not None
        enqueue_job_mock.assert_not_called()

    async def test_mcp_payload_too_large_does_not_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        respx_mock: respx.MockRouter,
        enqueue_job_mock: MagicMock,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        respx_mock.post(webhook_endpoint_mcp.url).mock(return_value=httpx.Response(413))
        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_mcp,
            type=WebhookEventType.subscription_created,
            api_version=CURRENT_API_VERSION,
            payload='{"foo":"bar"}',
        )
        await save_fixture(event)

        await _webhook_event_send(session, webhook_event_id=event.id)

        await session.refresh(event)
        assert event.succeeded is False
        enqueue_job_mock.assert_called_once_with(
            "webhook_event.failed",
            webhook_event_id=event.id,
            webhook_endpoint_id=webhook_endpoint_mcp.id,
        )


@pytest.mark.anyio
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
                api_version=CURRENT_API_VERSION,
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
                api_version=CURRENT_API_VERSION,
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
                api_version=CURRENT_API_VERSION,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)
            events.append(event)

        # Add a successful event in the middle
        success_event = WebhookEvent(
            webhook_endpoint_id=webhook_endpoint_organization.id,
            type=WebhookEventType.customer_created,
            api_version=CURRENT_API_VERSION,
            payload='{"foo":"bar"}',
            succeeded=True,
        )
        await save_fixture(success_event)

        # Add more failed events
        for i in range(2):
            event = WebhookEvent(
                webhook_endpoint_id=webhook_endpoint_organization.id,
                type=WebhookEventType.customer_created,
                api_version=CURRENT_API_VERSION,
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
            api_version=CURRENT_API_VERSION,
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
                api_version=CURRENT_API_VERSION,
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
                api_version=CURRENT_API_VERSION,
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
                api_version=CURRENT_API_VERSION,
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
                api_version=CURRENT_API_VERSION,
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

    async def test_soft_deletes_mcp_endpoint_without_email(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        webhook_endpoint_mcp: WebhookEndpoint,
    ) -> None:
        enqueue_email_mock = mocker.patch(
            "polar.webhook.service.enqueue_email_template"
        )
        for _ in range(settings.WEBHOOK_FAILURE_THRESHOLD):
            event = WebhookEvent(
                webhook_endpoint=webhook_endpoint_mcp,
                type=WebhookEventType.subscription_created,
                api_version=CURRENT_API_VERSION,
                payload='{"foo":"bar"}',
                succeeded=False,
            )
            await save_fixture(event)

        await webhook_service.on_event_failed(session, event.id)

        assert webhook_endpoint_mcp.deleted_at is not None
        assert webhook_endpoint_mcp.enabled is True
        enqueue_email_mock.assert_not_called()


class TestWebhookEventFailedDebounceKey:
    def test_collapses_concurrent_events_for_same_endpoint(self) -> None:
        endpoint_id = uuid.uuid4()
        first = _webhook_event_failed_debounce_key(uuid.uuid4(), endpoint_id)
        second = _webhook_event_failed_debounce_key(uuid.uuid4(), endpoint_id)
        assert first == second

    def test_no_key_without_endpoint(self) -> None:
        assert _webhook_event_failed_debounce_key(uuid.uuid4()) is None
