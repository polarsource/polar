from datetime import timedelta

import pytest
from sqlalchemy import select

from polar.enums import TaxBehavior
from polar.kit.utils import utc_now
from polar.models import Customer, Order, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription


def _prices(*amounts: int) -> list[SubscriptionProductPrice]:
    return [SubscriptionProductPrice(amount=amount) for amount in amounts]


def _charge(
    tax_behavior: TaxBehavior | None, net_amount: int, tax_amount: int | None
) -> Order:
    return Order(
        tax_behavior=tax_behavior, net_amount=net_amount, tax_amount=tax_amount
    )


class TestUpdateNetAmountFrom:
    def test_exclusive_charge_sets_net_to_amount(self) -> None:
        subscription = Subscription(amount=1000, net_amount=800)
        subscription.update_net_amount_from(_charge(TaxBehavior.exclusive, 1000, 200))
        assert subscription.net_amount == 1000

    @pytest.mark.parametrize(
        ("net_amount", "tax_amount", "amount", "expected_net"),
        [
            (800, 200, 1000, 800),
            (826, 174, 1000, 826),
            # The fraction spans recurring + metered + proration, but is uniform,
            # so the recurring net is still derived correctly.
            (4132, 868, 1000, 826),
        ],
    )
    def test_inclusive_charge_backs_out_tax(
        self, net_amount: int, tax_amount: int, amount: int, expected_net: int
    ) -> None:
        subscription = Subscription(amount=amount, net_amount=amount)
        subscription.update_net_amount_from(
            _charge(TaxBehavior.inclusive, net_amount, tax_amount)
        )
        assert subscription.net_amount == expected_net

    @pytest.mark.parametrize(
        "charge",
        [
            _charge(None, 1000, None),  # failed tax calculation
            _charge(TaxBehavior.inclusive, 0, 0),  # $0 charge
            _charge(TaxBehavior.inclusive, -500, -100),  # credit
        ],
    )
    def test_unusable_charge_leaves_net_unchanged(self, charge: Order) -> None:
        subscription = Subscription(amount=1000, net_amount=826)
        subscription.update_net_amount_from(charge)
        assert subscription.net_amount == 826


class TestUpdateAmountAndCurrency:
    def test_cold_start_falls_back_to_gross(self) -> None:
        subscription = Subscription(currency="usd")
        subscription.update_amount_and_currency(_prices(1000), None)
        assert subscription.amount == 1000
        assert subscription.net_amount == 1000

    def test_preserves_inclusive_ratio_across_amount_change(self) -> None:
        subscription = Subscription(currency="usd", amount=1000, net_amount=800)
        subscription.update_amount_and_currency(_prices(1500, 500), None)
        assert subscription.amount == 2000
        assert subscription.net_amount == 1600

    def test_exclusive_stays_equal(self) -> None:
        subscription = Subscription(currency="usd", amount=1000, net_amount=1000)
        subscription.update_amount_and_currency(_prices(3000), None)
        assert subscription.amount == 3000
        assert subscription.net_amount == 3000


async def _matches_expression(
    session: AsyncSession, subscription: Subscription
) -> bool:
    result = await session.execute(
        select(Subscription.id).where(
            Subscription.id == subscription.id,
            Subscription.requires_payment_method.is_(True),
        )
    )
    return result.scalar_one_or_none() is not None


@pytest.mark.asyncio
class TestRequiresPaymentMethod:
    @pytest.mark.parametrize(
        ("status", "cancel_at_period_end", "expected"),
        [
            (SubscriptionStatus.active, False, True),
            (SubscriptionStatus.trialing, False, True),
            (SubscriptionStatus.past_due, False, True),
            (SubscriptionStatus.active, True, False),
            (SubscriptionStatus.trialing, True, False),
            # Its unpaid order is still being retried against the card.
            (SubscriptionStatus.past_due, True, True),
            (SubscriptionStatus.incomplete, False, False),
            (SubscriptionStatus.canceled, False, False),
            (SubscriptionStatus.unpaid, False, False),
            (SubscriptionStatus.paused, False, False),
        ],
    )
    async def test_status_and_scheduled_cancellation(
        self,
        status: SubscriptionStatus,
        cancel_at_period_end: bool,
        expected: bool,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=status,
            cancel_at_period_end=cancel_at_period_end,
        )

        assert subscription.requires_payment_method is expected
        assert await _matches_expression(session, subscription) is expected

    @pytest.mark.parametrize("cancel_at_period_end", [True, False])
    async def test_metered_subscription_always_requires_one(
        self,
        cancel_at_period_end: bool,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product_recurring_metered: Product,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=cancel_at_period_end,
        )

        assert subscription.requires_payment_method is True
        assert await _matches_expression(session, subscription) is True

    @pytest.mark.parametrize("scheduled_resume", [True, False])
    async def test_paused_subscription_follows_the_scheduled_resume(
        self,
        scheduled_resume: bool,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )
        subscription.paused_at = utc_now()
        subscription.resumes_at = (
            utc_now() + timedelta(days=30) if scheduled_resume else None
        )
        await save_fixture(subscription)

        assert subscription.requires_payment_method is scheduled_resume
        assert await _matches_expression(session, subscription) is scheduled_resume

    async def test_metered_subscription_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product_recurring_metered: Product,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )

        assert subscription.requires_payment_method is False
        assert await _matches_expression(session, subscription) is False
