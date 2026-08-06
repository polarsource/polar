from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from polar.email.deduplication import (
    subscription_renewal_reminder_key,
    subscription_trial_conversion_reminder_key,
)
from polar.enums import EmailSender, SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Customer, Meter, Organization, Product
from polar.models.customer_seat import SeatStatus
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.models.subscription import Subscription, SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import is_metered_price
from polar.subscription.repository import (
    SubscriptionProductPriceRepository,
    SubscriptionRepository,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_customer,
    create_customer_seat,
    create_product,
    create_subscription,
)


@pytest.mark.asyncio
class TestSubscriptionProductPriceRepository:
    async def test_get_by_customers_and_meter_direct_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        later_subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=utc_now(),
        )
        earlier_subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=utc_now() - timedelta(days=1),
        )

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter([customer.id], meter.id)

        customer_price = result[customer.id]
        assert customer_price is not None
        assert customer_price.customer_id == customer.id
        assert (
            customer_price.subscription_product_price.subscription_id
            == earlier_subscription.id
        )
        assert (
            customer_price.subscription_product_price.subscription_id
            != later_subscription.id
        )

    async def test_get_by_customers_and_meter_seat_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
    ) -> None:
        billing_manager = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-manager@example.com",
        )
        seat_holder = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-holder@example.com",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=billing_manager
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=seat_holder,
            status=SeatStatus.claimed,
        )
        subscription_id = subscription.id
        session.expunge_all()

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter([seat_holder.id], meter.id)

        customer_price = result[seat_holder.id]
        assert customer_price is not None
        assert customer_price.customer_id == billing_manager.id
        assert (
            customer_price.subscription_product_price.subscription_id == subscription_id
        )
        assert (
            customer_price.subscription_product_price.subscription.id == subscription_id
        )

    async def test_get_by_customers_and_meter_no_subscription(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        repository = SubscriptionProductPriceRepository.from_session(session)

        result = await repository.get_by_customers_and_meter([customer.id], meter.id)

        assert result == {customer.id: None}

    async def test_get_by_customers_and_meter_mixed_batch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
    ) -> None:
        direct_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="direct@example.com",
        )
        seat_holder = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-holder@example.com",
        )
        customer_without_subscription = await create_customer(
            save_fixture,
            organization=organization,
            email="none@example.com",
        )
        billing_manager = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-manager@example.com",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        direct_subscription = await create_active_subscription(
            save_fixture, product=product, customer=direct_customer
        )
        seat_subscription = await create_active_subscription(
            save_fixture, product=product, customer=billing_manager
        )
        await create_customer_seat(
            save_fixture,
            subscription=seat_subscription,
            customer=seat_holder,
            status=SeatStatus.claimed,
        )
        await create_customer_seat(
            save_fixture,
            subscription=seat_subscription,
            customer=direct_customer,
            status=SeatStatus.claimed,
        )

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter(
            [
                direct_customer.id,
                seat_holder.id,
                customer_without_subscription.id,
            ],
            meter.id,
        )

        direct_customer_price = result[direct_customer.id]
        assert direct_customer_price is not None
        assert (
            direct_customer_price.subscription_product_price.subscription_id
            == direct_subscription.id
        )
        seat_holder_price = result[seat_holder.id]
        assert seat_holder_price is not None
        assert seat_holder_price.customer_id == billing_manager.id
        assert (
            seat_holder_price.subscription_product_price.subscription_id
            == seat_subscription.id
        )
        assert result[customer_without_subscription.id] is None

    async def test_get_by_customers_and_meter_multiple_seats_picks_most_recently_claimed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
    ) -> None:
        """When a customer holds multiple claimed seats, the most recently
        claimed seat's subscription determines the metered price.

        This guards against non-deterministic DISTINCT ON behavior: without
        a tiebreaker on claimed_at, PostgreSQL may return any of the
        customer's claimed seats, billing the wrong subscription.
        """
        seat_holder = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-holder@example.com",
        )
        billing_manager_a = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-manager-a@example.com",
        )
        billing_manager_b = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-manager-b@example.com",
        )

        # Two products with distinct metered unit prices for the same meter,
        # so the selected subscription is observable through the price amount.
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        product_b = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(200), None, "usd")],
        )
        subscription_a = await create_active_subscription(
            save_fixture, product=product_a, customer=billing_manager_a
        )
        subscription_b = await create_active_subscription(
            save_fixture, product=product_b, customer=billing_manager_b
        )

        # The seat claimed later (on subscription_b) must win.
        earlier_claimed_at = utc_now() - timedelta(days=2)
        later_claimed_at = utc_now() - timedelta(days=1)
        await create_customer_seat(
            save_fixture,
            subscription=subscription_a,
            customer=seat_holder,
            status=SeatStatus.claimed,
            claimed_at=earlier_claimed_at,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription_b,
            customer=seat_holder,
            status=SeatStatus.claimed,
            claimed_at=later_claimed_at,
        )
        subscription_b_id = subscription_b.id
        session.expunge_all()

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter([seat_holder.id], meter.id)

        customer_price = result[seat_holder.id]
        assert customer_price is not None
        # The most recently claimed seat's subscription is selected.
        assert (
            customer_price.subscription_product_price.subscription_id
            == subscription_b_id
        )
        # And the unit amount reflects subscription_b's metered price.
        product_price = customer_price.subscription_product_price.product_price
        assert is_metered_price(product_price)
        assert product_price.unit_amount == Decimal(200)


