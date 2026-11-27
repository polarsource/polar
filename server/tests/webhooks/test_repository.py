from datetime import datetime, timedelta

import pytest

from polar.kit.utils import utc_now
from polar.models import WebhookDelivery, WebhookEndpoint, WebhookEvent
from polar.postgres import AsyncSession
from polar.webhook.repository import WebhookDeliveryRepository
from tests.fixtures.database import SaveFixture


async def create_delivery(
    save_fixture: SaveFixture,
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
    *,
    created_at: datetime,
    response: str | None = "response body",
) -> WebhookDelivery:
    delivery = WebhookDelivery(
        webhook_endpoint=endpoint,
        webhook_event=event,
        organization_id=endpoint.organization_id,
        succeeded=True,
        http_code=200,
        response=response,
        created_at=created_at,
    )
    await save_fixture(delivery)
    return delivery


@pytest.mark.anyio
class TestGetExpiredIds:
    async def test_returns_oldest_expired_first(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        now = utc_now()
        older = await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=92),
            response=None,
        )
        old = await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=91),
        )
        await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=89),
        )

        repository = WebhookDeliveryRepository.from_session(session)
        ids = await repository.get_expired_ids(
            older_than=now - timedelta(days=90), limit=10
        )

        assert list(ids) == [older.id, old.id]

    async def test_respects_limit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        now = utc_now()
        oldest = await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=92),
        )
        await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=91),
        )

        repository = WebhookDeliveryRepository.from_session(session)
        ids = await repository.get_expired_ids(
            older_than=now - timedelta(days=90), limit=1
        )

        assert list(ids) == [oldest.id]


@pytest.mark.anyio
class TestCountExpired:
    async def test_counts_only_old_deliveries(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        now = utc_now()
        for created_at, response in (
            (now - timedelta(days=91), "old"),
            (now - timedelta(days=91), None),
            (now - timedelta(days=89), "recent"),
        ):
            await create_delivery(
                save_fixture,
                webhook_endpoint_organization,
                webhook_event_organization,
                created_at=created_at,
                response=response,
            )

        repository = WebhookDeliveryRepository.from_session(session)
        count = await repository.count_expired(older_than=now - timedelta(days=90))

        assert count == 2


@pytest.mark.anyio
class TestDeleteByIds:
    async def test_deletes_only_given_rows(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        now = utc_now()
        deleted = await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=91),
        )
        kept = await create_delivery(
            save_fixture,
            webhook_endpoint_organization,
            webhook_event_organization,
            created_at=now - timedelta(days=91),
        )

        repository = WebhookDeliveryRepository.from_session(session)
        count = await repository.delete_by_ids([deleted.id])

        assert count == 1
        remaining = await repository.get_all_by_event(webhook_event_organization.id)
        assert [delivery.id for delivery in remaining] == [kept.id]
