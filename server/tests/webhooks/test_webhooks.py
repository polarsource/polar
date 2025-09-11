from typing import Any, cast
from unittest.mock import MagicMock

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


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.service.enqueue_job")


@pytest.mark.asyncio
async def test_webhook_send(
    session: AsyncSession,
    save_fixture: SaveFixture,
    enqueue_job_mock: MagicMock,
    organization: Organization,
    subscription: Subscription,
) -> None:
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.subscription_created],  # subscribe to event
    )
    await save_fixture(endpoint)

    events = await webhook_service.send(
        session, organization, WebhookEventType.subscription_created, subscription
    )
    assert len(events) == 1

    event = events[0]
    assert event.webhook_endpoint == endpoint

    enqueue_job_mock.assert_called_once_with(
        "webhook_event.send", webhook_event_id=event.id
    )


@pytest.mark.asyncio
async def test_webhook_send_not_subscribed_to_event(
    session: AsyncSession,
    save_fixture: SaveFixture,
    enqueue_job_mock: MagicMock,
    organization: Organization,
    subscription: Subscription,
) -> None:
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[],  # not subscribing
    )
    await save_fixture(endpoint)

    events = await webhook_service.send(
        session, organization, WebhookEventType.subscription_created, subscription
    )

    assert len(events) == 0
    enqueue_job_mock.assert_not_called()


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

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        payload='{"foo":"bar"}',
    )
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

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        payload='{"foo":"bar"}',
    )
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

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        payload='{"foo":"bar"}',
    )
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

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Check that the generated signature is correct
    request = route_mock.calls.last.request
    w = StandardWebhook(secret.encode("utf-8"))
    assert w.verify(request.content, cast(dict[str, str], request.headers)) is not None
