from typing import Any, cast

import dramatiq
import httpx
import pytest
import respx
from dramatiq import Retry
from pytest_mock import MockerFixture
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.models.organization import Organization
from polar.models.subscription import Subscription
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.models.webhook_event import WebhookEvent
from polar.webhook.service import webhook as webhook_service
from polar.webhook.tasks import _webhook_event_send, webhook_event_send
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
async def test_webhook_send(
    session: AsyncSession,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
    organization: Organization,
    subscription: Subscription,
) -> None:
    called = False

    def in_process_enqueue_job(name, *args, **kwargs) -> None:  # type: ignore  # noqa: E501
        nonlocal called
        if name == "webhook_event.send":
            called = True
            assert kwargs["webhook_event_id"]
            return
        raise Exception(f"unexpected job: {name}")

    mocker.patch("polar.webhook.service.enqueue_job", new=in_process_enqueue_job)

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.subscription_created],  # subscribe to event
    )
    await save_fixture(endpoint)

    await webhook_service.send(
        session, organization, WebhookEventType.subscription_created, subscription
    )

    assert called


@pytest.mark.asyncio
async def test_webhook_send_not_subscribed_to_event(
    session: AsyncSession,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
    organization: Organization,
    subscription: Subscription,
) -> None:
    called = False

    def in_process_enqueue_job(name, *args, **kwargs) -> None:  # type: ignore  # noqa: E501
        nonlocal called
        if name == "webhook_event.send":
            called = True
            assert kwargs["webhook_event_id"]
            return
        raise Exception(f"unexpected job: {name}")

    mocker.patch("polar.webhook.service.enqueue_job", new=in_process_enqueue_job)

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[],  # not subscribing
    )
    await save_fixture(endpoint)

    await webhook_service.send(
        session, organization, WebhookEventType.subscription_created, subscription
    )

    assert called is False


@pytest.mark.asyncio
async def test_webhook_delivery(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    respx_mock.post("https://example.com/hook").mock(return_value=httpx.Response(200))

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    await webhook_event_send(webhook_event_id=event.id)


@pytest.mark.asyncio
async def test_webhook_delivery_500(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    current_message: dramatiq.Message[Any],
) -> None:
    respx_mock.post("https://example.com/hook").mock(return_value=httpx.Response(500))

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # failures
    with pytest.raises(Retry):
        await _webhook_event_send(session=session, webhook_event_id=event.id)

    # does not raise on last attempt
    current_message.options["max_retries"] = settings.WEBHOOK_MAX_RETRIES
    current_message.options["retries"] = settings.WEBHOOK_MAX_RETRIES
    await _webhook_event_send(session=session, webhook_event_id=event.id)


@pytest.mark.asyncio
async def test_webhook_delivery_http_error(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    current_message: dramatiq.Message[Any],
) -> None:
    respx_mock.post("https://example.com/hook").mock(
        side_effect=httpx.HTTPError("ERROR")
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # failures
    for job_try in range(settings.WORKER_MAX_RETRIES):
        with pytest.raises(Retry):
            await _webhook_event_send(session=session, webhook_event_id=event.id)

    # does not raise on last attempt
    current_message.options["max_retries"] = settings.WEBHOOK_MAX_RETRIES
    current_message.options["retries"] = settings.WEBHOOK_MAX_RETRIES
    await _webhook_event_send(session=session, webhook_event_id=event.id)


@pytest.mark.asyncio
async def test_webhook_standard_webhooks_compatible(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    secret = "mysecret"
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret=secret,
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Check that the generated signature is correct
    request = route_mock.calls.last.request
    w = StandardWebhook(secret.encode("utf-8"))
    assert w.verify(request.content, cast(dict[str, str], request.headers)) is not None


@pytest.mark.asyncio
async def test_webhook_event_skipped_when_endpoint_no_longer_supports_event_type(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    """Test that webhook events are skipped when endpoint no longer supports the event type."""
    # Mock HTTP endpoint - should never be called
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    # Create endpoint that only supports order.created events
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.order_created],  # Only supports order.created
    )
    await save_fixture(endpoint)

    # Create a webhook event for subscription.created (not supported by endpoint)
    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        payload='{"type": "subscription.created", "data": {"id": "sub_123"}}',
        succeeded=None,  # Not yet processed
    )
    await save_fixture(event)

    # Process the webhook event
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Refresh the event from database to check its status
    await session.refresh(event)

    # The event should be marked as succeeded (to prevent retries)
    assert event.succeeded is True

    # The HTTP endpoint should never have been called
    assert len(route_mock.calls) == 0


@pytest.mark.asyncio
async def test_webhook_event_processed_when_endpoint_supports_event_type(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    """Test that webhook events are processed normally when endpoint supports the event type."""
    # Mock HTTP endpoint - should be called
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    # Create endpoint that supports subscription.created events
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.subscription_created],  # Supports subscription.created
    )
    await save_fixture(endpoint)

    # Create a webhook event for subscription.created (supported by endpoint)
    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        payload='{"type": "subscription.created", "data": {"id": "sub_123"}}',
        succeeded=None,  # Not yet processed
    )
    await save_fixture(event)

    # Process the webhook event
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Refresh the event from database to check its status
    await session.refresh(event)

    # The event should be marked as succeeded after successful delivery
    assert event.succeeded is True

    # The HTTP endpoint should have been called exactly once
    assert len(route_mock.calls) == 1


@pytest.mark.asyncio
async def test_webhook_event_processed_with_malformed_payload(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    """Test that webhook events with malformed payloads are still processed (fallback behavior)."""
    # Mock HTTP endpoint - should be called despite malformed payload
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    # Create endpoint
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.subscription_created],
    )
    await save_fixture(endpoint)

    # Create a webhook event with malformed JSON payload
    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        payload='{"invalid": json}',  # Malformed JSON
        succeeded=None,  # Not yet processed
    )
    await save_fixture(event)

    # Process the webhook event - should not raise an exception
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Refresh the event from database to check its status
    await session.refresh(event)

    # The event should be marked as succeeded (webhook was delivered despite parsing error)
    assert event.succeeded is True

    # The HTTP endpoint should have been called (fallback behavior)
    assert len(route_mock.calls) == 1
