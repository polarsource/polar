from collections.abc import Awaitable, Callable

import pytest
from pytest_mock import MockerFixture

from polar.catalog.repository import CatalogProductRepository, CatalogRepository
from polar.catalog.service import catalog as catalog_service
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import CatalogMigration, Customer, Organization, Product
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
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

    async def test_replaces_pending_move_to_older_version(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        publish_pro: PublishPro,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        first = await publish_pro("usd")
        await catalog_service.migrate_subscriptions(session, first.id)
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        assert live is not None
        second_pro = await CatalogProductRepository.from_session(session).get_product(
            live.id, "pro"
        )
        assert second_pro is not None
        second_pro.is_current = False
        await save_fixture(second_pro)
        third_pro = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Pro",
            external_id="pro",
            prices=[(3000, "usd")],
        )
        catalog = await catalog_service.publish(
            session, organization, live, {"pro": third_pro}
        )
        second = await catalog_service.start_migration(
            session,
            organization,
            catalog,
            external_id="pro-to-30",
            source_external_id="pro",
            target_external_id="pro",
        )

        await catalog_service.migrate_subscriptions(session, second.id)

        assert second.subscriptions_count == 1
        repository = SubscriptionRepository.from_session(session)
        updated = await repository.get_by_id(
            subscription.id, options=repository.get_eager_options()
        )
        assert updated is not None
        assert updated.pending_update is not None
        assert updated.pending_update.product_id == third_pro.id

    async def test_completes_when_target_is_deleted(
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
        migration = await publish_pro("usd")
        target = await CatalogProductRepository.from_session(session).get_product(
            migration.catalog_id, "pro"
        )
        assert target is not None
        target.deleted_at = utc_now()
        await save_fixture(target)

        has_more = await catalog_service.migrate_subscriptions(session, migration.id)

        assert has_more is False
        assert migration.completed_at is not None
        assert migration.subscriptions_count == 0
        repository = SubscriptionRepository.from_session(session)
        updated = await repository.get_by_id(
            subscription.id, options=repository.get_eager_options()
        )
        assert updated is not None
        assert updated.pending_update is None

    async def test_leaves_canceling_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        publish_pro: PublishPro,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer, cancel_at_period_end=True
        )
        migration = await publish_pro("usd")

        await catalog_service.migrate_subscriptions(session, migration.id)

        assert migration.subscriptions_count == 0
        assert migration.skipped_count == 0
        repository = SubscriptionRepository.from_session(session)
        updated = await repository.get_by_id(
            subscription.id, options=repository.get_eager_options()
        )
        assert updated is not None
        assert updated.pending_update is None

    async def test_leaves_pending_change_to_another_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        publish_pro: PublishPro,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        other = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Other",
            external_id="other",
        )
        repository = SubscriptionRepository.from_session(session)
        loaded = await repository.get_by_id(
            subscription.id, options=repository.get_eager_options()
        )
        assert loaded is not None
        async with SubscriptionUpdateContext(
            session, loaded, subscription_service, notify_customer=False
        ) as ctx:
            await subscription_service.update_product(
                session,
                ctx,
                loaded,
                product_id=other.id,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )
        migration = await publish_pro("usd")

        await catalog_service.migrate_subscriptions(session, migration.id)

        assert migration.subscriptions_count == 0
        updated = await repository.get_by_id(
            subscription.id, options=repository.get_eager_options()
        )
        assert updated is not None
        assert updated.pending_update is not None
        assert updated.pending_update.product_id == other.id
