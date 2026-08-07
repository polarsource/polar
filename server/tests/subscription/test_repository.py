from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from babel.dates import format_date as _format_date

from polar.enums import EmailSender, SubscriptionRecurringInterval
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.models import Customer, Meter, Organization, Product, Subscription
from polar.models.customer_seat import SeatStatus
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.postgres import AsyncSession
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
    create_trialing_subscription,
)


def _format_long(date: datetime) -> str:
    # Mirrors polar.invoice.generator.format_date (babel "long", en_US), which
    # the service uses and which the repository's "FMMonth FMDD, YYYY" to_char
    # must match.
    return _format_date(date, format="long", locale="en_US")


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


async def _create_email_log(
    save_fixture: SaveFixture,
    *,
    email_template: str,
    subscription: Subscription,
    date_key: str,
    date_value: str,
    status: EmailLogStatus = EmailLogStatus.sent,
) -> EmailLog:
    """Create an EmailLog row mirroring the props the service writes."""
    log = EmailLog(
        status=status,
        processor=EmailSender.resend,
        to_email_addr="customer@example.com",
        from_email_addr="noreply@polar.sh",
        from_name="Polar",
        subject="Your subscription renews soon",
        email_template=email_template,
        email_props={
            "email": "customer@example.com",
            "subscription": {"id": str(subscription.id)},
            date_key: date_value,
        },
    )
    await save_fixture(log)
    return log


@pytest.mark.asyncio
class TestGetSubscriptionsNeedingRenewalReminder:
    """Dedup must suppress re-sends regardless of which date format the prior
    EmailLog row stores (legacy "MM/DD/YYYY" or current long format)."""

    async def test_no_log_returns_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        now = utc_now()
        period_end = now + timedelta(days=5)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, started_at=now
        )
        subscription.current_period_end = period_end
        await save_fixture(subscription)

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_renewal_reminder(
            now, now + timedelta(days=7)
        )

        assert [s.id for s in result] == [subscription.id]

    async def test_legacy_format_log_dedups(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        now = utc_now()
        period_end = now + timedelta(days=5)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, started_at=now
        )
        subscription.current_period_end = period_end
        await save_fixture(subscription)

        # Prior reminder was logged using the OLD format (pre ba82dff7b).
        await _create_email_log(
            save_fixture,
            email_template="subscription_renewal_reminder",
            subscription=subscription,
            date_key="renewal_date",
            date_value=period_end.strftime("%m/%d/%Y"),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_renewal_reminder(
            now, now + timedelta(days=7)
        )

        assert result == []

    async def test_new_format_log_dedups(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        now = utc_now()
        period_end = now + timedelta(days=5)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, started_at=now
        )
        subscription.current_period_end = period_end
        await save_fixture(subscription)

        # Prior reminder logged using the CURRENT long format.
        await _create_email_log(
            save_fixture,
            email_template="subscription_renewal_reminder",
            subscription=subscription,
            date_key="renewal_date",
            date_value=_format_long(period_end),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_renewal_reminder(
            now, now + timedelta(days=7)
        )

        assert result == []


@pytest.mark.asyncio
class TestGetSubscriptionsNeedingTrialConversionReminder:
    """Dedup must suppress re-sends regardless of which date format the prior
    EmailLog row stores (legacy "MM/DD/YYYY" or current long format)."""

    async def _make_trial_subscription(
        self,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        trial_end: datetime,
    ) -> Subscription:
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            trial_interval=TrialInterval.month,
            trial_interval_count=1,
        )
        # create_trialing_subscription derives trial_start/trial_end from now;
        # override to control the reminder window and trial duration (>= 3 days).
        subscription.trial_start = trial_end - timedelta(days=14)
        subscription.trial_end = trial_end
        subscription.current_period_end = trial_end
        await save_fixture(subscription)
        return subscription

    async def test_no_log_returns_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        now = utc_now()
        trial_end = now + timedelta(days=2)
        subscription = await self._make_trial_subscription(
            save_fixture, product=product, customer=customer, trial_end=trial_end
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_trial_conversion_reminder(
            now
        )

        assert [s.id for s in result] == [subscription.id]

    async def test_legacy_format_log_dedups(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        now = utc_now()
        trial_end = now + timedelta(days=2)
        subscription = await self._make_trial_subscription(
            save_fixture, product=product, customer=customer, trial_end=trial_end
        )

        await _create_email_log(
            save_fixture,
            email_template="subscription_trial_conversion_reminder",
            subscription=subscription,
            date_key="conversion_date",
            date_value=trial_end.strftime("%m/%d/%Y"),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_trial_conversion_reminder(
            now
        )

        assert result == []

    async def test_new_format_log_dedups(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        now = utc_now()
        trial_end = now + timedelta(days=2)
        subscription = await self._make_trial_subscription(
            save_fixture, product=product, customer=customer, trial_end=trial_end
        )

        await _create_email_log(
            save_fixture,
            email_template="subscription_trial_conversion_reminder",
            subscription=subscription,
            date_key="conversion_date",
            date_value=_format_long(trial_end),
        )

        repository = SubscriptionRepository.from_session(session)
        result = await repository.get_subscriptions_needing_trial_conversion_reminder(
            now
        )

        assert result == []
