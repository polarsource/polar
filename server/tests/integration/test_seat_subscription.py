"""
Integration test: Seat-based subscription with volume-tiered pricing.
"""

from datetime import UTC, datetime
from decimal import Decimal

import freezegun
import pytest
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.checkout.service import checkout as checkout_service
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import AsyncSession
from polar.models import Order, Subscription
from polar.models.billing_entry import (
    BillingEntry,
    BillingEntryDirection,
    BillingEntryType,
)
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.product_price import ProductPriceSeatUnit
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_customer,
    create_organization,
    create_payment_method,
    create_product,
)

from .conftest import drain_jobs


@pytest.mark.asyncio
async def test_seat_subscription_lifecycle(
    save_fixture: SaveFixture,
    session: AsyncSession,
) -> None:
    # Story:
    #     An organization sells a seat-based monthly product with volume
    #     pricing across three tiers. A customer subscribes with 3 seats
    #     (Tier 1). Mid-period they upgrade to 8 seats (Tier 2), generating
    #     a proration. After the first renewal cycle they downgrade to 4
    #     seats (Tier 1), generating a credit. We verify billing entries,
    #     orders, and invoices at each step.
    #
    #     Volume pricing tiers:
    #       Tier 1:  1–5  seats  @ $10/seat
    #       Tier 2:  6–10 seats  @ $8/seat
    #       Tier 3:  11+  seats  @ $5/seat

    organization = await create_organization(save_fixture)

    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[],
        name="Team Plan",
        is_tax_applicable=False,
    )

    seat_price = ProductPriceSeatUnit(
        price_currency=PresentmentCurrency.usd,
        seat_tiers={
            "tiers": [
                {"min_seats": 1, "max_seats": 5, "price_per_seat": 1000},
                {"min_seats": 6, "max_seats": 10, "price_per_seat": 800},
                {"min_seats": 11, "max_seats": None, "price_per_seat": 500},
            ],
        },
        product=product,
    )
    await save_fixture(seat_price)
    product.prices.append(seat_price)
    await save_fixture(product)

    customer = await create_customer(
        save_fixture,
        organization=organization,
        email="team-lead@example.com",
        name="Sam TeamLead",
        billing_address=Address(
            country=CountryAlpha2("US"),
            line1="789 Pine St",
            city="Austin",
            state="TX",
            postal_code="73301",
        ),
    )

    payment_method = await create_payment_method(save_fixture, customer)
    customer.default_payment_method = payment_method
    await save_fixture(customer)

    # ── January 1st: Subscribe with 3 seats (Tier 1) ───────────────────
    with freezegun.freeze_time("2025-01-01 12:00:00", tz_offset=0):
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            price=seat_price,
            status=CheckoutStatus.confirmed,
            customer=customer,
            seats=3,
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
        assert subscription.seats == 3
        assert subscription.amount == 3000  # 3 × $10
        assert subscription.current_period_start == jan1
        assert subscription.current_period_end == feb1

        order_repository = OrderRepository.from_session(session)
        initial_order = await order_repository.get_earliest_by_checkout_id(
            checkout.id, options=(joinedload(Order.items),)
        )
        assert initial_order is not None
        assert initial_order.status == OrderStatus.paid
        assert initial_order.subtotal_amount == 3000
        assert (
            initial_order.billing_reason
            == OrderBillingReasonInternal.subscription_create
        )

        await drain_jobs(session)

    # ── January 16th: Upgrade to 8 seats (Tier 2) ──────────────────────
    with freezegun.freeze_time("2025-01-16 12:00:00", tz_offset=0):
        subscription = await subscription_service.update_seats(
            session,
            subscription,
            seats=8,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        assert subscription.seats == 8
        assert subscription.amount == 6400  # 8 × $8

        # Proration billing entry: debit for remaining period
        # Delta: 6400 - 3000 = 3400
        # Remaining: Jan 16 12:00 → Feb 1 12:00 = 16 days out of 31
        # Prorated: int(Decimal(3400) * Decimal(16 * 86400) / Decimal(31 * 86400))
        proration_entries = (
            (
                await session.execute(
                    select(BillingEntry).where(
                        BillingEntry.subscription_id == subscription.id,
                        BillingEntry.type
                        == BillingEntryType.subscription_seats_increase,
                    )
                )
            )
            .scalars()
            .all()
        )

        assert len(proration_entries) == 1
        entry = proration_entries[0]
        assert entry.direction == BillingEntryDirection.debit

        expected_proration = int(
            Decimal(3400) * Decimal(16 * 86400) / Decimal(31 * 86400)
        )
        assert entry.amount == expected_proration

    # ── February 1st: First renewal ─────────────────────────────────────
    with freezegun.freeze_time("2025-02-01 12:00:00", tz_offset=0):
        feb1 = datetime(2025, 2, 1, 12, 0, 0, tzinfo=UTC)
        mar1 = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC)

        subscription = await subscription_service.cycle(session, subscription)
        assert subscription.current_period_start == feb1
        assert subscription.current_period_end == mar1

        renewal_1 = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        # Order includes the cycle charge (6400) plus the upgrade proration
        assert renewal_1.subtotal_amount == 6400 + expected_proration
        assert renewal_1.billing_reason == OrderBillingReasonInternal.subscription_cycle

    # ── February 15th: Downgrade to 4 seats (Tier 1) ────────────────────
    with freezegun.freeze_time("2025-02-15 12:00:00", tz_offset=0):
        subscription = await subscription_service.update_seats(
            session,
            subscription,
            seats=4,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        assert subscription.seats == 4
        assert subscription.amount == 4000  # 4 × $10

        # Proration billing entry: credit for remaining period
        # Delta: 4000 - 6400 = -2400
        # Remaining: Feb 15 12:00 → Mar 1 12:00 = 14 days out of 28
        # Prorated: int(Decimal(-2400) * Decimal(14 * 86400) / Decimal(28 * 86400)) = -1200
        credit_entries = (
            (
                await session.execute(
                    select(BillingEntry).where(
                        BillingEntry.subscription_id == subscription.id,
                        BillingEntry.type
                        == BillingEntryType.subscription_seats_decrease,
                    )
                )
            )
            .scalars()
            .all()
        )

        assert len(credit_entries) == 1
        credit = credit_entries[0]
        assert credit.direction == BillingEntryDirection.credit

        expected_credit = abs(
            int(Decimal(-2400) * Decimal(14 * 86400) / Decimal(28 * 86400))
        )
        assert credit.amount == expected_credit
        assert expected_credit == 1200

    # ── March 1st: Second renewal ───────────────────────────────────────
    with freezegun.freeze_time("2025-03-01 12:00:00", tz_offset=0):
        mar1 = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC)
        apr1 = datetime(2025, 4, 1, 12, 0, 0, tzinfo=UTC)

        subscription = await subscription_service.cycle(session, subscription)
        assert subscription.current_period_start == mar1
        assert subscription.current_period_end == apr1

        renewal_2 = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        # Order includes the cycle charge (4000) minus the downgrade credit (1200)
        assert renewal_2.subtotal_amount == 4000 - expected_credit
        assert renewal_2.subtotal_amount == 2800

    # ── Final assertions ────────────────────────────────────────────────

    all_orders = (
        (
            await session.execute(
                select(Order)
                .where(Order.customer_id == customer.id)
                .options(joinedload(Order.items))
                .order_by(Order.created_at)
            )
        )
        .scalars()
        .unique()
        .all()
    )

    assert len(all_orders) == 3

    # Order 1: Initial subscription (3 seats @ $10)
    assert (
        all_orders[0].billing_reason == OrderBillingReasonInternal.subscription_create
    )
    assert all_orders[0].subtotal_amount == 3000

    # Order 2: Feb renewal (8 seats cycle + upgrade proration)
    assert all_orders[1].billing_reason == OrderBillingReasonInternal.subscription_cycle
    assert all_orders[1].subtotal_amount == 6400 + expected_proration

    # Order 3: Mar renewal (4 seats cycle - downgrade credit)
    assert all_orders[2].billing_reason == OrderBillingReasonInternal.subscription_cycle
    assert all_orders[2].subtotal_amount == 2800
