import pytest_asyncio

from polar.models import (
    Organization,
    User,
    WebhookDelivery,
    WebhookEndpoint,
    WebhookEvent,
)
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def webhook_endpoint_user(
    save_fixture: SaveFixture, user: User
) -> WebhookEndpoint:
    endpoint = WebhookEndpoint(
        url="https://example.com/foo",
        format=WebhookFormat.raw,
        user_id=user.id,
        secret="foobar",
    )
    await save_fixture(endpoint)
    return endpoint


@pytest_asyncio.fixture
async def webhook_event_user(
    save_fixture: SaveFixture,
    webhook_endpoint_user: WebhookEndpoint,
) -> WebhookEvent:
    event = WebhookEvent(
        webhook_endpoint_id=webhook_endpoint_user.id,
        last_http_code=200,
        succeeded=True,
        type=WebhookEventType.customer_created,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)
    return event


@pytest_asyncio.fixture
async def webhook_endpoint_organization(
    save_fixture: SaveFixture, organization: Organization
) -> WebhookEndpoint:
    endpoint = WebhookEndpoint(
        url="https://example.com/foo",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="foobar",
    )
    await save_fixture(endpoint)
    return endpoint


@pytest_asyncio.fixture
async def webhook_event_organization(
    save_fixture: SaveFixture,
    webhook_endpoint_organization: WebhookEndpoint,
) -> WebhookEvent:
    event = WebhookEvent(
        webhook_endpoint_id=webhook_endpoint_organization.id,
        last_http_code=200,
        succeeded=True,
        type=WebhookEventType.customer_created,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)
    return event


@pytest_asyncio.fixture
async def webhook_delivery(
    save_fixture: SaveFixture,
    webhook_endpoint_organization: WebhookEndpoint,
    webhook_event_organization: WebhookEvent,
) -> WebhookDelivery:
    delivery = WebhookDelivery(
        webhook_endpoint_id=webhook_endpoint_organization.id,
        webhook_event_id=webhook_event_organization.id,
        http_code=200,
        succeeded=True,
    )
    await save_fixture(delivery)
    return delivery
