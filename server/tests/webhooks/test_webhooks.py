from datetime import timedelta
from typing import cast
from unittest.mock import MagicMock

import dramatiq
import httpx
import pytest
import respx
from dramatiq import Retry
from pytest_mock import MockerFixture
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.checkout.repository import CheckoutRepository
from polar.checkout.tasks import checkout_expired
from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models.checkout import CheckoutStatus
from polar.models.organization import Organization
from polar.models.product import Product
from polar.models.subscription import Subscription
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.models.webhook_event import WebhookEvent
from polar.webhook.repository import WebhookDeliveryRepository, WebhookEventRepository
from polar.webhook.service import webhook as webhook_service
from polar.webhook.tasks import _webhook_event_send, webhook_event_send
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_webhook_endpoint


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
@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (httpx.Response(200, json={"status": "ok"}), '{"status":"ok"}'),
        (httpx.Response(200), None),
        pytest.param(
            httpx.Response(200, text="a" * 8192),
            "a" * 2048,
            id="long response that is truncated",
        ),
    ],
)
async def test_webhook_delivery_success(
    response: httpx.Response,
    expected: str,
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    respx_mock.post("https://example.com/hook").mock(return_value=response)

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

    delivery_repository = WebhookDeliveryRepository.from_session(session)
    deliveries = await delivery_repository.get_all_by_event(event.id)
    assert len(deliveries) == 1
    delivery = deliveries[0]
    assert delivery.succeeded is True
    assert delivery.response == expected


@pytest.mark.asyncio
async def test_webhook_delivery_500(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    current_message: dramatiq.MessageProxy,
) -> None:
    respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(500, text="Internal Error")
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
    with pytest.raises(Retry):
        await _webhook_event_send(session=session, webhook_event_id=event.id)

    # does not raise on last attempt
    current_message.options["max_retries"] = settings.WEBHOOK_MAX_RETRIES
    current_message.options["retries"] = settings.WEBHOOK_MAX_RETRIES
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    delivery_repository = WebhookDeliveryRepository.from_session(session)
    deliveries = await delivery_repository.get_all_by_event(event.id)

    assert len(deliveries) == 2
    for delivery in deliveries:
        assert delivery.succeeded is False
        assert delivery.response == "Internal Error"


@pytest.mark.asyncio
async def test_webhook_delivery_http_error(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    current_message: dramatiq.MessageProxy,
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
    with pytest.raises(Retry):
        await _webhook_event_send(session=session, webhook_event_id=event.id)

    # does not raise on last attempt
    current_message.options["max_retries"] = settings.WEBHOOK_MAX_RETRIES
    current_message.options["retries"] = settings.WEBHOOK_MAX_RETRIES
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    delivery_repository = WebhookDeliveryRepository.from_session(session)
    deliveries = await delivery_repository.get_all_by_event(event.id)
    assert len(deliveries) == 2
    for delivery in deliveries:
        assert delivery.succeeded is False
        assert delivery.response == "ERROR"


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


@pytest.mark.asyncio
async def test_checkout_expired_webhook(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    product: Product,
) -> None:
    # Create webhook endpoint
    endpoint = await create_webhook_endpoint(
        save_fixture,
        organization=organization,
        events=[WebhookEventType.checkout_expired],
    )

    # Create expired checkout
    checkout = await create_checkout(
        save_fixture,
        products=[product],
        status=CheckoutStatus.open,
        expires_at=utc_now() - timedelta(days=1),
    )

    # Expire checkout
    checkout_repository = CheckoutRepository.from_session(session)
    expired_ids = await checkout_repository.expire_open_checkouts()
    await session.commit()

    assert len(expired_ids) == 1
    assert expired_ids[0] == checkout.id

    # Process the expiration task
    await checkout_expired(checkout.id)
    await session.commit()

    # Verify webhook event was created
    event_repository = WebhookEventRepository.from_session(session)
    statement = event_repository.get_base_statement().where(
        WebhookEvent.webhook_endpoint_id == endpoint.id,
        WebhookEvent.type == WebhookEventType.checkout_expired,
    )
    events = await event_repository.get_all(statement)
    assert len(events) == 1
    assert events[0].type == WebhookEventType.checkout_expired
