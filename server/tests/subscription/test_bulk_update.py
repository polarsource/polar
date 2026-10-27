from collections.abc import Awaitable, Callable

import pytest
from pytest_mock import MockerFixture

from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Organization,
    Product,
    SubscriptionBulkUpdate,
)
from polar.postgres import AsyncSession
from polar.subscription.bulk_update import (
    subscription_bulk_update as subscription_bulk_update_service,
)
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


type StartBulkUpdate = Callable[[str], Awaitable[SubscriptionBulkUpdate]]


@pytest.fixture
def start_bulk_update(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    old_pro: Product,
) -> StartBulkUpdate:
    """Publish a new Pro priced in `currency` and start moving subscriptions to it."""
    mocker.patch("polar.subscription.bulk_update.enqueue_job")
    mocker.patch("polar.subscription.service.enqueue_job")

    async def start(currency: str) -> SubscriptionBulkUpdate:
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
        return await subscription_bulk_update_service.start(
            session,
            organization,
            source_external_id="pro",
            target_product=new_pro,
        )

    return start


@pytest.mark.anyio
class TestRunBatch:
    async def test_batches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        start_bulk_update: StartBulkUpdate,
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
        bulk_update = await start_bulk_update("usd")

        results = [
            await subscription_bulk_update_service.run_batch(
                session, bulk_update.id, batch_size=1
            )
            for _ in range(3)
        ]

        assert results == [True, True, False]
        assert bulk_update.subscriptions_count == 2
        assert bulk_update.skipped_count == 0
        assert bulk_update.completed_at is not None
        for subscription in subscriptions:
            await session.refresh(subscription, ["product_id", "pending_update"])
            assert subscription.product_id == old_pro.id
            assert subscription.pending_update is not None
            assert (
                subscription.pending_update.product_id == bulk_update.target_product_id
            )
        assert (
            await subscription_bulk_update_service.run_batch(session, bulk_update.id)
            is False
        )

    async def test_skips_subscription_that_cannot_move(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        start_bulk_update: StartBulkUpdate,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        bulk_update = await start_bulk_update("eur")

        has_more = await subscription_bulk_update_service.run_batch(
            session, bulk_update.id
        )

        assert has_more is False
        assert bulk_update.subscriptions_count == 0
        assert bulk_update.skipped_count == 1
        assert bulk_update.last_subscription_id == subscription.id

    async def test_completes_when_target_is_deleted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        start_bulk_update: StartBulkUpdate,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        bulk_update = await start_bulk_update("usd")
        bulk_update.target_product.deleted_at = utc_now()
        await save_fixture(bulk_update.target_product)

        has_more = await subscription_bulk_update_service.run_batch(
            session, bulk_update.id
        )

        assert has_more is False
        assert bulk_update.completed_at is not None
        assert bulk_update.subscriptions_count == 0
        await session.refresh(subscription, ["pending_update"])
        assert subscription.pending_update is None

    async def test_leaves_canceling_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        start_bulk_update: StartBulkUpdate,
        old_pro: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=old_pro, customer=customer, cancel_at_period_end=True
        )
        bulk_update = await start_bulk_update("usd")

        await subscription_bulk_update_service.run_batch(session, bulk_update.id)

        assert bulk_update.subscriptions_count == 0
        assert bulk_update.skipped_count == 0
        await session.refresh(subscription, ["pending_update"])
        assert subscription.pending_update is None

    async def test_leaves_subscriptions_with_a_pending_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        start_bulk_update: StartBulkUpdate,
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
        bulk_update = await start_bulk_update("usd")

        await subscription_bulk_update_service.run_batch(session, bulk_update.id)

        assert bulk_update.subscriptions_count == 0
        await session.refresh(loaded, ["pending_update"])
        assert loaded.pending_update is not None
        assert loaded.pending_update.product_id == other.id
