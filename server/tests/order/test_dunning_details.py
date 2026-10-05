import itertools
from datetime import timedelta

import pytest
import pytest_asyncio
from freezegun import freeze_time

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import Customer, Order, Product
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import (
    DUNNING_COUNTING_TRIGGERS,
    PaymentStatus,
    PaymentTrigger,
)
from polar.models.subscription import SubscriptionStatus
from polar.order.service import order as order_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment,
    create_subscription,
)


@pytest_asyncio.fixture
async def dunning_order(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> Order:
    subscription = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=SubscriptionStatus.past_due,
        past_due_at=utc_now(),
    )
    return await create_order(
        save_fixture,
        customer=customer,
        product=product,
        subscription=subscription,
        status=OrderStatus.pending,
        billing_reason=OrderBillingReasonInternal.subscription_cycle,
        next_payment_attempt_at=utc_now() + settings.DUNNING_RETRY_INTERVALS[0],
    )


@pytest.mark.asyncio
class TestGetDunningRetriesRemaining:
    @pytest.mark.parametrize("failed_attempts", [0, 1, 2, 4, 5, 7])
    async def test_retry_budget(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        dunning_order: Order,
        failed_attempts: int,
    ) -> None:
        for _ in range(failed_attempts):
            await create_payment(
                save_fixture,
                dunning_order.organization,
                order=dunning_order,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.retry_dunning,
            )

        assert await order_service.get_dunning_retries_remaining(
            session, dunning_order
        ) == max(0, len(settings.DUNNING_RETRY_INTERVALS) + 1 - max(1, failed_attempts))

    @pytest.mark.parametrize("trigger", [*PaymentTrigger, None])
    @pytest.mark.parametrize("status", list(PaymentStatus))
    async def test_only_counted_failures_consume_retries(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        dunning_order: Order,
        trigger: PaymentTrigger | None,
        status: PaymentStatus,
    ) -> None:
        await create_payment(
            save_fixture,
            dunning_order.organization,
            order=dunning_order,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.subscription_cycle,
        )
        await create_payment(
            save_fixture,
            dunning_order.organization,
            order=dunning_order,
            status=status,
            trigger=trigger,
        )
        consumed_retry = (
            status == PaymentStatus.failed and trigger in DUNNING_COUNTING_TRIGGERS
        )

        assert (
            await order_service.get_dunning_retries_remaining(session, dunning_order)
            == len(settings.DUNNING_RETRY_INTERVALS) - consumed_retry
        )

    async def test_retries_without_payment_rows(
        self, session: AsyncSession, dunning_order: Order
    ) -> None:
        assert dunning_order.subscription is not None
        assert dunning_order.subscription.past_due_at is not None
        for index, offset in enumerate(
            itertools.accumulate(settings.DUNNING_RETRY_INTERVALS)
        ):
            dunning_order.next_payment_attempt_at = (
                dunning_order.subscription.past_due_at + offset
            )
            assert (
                await order_service.get_dunning_retries_remaining(
                    session, dunning_order
                )
                == len(settings.DUNNING_RETRY_INTERVALS) - index
            )

    async def test_due_retry_is_still_outstanding(
        self, session: AsyncSession, dunning_order: Order
    ) -> None:
        assert dunning_order.next_payment_attempt_at is not None
        with freeze_time(dunning_order.next_payment_attempt_at + timedelta(hours=1)):
            assert await order_service.get_dunning_retries_remaining(
                session, dunning_order
            ) == len(settings.DUNNING_RETRY_INTERVALS)

    async def test_non_recoverable_decline_scheduled_at_deadline(
        self, session: AsyncSession, save_fixture: SaveFixture, dunning_order: Order
    ) -> None:
        assert dunning_order.subscription is not None
        await create_payment(
            save_fixture,
            dunning_order.organization,
            order=dunning_order,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.subscription_cycle,
            decline_reason="stolen_card",
        )
        dunning_order.next_payment_attempt_at = (
            dunning_order.subscription.past_due_deadline
        )

        assert (
            await order_service.get_dunning_retries_remaining(session, dunning_order)
            == 1
        )

    async def test_meter_cycle_ignores_subscription_schedule(
        self, session: AsyncSession, save_fixture: SaveFixture, dunning_order: Order
    ) -> None:
        assert dunning_order.subscription is not None
        dunning_order.billing_reason = (
            OrderBillingReasonInternal.subscription_meter_cycle
        )
        dunning_order.next_payment_attempt_at = (
            dunning_order.subscription.past_due_deadline
        )
        await create_payment(
            save_fixture,
            dunning_order.organization,
            order=dunning_order,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.subscription_cycle,
        )

        assert await order_service.get_dunning_retries_remaining(
            session, dunning_order
        ) == len(settings.DUNNING_RETRY_INTERVALS)

    async def test_no_scheduled_retry(
        self, session: AsyncSession, dunning_order: Order
    ) -> None:
        dunning_order.next_payment_attempt_at = None
        assert (
            await order_service.get_dunning_retries_remaining(session, dunning_order)
            == 0
        )

    @pytest.mark.parametrize("status", [OrderStatus.paid, OrderStatus.void])
    async def test_terminal_order(
        self, session: AsyncSession, dunning_order: Order, status: OrderStatus
    ) -> None:
        dunning_order.status = status
        assert (
            await order_service.get_dunning_retries_remaining(session, dunning_order)
            == 0
        )

    async def test_canceled_subscription(
        self, session: AsyncSession, dunning_order: Order
    ) -> None:
        assert dunning_order.subscription is not None
        dunning_order.subscription.status = SubscriptionStatus.canceled
        assert (
            await order_service.get_dunning_retries_remaining(session, dunning_order)
            == 0
        )

    async def test_no_subscription(
        self, session: AsyncSession, dunning_order: Order
    ) -> None:
        dunning_order.subscription = None
        assert (
            await order_service.get_dunning_retries_remaining(session, dunning_order)
            == 0
        )
