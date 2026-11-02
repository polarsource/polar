import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, WebhookDelivery, WebhookEndpoint, WebhookEvent
from polar.models.webhook_endpoint import WebhookEventType
from polar.version import CURRENT_API_VERSION
from scripts.backfill_webhook_delivery_organization_id import backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_webhook_endpoint


async def _create_delivery(
    save_fixture: SaveFixture, endpoint: WebhookEndpoint
) -> WebhookDelivery:
    event = WebhookEvent(
        webhook_endpoint=endpoint,
        type=WebhookEventType.order_created,
        api_version=CURRENT_API_VERSION,
        payload="{}",
    )
    await save_fixture(event)
    delivery = WebhookDelivery(
        webhook_endpoint=endpoint, webhook_event=event, succeeded=True
    )
    await save_fixture(delivery)
    return delivery


@pytest.mark.anyio
class TestBackfill:
    async def test_sets_organization_from_endpoint(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        endpoint = await create_webhook_endpoint(
            save_fixture, organization=organization
        )
        endpoint_second = await create_webhook_endpoint(
            save_fixture, organization=organization_second
        )
        deliveries = [
            await _create_delivery(save_fixture, endpoint),
            await _create_delivery(save_fixture, endpoint),
            await _create_delivery(save_fixture, endpoint_second),
        ]

        updated = await backfill(session, pages_per_batch=1)

        assert updated == 3
        result = await session.execute(
            select(WebhookDelivery.id, WebhookDelivery.organization_id)
        )
        assert dict(result.tuples().all()) == {
            deliveries[0].id: organization.id,
            deliveries[1].id: organization.id,
            deliveries[2].id: organization_second.id,
        }

    async def test_skips_rows_already_set(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        endpoint = await create_webhook_endpoint(
            save_fixture, organization=organization
        )
        delivery = await _create_delivery(save_fixture, endpoint)
        delivery.organization_id = organization.id
        await save_fixture(delivery)

        assert await backfill(session) == 0
