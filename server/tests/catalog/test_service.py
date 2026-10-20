from collections.abc import Awaitable, Callable

import pytest
from pytest_mock import MockerFixture

from polar.catalog.service import catalog as catalog_service
from polar.enums import SubscriptionRecurringInterval
from polar.models import CatalogMigration, Customer, Organization, Product
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription, create_product


@pytest.fixture
async def old_pro(save_fixture: SaveFixture, organization: Organization) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="Pro",
        external_id="pro",
        prices=[(2000, "usd")],
    )


type PublishPro = Callable[[str], Awaitable[CatalogMigration]]


@pytest.fixture
def publish_pro(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    old_pro: Product,
) -> PublishPro:
    """Publish a new Pro in `currency` and start migrating its subscriptions."""
    mocker.patch("polar.catalog.service.enqueue_job")
    mocker.patch("polar.subscription.service.enqueue_job")

    async def publish(currency: str) -> CatalogMigration:
        live = await catalog_service.get_or_create_live(session, organization)
        old_pro.is_current = False
        await save_fixture(old_pro)
        new_pro = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Pro",
            external_id="pro",
            prices=[(2500, currency)],
        )
        catalog = await catalog_service.publish(
            session, organization, live, {"pro": new_pro}
        )
        return await catalog_service.start_migration(
            session,
            organization,
            catalog,
            external_id="pro-to-25",
            source_external_id="pro",
            target_external_id="pro",
        )

    return publish


@pytest.mark.anyio
class TestMigrateSubscriptions:
    async def test_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        publish_pro: PublishPro,
        old_pro: Product,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        subscriptions = [
            await create_active_subscription(
                save_fixture, product=old_pro, customer=customer
            ),
            await create_active_subscription(
                save_fixture, product=old_pro, customer=customer_second
            ),
        ]
        migration = await publish_pro("usd")

        results = [
            await catalog_service.migrate_subscriptions(
                session, migration.id, batch_size=1
            )
            for _ in range(3)
        ]

        assert results == [True, True, False]
        assert migration.subscriptions_count == 2
        assert migration.skipped_count == 0
        assert migration.completed_at is not None
        repository = SubscriptionRepository.from_session(session)
        for subscription in subscriptions:
            updated = await repository.get_by_id(
                subscription.id, options=repository.get_eager_options()
            )
            assert updated is not None
            assert updated.product_id == old_pro.id
            assert updated.pending_update is not None
            assert updated.pending_update.product_id != old_pro.id
        assert (
            await catalog_service.migrate_subscriptions(session, migration.id) is False
        )

    async def test_skips_subscription_that_cannot_move(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        publish_pro: PublishPro,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        migration = await publish_pro("eur")

        has_more = await catalog_service.migrate_subscriptions(session, migration.id)

        assert has_more is False
        assert migration.subscriptions_count == 0
        assert migration.skipped_count == 1
        assert migration.last_subscription_id == subscription.id
