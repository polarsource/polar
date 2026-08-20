from datetime import UTC, datetime, timedelta

import freezegun
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.enums import (
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
)
from polar.exceptions import PolarRequestValidationError
from polar.kit.trial import TrialInterval
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    OrderItem,
    Organization,
    Product,
    Subscription,
)
from polar.postgres import AsyncSession
from polar.subscription.service import (
    SubscriptionUpdateContext,
)
from polar.subscription.service import (
    subscription as subscription_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
    create_product_fixed_and_seat,
    create_product_unit_based,
    create_subscription_with_seats,
    create_subscription_with_units,
    create_trialing_subscription,
)


@pytest.mark.asyncio
class TestCalculateChangePreview:
    async def test_product_upgrade_prices_the_proration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(5000, "usd")],
        )

        preview = await subscription_service.calculate_change_preview(
            session,
            subscription,
            product_id=new_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )

        # A credit for the old product and a debit for the new one.
        assert len(preview.prorations) == 2
        assert preview.proration_amount > 0
        assert preview.total_amount == preview.proration_amount

    async def test_upgrade_at_half_period_prices_half_of_each(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        with freezegun.freeze_time(datetime(2025, 1, 16, 12, tzinfo=UTC)):
            subscription = await create_active_subscription(
                save_fixture,
                product=product,
                customer=customer,
                current_period_start=datetime(2025, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2025, 2, 1, tzinfo=UTC),
            )
            new_product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[(5000, "usd")],
            )

            preview = await subscription_service.calculate_change_preview(
                session,
                subscription,
                product_id=new_product.id,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        # Exactly half the cycle remains: credit half of 1000, charge half of 5000.
        assert sorted(p.amount for p in preview.prorations) == [-500, 2500]
        assert preview.proration_amount == 2000
        assert preview.subtotal_amount == 2000
        assert preview.total_amount == 2000

    async def test_trial_ending_change_charges_a_full_period(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Switching to a product without a trial ends the trial and bills a cycle."""
        subscription = await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(5000, "usd")],
        )

        preview = await subscription_service.calculate_change_preview(
            session,
            subscription,
            product_id=new_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )

        assert preview.prorations == []
        assert preview.total_amount == 5000

    async def test_trial_continuing_change_charges_nothing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(5000, "usd")],
            trial_interval=TrialInterval.month,
            trial_interval_count=3,
        )

        preview = await subscription_service.calculate_change_preview(
            session,
            subscription,
            product_id=new_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )

        assert preview.prorations == []
        assert preview.total_amount == 0

    async def test_trial_added_via_update_trial_then_preview_product_with_trial(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # Regression: previewing a product change after a trial was added to an
        # active subscription via update_trial must not crash in
        # _resolve_trial_end (trial_start was previously left None).
        trial_added_at = datetime(2025, 6, 1, 12, 0, 0, tzinfo=UTC)
        with freezegun.freeze_time(trial_added_at):
            subscription = await create_active_subscription(
                save_fixture, product=product, customer=customer
            )

            assert subscription.current_period_end is not None
            trial_end = subscription.current_period_end + timedelta(days=14)

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                subscription = await subscription_service.update_trial(
                    session, ctx, subscription, trial_end=trial_end
                )

            assert subscription.trial_start == trial_added_at

            new_product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[(5000, "usd")],
                trial_interval=TrialInterval.month,
                trial_interval_count=3,
            )

            preview = await subscription_service.calculate_change_preview(
                session,
                subscription,
                product_id=new_product.id,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        assert preview.prorations == []
        assert preview.total_amount == 0

    async def test_non_seat_to_seat_quotes_the_minimum_seats(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        seat_product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=0,
            tiers=[{"min_seats": 3, "max_seats": None, "price_per_seat": 1000}],
        )

        with freezegun.freeze_time(datetime(2025, 1, 16, 12, tzinfo=UTC)):
            subscription = await create_active_subscription(
                save_fixture,
                product=product,
                customer=customer,
                current_period_start=datetime(2025, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2025, 2, 1, tzinfo=UTC),
            )

            preview = await subscription_service.calculate_change_preview(
                session,
                subscription,
                product_id=seat_product.id,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        # Half a cycle of the three minimum seats, less the old plan's unused half.
        assert sorted(p.amount for p in preview.prorations) == [-500, 1500]
        assert preview.total_amount == 1000

    async def test_non_seat_to_seat_rejects_next_period(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        seat_product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=0,
            tiers=[{"min_seats": 3, "max_seats": None, "price_per_seat": 1000}],
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(PolarRequestValidationError):
            await subscription_service.calculate_change_preview(
                session,
                subscription,
                product_id=seat_product.id,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )

    async def test_seat_increase_at_half_period_charges_the_delta(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        seat_product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=0,
            price_per_seat=1000,
        )

        with freezegun.freeze_time(datetime(2025, 1, 16, 12, tzinfo=UTC)):
            subscription = await create_subscription_with_seats(
                save_fixture,
                product=seat_product,
                customer=customer,
                seats=10,
                current_period_start=datetime(2025, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2025, 2, 1, tzinfo=UTC),
            )

            preview = await subscription_service.calculate_change_preview(
                session,
                subscription,
                seats=12,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        # Half a cycle of two extra seats at 1000 each.
        assert preview.proration_amount == 1000
        assert preview.total_amount == 1000

    async def test_unit_increase_at_half_period_charges_the_delta(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        unit_product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=1000
        )

        with freezegun.freeze_time(datetime(2025, 1, 16, 12, tzinfo=UTC)):
            subscription = await create_subscription_with_units(
                save_fixture,
                product=unit_product,
                customer=customer,
                units=10,
                current_period_start=datetime(2025, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2025, 2, 1, tzinfo=UTC),
            )

            preview = await subscription_service.calculate_change_preview(
                session,
                subscription,
                units=12,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        # Half a cycle of two extra units at 1000 each.
        assert preview.proration_amount == 1000
        assert preview.total_amount == 1000

    async def test_unit_preview_persists_nothing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        unit_product = await create_product_unit_based(
            save_fixture, organization=organization, price_per_unit=1000
        )
        subscription = await create_subscription_with_units(
            save_fixture, product=unit_product, customer=customer, units=10
        )
        subscription_id = subscription.id

        await subscription_service.calculate_change_preview(
            session,
            subscription,
            units=12,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        assert await session.scalar(select(func.count()).select_from(BillingEntry)) == 0
        assert (
            await session.scalar(
                select(Subscription.units).where(Subscription.id == subscription_id)
            )
            == 10
        )

    async def test_non_unit_to_unit_quotes_the_minimum_units(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        unit_product = await create_product_unit_based(
            save_fixture,
            organization=organization,
            price_per_unit=1000,
            minimum_units=3,
        )

        with freezegun.freeze_time(datetime(2025, 1, 16, 12, tzinfo=UTC)):
            subscription = await create_active_subscription(
                save_fixture,
                product=product,
                customer=customer,
                current_period_start=datetime(2025, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2025, 2, 1, tzinfo=UTC),
            )

            preview = await subscription_service.calculate_change_preview(
                session,
                subscription,
                product_id=unit_product.id,
                proration_behavior=SubscriptionProrationBehavior.prorate,
            )

        # Half a cycle of the three minimum units, less the old plan's unused half.
        assert sorted(p.amount for p in preview.prorations) == [-500, 1500]
        assert preview.total_amount == 1000

    async def test_seat_preview_persists_nothing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        seat_product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=0,
            price_per_seat=1000,
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=seat_product, customer=customer, seats=10
        )
        subscription_id = subscription.id

        await subscription_service.calculate_change_preview(
            session,
            subscription,
            seats=12,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        assert await session.scalar(select(func.count()).select_from(BillingEntry)) == 0
        assert (
            await session.scalar(
                select(Subscription.seats).where(Subscription.id == subscription_id)
            )
            == 10
        )

    async def test_preview_persists_nothing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # A queued event would outlive the rollback.
        enqueue_events_mock = mocker.patch("polar.event.service.enqueue_events")
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_id = subscription.id
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(5000, "usd")],
        )
        events_before = await session.scalar(select(func.count()).select_from(Event))

        await subscription_service.calculate_change_preview(
            session,
            subscription,
            product_id=new_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        assert await session.scalar(select(func.count()).select_from(BillingEntry)) == 0
        assert await session.scalar(select(func.count()).select_from(OrderItem)) == 0
        assert (
            await session.scalar(select(func.count()).select_from(Event))
            == events_before
        )
        assert (
            await session.scalar(
                select(Subscription.product_id).where(
                    Subscription.id == subscription_id
                )
            )
            == product.id
        )
        enqueue_events_mock.assert_not_called()