async def _create_sent_reminder_log(
    save_fixture: SaveFixture,
    *,
    email_template: str,
    deduplication_key: str,
    status: EmailLogStatus = EmailLogStatus.sent,
) -> EmailLog:
    email_log = EmailLog(
        status=status,
        processor=EmailSender.resend,
        to_email_addr="customer@example.com",
        from_email_addr="acme@polar.sh",
        from_name="Acme",
        subject="Reminder",
        email_template=email_template,
        email_props={},
        deduplication_key=deduplication_key,
    )
    await save_fixture(email_log)
    return email_log


@pytest.mark.asyncio
class TestGetSubscriptionsNeedingRenewalReminder:
    async def _yearly_subscription(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        current_period_end: datetime,
    ) -> Subscription:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        return await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            current_period_end=current_period_end,
        )

    async def test_returns_subscription_in_window(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = utc_now()
        subscription = await self._yearly_subscription(
            save_fixture, organization, customer, now + timedelta(days=3)
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_renewal_reminder(
            now, now + timedelta(days=7)
        )

        assert [s.id for s in result] == [subscription.id]

    async def test_excludes_subscription_already_reminded(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = utc_now()
        current_period_end = now + timedelta(days=3)
        subscription = await self._yearly_subscription(
            save_fixture, organization, customer, current_period_end
        )
        await _create_sent_reminder_log(
            save_fixture,
            email_template="subscription_renewal_reminder",
            deduplication_key=subscription_renewal_reminder_key(
                subscription.id, current_period_end.date()
            ),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_renewal_reminder(
            now, now + timedelta(days=7)
        )

        assert result == []

    async def test_returns_subscription_reminded_for_a_previous_period(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = utc_now()
        current_period_end = now + timedelta(days=3)
        subscription = await self._yearly_subscription(
            save_fixture, organization, customer, current_period_end
        )
        await _create_sent_reminder_log(
            save_fixture,
            email_template="subscription_renewal_reminder",
            deduplication_key=subscription_renewal_reminder_key(
                subscription.id, (current_period_end - timedelta(days=365)).date()
            ),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_renewal_reminder(
            now, now + timedelta(days=7)
        )

        assert [s.id for s in result] == [subscription.id]


@pytest.mark.asyncio
class TestGetSubscriptionsNeedingTrialConversionReminder:
    async def _trialing_subscription(
        self,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        *,
        trial_start: datetime,
        trial_end: datetime,
    ) -> Subscription:
        return await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
            trial_start=trial_start,
            trial_end=trial_end,
            current_period_start=trial_start,
            current_period_end=trial_end,
        )

    async def test_returns_subscription_in_window(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        now = utc_now()
        subscription = await self._trialing_subscription(
            save_fixture,
            product,
            customer,
            trial_start=now - timedelta(days=10),
            trial_end=now + timedelta(days=2),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_trial_conversion_reminder(
            now
        )

        assert [s.id for s in result] == [subscription.id]

    async def test_excludes_subscription_already_reminded(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        now = utc_now()
        trial_end = now + timedelta(days=2)
        subscription = await self._trialing_subscription(
            save_fixture,
            product,
            customer,
            trial_start=now - timedelta(days=10),
            trial_end=trial_end,
        )
        await _create_sent_reminder_log(
            save_fixture,
            email_template="subscription_trial_conversion_reminder",
            deduplication_key=subscription_trial_conversion_reminder_key(
                subscription.id, trial_end.date()
            ),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_trial_conversion_reminder(
            now
        )

        assert result == []
