import pytest
from pytest_mock import MockerFixture

from polar.catalog_migration.service import (
    catalog_migration as catalog_migration_service,
)
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.models import CatalogMigration, Customer, Organization, Product
from polar.models.catalog_migration import CatalogMigrationStatus
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription, create_product


@pytest.fixture(autouse=True)
def enqueue_job_mock(mocker: MockerFixture) -> None:
    mocker.patch("polar.subscription.service.enqueue_job")


@pytest.fixture
async def catalog_migration(
    save_fixture: SaveFixture,
    organization: Organization,
    old_pro: Product,
    new_pro: Product,
) -> CatalogMigration:
    catalog_migration = CatalogMigration(
        organization=organization,
        source_product_ids=[old_pro.id],
        target_product=new_pro,
    )
    await save_fixture(catalog_migration)
    return catalog_migration


@pytest.mark.anyio
class TestRunBatch:
    async def test_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        catalog_migration: CatalogMigration,
        old_pro: Product,
        new_pro: Product,
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

        results = [
            await catalog_migration_service.run_batch(
                session, catalog_migration.id, batch_size=1
            )
            for _ in range(3)
        ]

        assert results == [True, True, False]
        assert catalog_migration.moved_count == 2
        assert catalog_migration.skipped_count == 0
        assert catalog_migration.status == CatalogMigrationStatus.completed
        assert catalog_migration.completed_at is not None
        for subscription in subscriptions:
            await session.refresh(subscription, ["product_id", "pending_update"])
            assert subscription.product_id == old_pro.id
            assert subscription.pending_update is not None
            assert subscription.pending_update.product_id == new_pro.id
            assert (
                subscription.pending_update.proration_behavior
                == SubscriptionProrationBehavior.next_period
            )
        assert (
            await catalog_migration_service.run_batch(session, catalog_migration.id)
            is False
        )

    async def test_leaves_versions_that_are_not_a_source(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        catalog_migration: CatalogMigration,
        customer: Customer,
    ) -> None:
        older_pro = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            is_current=False,
        )
        subscription = await create_active_subscription(
            save_fixture, product=older_pro, customer=customer
        )

        await catalog_migration_service.run_batch(session, catalog_migration.id)

        assert catalog_migration.moved_count == 0
        assert catalog_migration.status == CatalogMigrationStatus.completed
        await session.refresh(subscription, ["pending_update"])
        assert subscription.pending_update is None

    async def test_skips_subscription_that_cannot_move(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        euro_pro = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            prices=[(2500, "eur")],
        )
        catalog_migration = CatalogMigration(
            organization=organization,
            source_product_ids=[old_pro.id],
            target_product=euro_pro,
        )
        await save_fixture(catalog_migration)

        has_more = await catalog_migration_service.run_batch(
            session, catalog_migration.id
        )

        assert has_more is False
        assert catalog_migration.moved_count == 0
        assert catalog_migration.skipped_count == 1
        assert catalog_migration.last_processed_id == subscription.id

    async def test_ends_when_target_is_no_longer_current(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        catalog_migration: CatalogMigration,
        old_pro: Product,
        new_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        new_pro.is_current = False
        await save_fixture(new_pro)

        has_more = await catalog_migration_service.run_batch(
            session, catalog_migration.id
        )

        assert has_more is False
        assert catalog_migration.status == CatalogMigrationStatus.completed
        assert catalog_migration.completed_at is not None
        assert catalog_migration.moved_count == 0
        assert catalog_migration.skipped_count == 0
        await session.refresh(subscription, ["pending_update"])
        assert subscription.pending_update is None

    async def test_leaves_canceling_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        catalog_migration: CatalogMigration,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer, cancel_at_period_end=True
        )

        await catalog_migration_service.run_batch(session, catalog_migration.id)

        assert catalog_migration.moved_count == 0
        assert catalog_migration.skipped_count == 0
        await session.refresh(subscription, ["pending_update"])
        assert subscription.pending_update is None

    async def test_leaves_subscriptions_with_a_pending_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        catalog_migration: CatalogMigration,
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

        await catalog_migration_service.run_batch(session, catalog_migration.id)

        assert catalog_migration.moved_count == 0
        await session.refresh(loaded, ["pending_update"])
        assert loaded.pending_update is not None
        assert loaded.pending_update.product_id == other.id
