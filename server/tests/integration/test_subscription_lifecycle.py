"""
Integration test: Subscription lifecycle — purchase, renew, cancel.
"""

from datetime import UTC, datetime

import freezegun
import pytest
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.checkout.service import checkout as checkout_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Order, Subscription
from polar.models.benefit import BenefitType
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import NoPendingBillingEntries
from polar.order.service import order as order_service
from polar.subscription.scheduler import SubscriptionJobStore
from polar.subscription.service import (
    InactiveSubscription,
)
from polar.subscription.service import (
    subscription as subscription_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_checkout,
    create_customer,
    create_organization,
    create_payment_method,
    create_product,
    set_product_benefits,
)

from .conftest import drain_jobs, get_benefit_grants, get_cycle_billing_entries


class _TestableScheduler(SubscriptionJobStore):
    def __init__(self) -> None:
        pass


_scheduler = _TestableScheduler()


async def get_due_subscriptions(
    session: AsyncSession,
) -> list[Subscription]:
    """Use the real scheduler's base query to find due subscriptions."""
    statement = _scheduler._get_base_statement().where(
        Subscription.current_period_end <= utc_now(),
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


@pytest.mark.asyncio
async def test_subscription_lifecycle(
    save_fixture: SaveFixture,
    session: AsyncSession,
) -> None:
    # Story:
    #     An organization sells a $10/month product. A customer subscribes
    #     on January 1st. Time advances month by month — the scheduler
    #     detects the subscription is due, cycles it, and an order is created.
    #     After two renewals the customer cancels, and the next cycle
    #     finalises the cancellation.

    organization = await create_organization(save_fixture)

    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(1000, "usd")],
        name="Monthly Plan",
        is_tax_applicable=False,
    )

    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.custom,
        description="Member-only content",
    )
    product = await set_product_benefits(
        save_fixture, product=product, benefits=[benefit]
    )

    customer = await create_customer(
        save_fixture,
        organization=organization,
        email="subscriber@example.com",
        name="Alex Subscriber",
        billing_address=Address(
            country=CountryAlpha2("US"),
            line1="456 Oak Ave",
            city="San Francisco",
            state="CA",
            postal_code="94102",
        ),
    )

    payment_method = await create_payment_method(save_fixture, customer)
    customer.default_payment_method = payment_method
    await save_fixture(customer)

    with freezegun.freeze_time("2025-01-01 12:00:00", tz_offset=0):
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        checkout = await checkout_service.handle_success(session, checkout)
        assert checkout.status == CheckoutStatus.succeeded

        subscription = (
            await session.execute(
                select(Subscription).where(Subscription.checkout_id == checkout.id)
            )
        ).scalar_one()

        jan1 = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
        feb1 = datetime(2025, 2, 1, 12, 0, 0, tzinfo=UTC)

        assert subscription.status == SubscriptionStatus.active
        assert subscription.current_period_start == jan1
        assert subscription.current_period_end == feb1

        order_repository = OrderRepository.from_session(session)
        initial_order = await order_repository.get_earliest_by_checkout_id(
            checkout.id, options=(joinedload(Order.items),)
        )
        assert initial_order is not None
        assert initial_order.status == OrderStatus.paid
        assert initial_order.subtotal_amount == 1000
        assert len(initial_order.items) == 1
        assert initial_order.items[0].label == "Monthly Plan"

        await drain_jobs(session)

        grants = await get_benefit_grants(session, customer.id, benefit.id)
        assert len(grants) == 1
        assert grants[0].is_granted is True

        assert await get_due_subscriptions(session) == []

    with freezegun.freeze_time("2025-02-01 12:00:00", tz_offset=0):
        feb1 = datetime(2025, 2, 1, 12, 0, 0, tzinfo=UTC)
        mar1 = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC)

        due = await get_due_subscriptions(session)
        assert len(due) == 1
        assert due[0].id == subscription.id

        subscription = await subscription_service.cycle(session, subscription)
        assert subscription.current_period_start == feb1
        assert subscription.current_period_end == mar1

        entries = await get_cycle_billing_entries(session, subscription.id)
        assert len(entries) == 1
        assert entries[0].start_timestamp == feb1
        assert entries[0].end_timestamp == mar1
        assert entries[0].amount == 1000

        renewal_1 = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )
        assert renewal_1.subtotal_amount == 1000
        assert renewal_1.billing_reason == OrderBillingReasonInternal.subscription_cycle

        assert await get_due_subscriptions(session) == []

    with freezegun.freeze_time("2025-03-01 12:00:00", tz_offset=0):
        mar1 = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC)
        apr1 = datetime(2025, 4, 1, 12, 0, 0, tzinfo=UTC)

        due = await get_due_subscriptions(session)
        assert len(due) == 1

        subscription = await subscription_service.cycle(session, subscription)
        assert subscription.current_period_start == mar1
        assert subscription.current_period_end == apr1

        entries = await get_cycle_billing_entries(session, subscription.id)
        assert len(entries) == 2
        assert entries[1].start_timestamp == mar1
        assert entries[1].end_timestamp == apr1

        renewal_2 = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )
        assert renewal_2.subtotal_amount == 1000

    with freezegun.freeze_time("2025-03-15 12:00:00", tz_offset=0):
        apr1 = datetime(2025, 4, 1, 12, 0, 0, tzinfo=UTC)

        subscription = await subscription_service.cancel(session, subscription)

        assert subscription.status == SubscriptionStatus.active
        assert subscription.cancel_at_period_end is True
        assert subscription.ends_at == apr1

        assert await get_due_subscriptions(session) == []

        grants = await get_benefit_grants(session, customer.id, benefit.id)
        assert len(grants) == 1
        assert grants[0].is_granted is True

    with freezegun.freeze_time("2025-04-01 12:00:00", tz_offset=0):
        apr1 = datetime(2025, 4, 1, 12, 0, 0, tzinfo=UTC)

        due = await get_due_subscriptions(session)
        assert len(due) == 1

        subscription = await subscription_service.cycle(session, subscription)

        assert subscription.status == SubscriptionStatus.canceled
        assert subscription.ended_at == apr1

        await drain_jobs(session)

        grants = await get_benefit_grants(session, customer.id, benefit.id)
        assert len(grants) == 1
        assert grants[0].is_revoked is True

        with pytest.raises(NoPendingBillingEntries):
            await order_service.create_subscription_order(
                session,
                subscription,
                OrderBillingReasonInternal.subscription_cancel,
            )

        entries = await get_cycle_billing_entries(session, subscription.id)
        assert len(entries) == 2

    all_orders = (
        (
            await session.execute(
                select(Order)
                .where(Order.customer_id == customer.id)
                .order_by(Order.created_at)
            )
        )
        .scalars()
        .all()
    )

    assert len(all_orders) == 3
    assert (
        all_orders[0].billing_reason == OrderBillingReasonInternal.subscription_create
    )
    assert all_orders[1].billing_reason == OrderBillingReasonInternal.subscription_cycle
    assert all_orders[2].billing_reason == OrderBillingReasonInternal.subscription_cycle

    with pytest.raises(InactiveSubscription):
        await subscription_service.cycle(session, subscription)

    assert await get_due_subscriptions(session) == []
