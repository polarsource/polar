import pytest_asyncio

from polar.models.organization import Organization
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import WebhookEndpoint
from polar.models.webhook_event import WebhookEvent
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def webhook_endpoint(
    save_fixture: SaveFixture,
    organization: Organization,
) -> WebhookEndpoint:
    endpoint = WebhookEndpoint(
        url="https://example.com/foo",
        organization_id=organization.id,
        secret="foobar",
    )
    await save_fixture(endpoint)
    return endpoint


@pytest_asyncio.fixture
async def webhook_event(
    save_fixture: SaveFixture,
    webhook_endpoint: WebhookEndpoint,
) -> WebhookEvent:
    event = WebhookEvent(
        webhook_endpoint_id=webhook_endpoint.id,
        last_http_code=200,
        succeeded=True,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)
    return event


@pytest_asyncio.fixture
async def webhook_delivery(
    save_fixture: SaveFixture,
    webhook_endpoint: WebhookEndpoint,
    webhook_event: WebhookEvent,
) -> WebhookDelivery:
    delivery = WebhookDelivery(
        webhook_endpoint_id=webhook_endpoint.id,
        webhook_event_id=webhook_event.id,
        http_code=200,
        succeeded=True,
    )
    await save_fixture(delivery)
    return delivery
