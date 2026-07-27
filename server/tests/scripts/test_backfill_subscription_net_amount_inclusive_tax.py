from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from polar.enums import TaxBehavior
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from scripts.backfill_subscription_net_amount_inclusive_tax import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_subscription,
)


async def _set_amounts(
    save_fixture: SaveFixture,
    subscription: Subscription,
    *,
    amount: int,
    net_amount: int,
) -> None:
    subscription.amount = amount
    subscription.net_amount = net_amount
    await save_fixture(subscription)


async def _get_net_amount(session: AsyncSession, subscription: Subscription) -> int:
    result = await session.execute(
        select(Subscription.net_amount).where(Subscription.id == subscription.id)
    )
    return result.scalar_one()


@pytest.mark.asyncio
class TestBackfillSubscriptionNetAmountInclusiveTax:
    async def test_backs_inclusive_tax_out_of_net_amount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            tax_behavior=TaxBehavior.inclusive,
        )
        await _set_amounts(save_fixture, subscription, amount=10000, net_amount=10000)

        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            tax_behavior=TaxBehavior.inclusive,
            subtotal_amount=10000,
            tax_amount=2000,
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_net_amount(session, subscription) == 8000

    async def test_uses_latest_qualifying_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            tax_behavior=TaxBehavior.inclusive,
        )
        await _set_amounts(save_fixture, subscription, amount=10000, net_amount=10000)

        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            tax_behavior=TaxBehavior.inclusive,
            subtotal_amount=10000,
            tax_amount=1000,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            tax_behavior=TaxBehavior.inclusive,
            subtotal_amount=10000,
            tax_amount=2000,
            created_at=datetime(2026, 2, 1, tzinfo=UTC),
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 1
        assert await _get_net_amount(session, subscription) == 8000

    async def test_skips_subscription_without_qualifying_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            tax_behavior=TaxBehavior.inclusive,
        )
        await _set_amounts(save_fixture, subscription, amount=10000, net_amount=10000)

        # $0 order has no usable tax treatment and must not overwrite net_amount.
        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            tax_behavior=TaxBehavior.inclusive,
            subtotal_amount=0,
            tax_amount=0,
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_net_amount(session, subscription) == 10000

    async def test_leaves_exclusive_subscription_untouched(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            tax_behavior=TaxBehavior.exclusive,
        )
        await _set_amounts(save_fixture, subscription, amount=10000, net_amount=10000)

        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            tax_behavior=TaxBehavior.exclusive,
            subtotal_amount=10000,
            tax_amount=2000,
        )

        updated = await run_backfill(batch_size=10, session=session)

        assert updated == 0
        assert await _get_net_amount(session, subscription) == 10000

    async def test_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            tax_behavior=TaxBehavior.inclusive,
        )
        await _set_amounts(save_fixture, subscription, amount=10000, net_amount=10000)

        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            tax_behavior=TaxBehavior.inclusive,
            subtotal_amount=10000,
            tax_amount=2000,
        )

        first_run = await run_backfill(batch_size=10, session=session)
        second_run = await run_backfill(batch_size=10, session=session)

        assert first_run == 1
        assert second_run == 0
        assert await _get_net_amount(session, subscription) == 8000
