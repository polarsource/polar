from datetime import timedelta

import pytest

from polar.enums import SubscriptionProrationBehavior
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, Discount, DiscountRedemption, Product
from polar.subscription.update import generate_subscription_update
from scripts.backfill_discount_redemption_subscription_update import get_links, link
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription


@pytest.mark.asyncio
class TestBackfillDiscountRedemptionSubscriptionUpdate:
    async def test_links_latest_redemption_of_pending_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        product_second: Product,
        customer: Customer,
        discount_percentage_50: Discount,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_update, _ = generate_subscription_update(
            subscription,
            SubscriptionProrationBehavior.next_period,
            product=product_second,
            discount=discount_percentage_50,
        )
        await save_fixture(subscription_update)

        older = DiscountRedemption(
            discount=discount_percentage_50,
            subscription=subscription,
            created_at=utc_now() - timedelta(days=30),
        )
        latest = DiscountRedemption(
            discount=discount_percentage_50, subscription=subscription
        )
        await save_fixture(older)
        await save_fixture(latest)

        links = await get_links(session)
        assert links == [(latest.id, subscription_update.id)]

        await link(session, links)
        await session.refresh(latest)
        await session.refresh(older)
        assert latest.subscription_update_id == subscription_update.id
        assert older.subscription_update_id is None
        assert await get_links(session) == []

    async def test_ignores_applied_update(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        product_second: Product,
        customer: Customer,
        discount_percentage_50: Discount,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_update, _ = generate_subscription_update(
            subscription,
            SubscriptionProrationBehavior.next_period,
            product=product_second,
            discount=discount_percentage_50,
        )
        subscription_update.applied_at = utc_now()
        await save_fixture(subscription_update)
        await save_fixture(
            DiscountRedemption(
                discount=discount_percentage_50, subscription=subscription
            )
        )

        assert await get_links(session) == []
