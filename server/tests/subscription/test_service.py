import uuid
from collections import namedtuple
from collections.abc import Generator
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, call

import freezegun
import pytest
import pytest_asyncio
import stripe as stripe_lib
from freezegun import freeze_time
from pytest_mock import MockerFixture
from sqlalchemy.util.typing import TypeAlias

from polar.auth.models import AuthSubject
from polar.billing_entry.repository import BillingEntryRepository
from polar.checkout.eventstream import CheckoutEvent
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.exceptions import (
    BadRequest,
    PolarRequestValidationError,
    ResourceUnavailable,
)
from polar.integrations.stripe.service import StripeService
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterConjunction
from polar.models import (
    Benefit,
    BillingEntry,
    Customer,
    Discount,
    Meter,
    Organization,
    PaymentMethod,
    Product,
    ProductPrice,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.billing_entry import BillingEntryDirection
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import (
    MeteredPrice,
    is_fixed_price,
    is_free_price,
    is_metered_price,
)
from polar.subscription.service import (
    AlreadyCanceledSubscription,
    InactiveSubscription,
    MissingCheckoutCustomer,
    NotARecurringProduct,
    SubscriptionDoesNotExist,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_checkout,
    create_discount,
    create_event,
    create_meter,
    create_product,
    create_subscription,
    set_product_benefits,
)
from tests.fixtures.stripe import (
    build_stripe_payment_method,
    cloned_stripe_canceled_subscription,
    cloned_stripe_subscription,
    construct_stripe_subscription,
)

Hooks = namedtuple("Hooks", "updated activated canceled uncanceled revoked")
HookNames = frozenset(Hooks._fields)


def assert_hooks_called_once(subscription_hooks: Hooks, called: set[str]) -> None:
    for hook in called:
        getattr(subscription_hooks, hook).assert_called_once()

    not_called = HookNames - called
    for hook in not_called:
        getattr(subscription_hooks, hook).assert_not_called()


def reset_hooks(subscription_hooks: Hooks) -> None:
    for hook in HookNames:
        getattr(subscription_hooks, hook).reset_mock()


def build_stripe_payment_intent(
    *,
    amount: int = 0,
    status: str = "succeeded",
    customer: str | None = "CUSTOMER_ID",
    payment_method: str | None = "PAYMENT_METHOD_ID",
) -> stripe_lib.PaymentIntent:
    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "STRIPE_PAYMENT_INTENT_ID",
            "amount": amount,
            "status": status,
            "customer": customer,
            "payment_method": payment_method,
        },
        None,
    )


@pytest.fixture
def subscription_hooks(mocker: MockerFixture) -> Hooks:
    updated = mocker.patch.object(subscription_service, "_on_subscription_updated")
    activated = mocker.patch.object(subscription_service, "_on_subscription_activated")
    canceled = mocker.patch.object(subscription_service, "_on_subscription_canceled")
    uncanceled = mocker.patch.object(
        subscription_service, "_on_subscription_uncanceled"
    )
    revoked = mocker.patch.object(subscription_service, "_on_subscription_revoked")
    return Hooks(
        updated=updated,
        activated=activated,
        canceled=canceled,
        uncanceled=uncanceled,
        revoked=revoked,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.subscription.service.stripe_service", new=mock)
    return mock


@pytest.fixture
def publish_checkout_event_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.subscription.service.publish_checkout_event")


@pytest.fixture
def enqueue_benefits_grants_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(subscription_service, "enqueue_benefits_grants")


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.subscription.service.enqueue_job")


@pytest.fixture
def frozen_time() -> Generator[datetime, None]:
    frozen_time = utc_now()
    with freezegun.freeze_time(frozen_time):
        yield frozen_time


@pytest.mark.asyncio
class TestCreateOrUpdateFromCheckout:
    async def test_not_recurring_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
        )
        with pytest.raises(NotARecurringProduct):
            await subscription_service.create_or_update_from_checkout(
                session, checkout, None
            )

    async def test_missing_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
        )
        with pytest.raises(MissingCheckoutCustomer):
            await subscription_service.create_or_update_from_checkout(
                session, checkout, None
            )

    async def test_new_fixed(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        payment_method: PaymentMethod,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        (
            subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        assert created is True

        assert subscription.status == SubscriptionStatus.active
        assert subscription.prices == product.prices
        assert subscription.amount == checkout.total_amount
        assert subscription.payment_method == payment_method

        assert subscription.started_at is not None
        assert subscription.current_period_start is not None
        assert subscription.current_period_end is not None
        assert subscription.started_at == subscription.current_period_start
        assert subscription.current_period_end > subscription.current_period_start

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

    async def test_new_custom(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_custom_price: Product,
        customer: Customer,
        payment_method: PaymentMethod,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_custom_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
            amount=4242,
            currency="usd",
        )

        (
            subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        assert created is True

        assert subscription.status == SubscriptionStatus.active
        assert subscription.prices == product_recurring_custom_price.prices
        assert subscription.amount == checkout.total_amount
        assert subscription.currency == checkout.currency
        assert subscription.payment_method == payment_method

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

    async def test_new_free(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_free_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        (
            subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, None
        )

        assert created is True

        assert subscription.status == SubscriptionStatus.active
        assert subscription.prices == product_recurring_free_price.prices
        assert subscription.amount == 0
        assert subscription.currency == "usd"
        assert subscription.payment_method is None

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

    async def test_new_metered(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
        payment_method: PaymentMethod,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_metered],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        (
            subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        assert created is True

        assert subscription.status == SubscriptionStatus.active
        assert subscription.prices == product_recurring_metered.prices
        assert subscription.amount == 0
        assert subscription.currency == "usd"
        assert subscription.payment_method == payment_method

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

        event_repository = EventRepository.from_session(session)
        for subscription_meter in subscription.meters:
            meter_reset = await event_repository.get_latest_meter_reset(
                customer, subscription_meter.meter_id
            )
            assert meter_reset is not None

    async def test_new_custom_discount_percentage_100(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_custom_price: Product,
        customer: Customer,
        discount_percentage_100: Discount,
        payment_method: PaymentMethod,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_custom_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
            amount=4242,
            currency="usd",
            discount=discount_percentage_100,
        )

        (
            subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        assert created is True

        assert subscription.status == SubscriptionStatus.active
        assert subscription.prices == product_recurring_custom_price.prices
        assert subscription.amount == 0
        assert subscription.currency == checkout.currency
        assert subscription.payment_method == payment_method

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

    async def test_upgrade_fixed(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_free_price: Product,
        product: Product,
        customer: Customer,
        payment_method: PaymentMethod,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_free_price,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
            subscription=subscription,
        )
        previous_current_period_start = subscription.current_period_start
        previous_current_period_end = subscription.current_period_end
        previous_started_at = subscription.started_at

        (
            updated_subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        assert created is False

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.prices == product.prices
        assert updated_subscription.amount == checkout.total_amount
        assert updated_subscription.currency == checkout.currency
        assert updated_subscription.payment_method == payment_method

        # Started at doesn't change, but current period does
        assert updated_subscription.started_at == previous_started_at
        assert updated_subscription.current_period_start > previous_current_period_start
        assert updated_subscription.current_period_end > previous_current_period_end

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(
            session, updated_subscription
        )


@pytest.mark.asyncio
class TestCycle:
    async def test_inactive(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(InactiveSubscription):
            await subscription_service.cycle(session, subscription)

    async def test_fixed_price(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        previous_current_period_end = subscription.current_period_end

        updated_subscription = await subscription_service.cycle(session, subscription)

        assert updated_subscription.ended_at is None
        assert updated_subscription.current_period_start == previous_current_period_end
        assert updated_subscription.current_period_end > previous_current_period_end

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.subscription_cycled)
        assert len(events) == 1
        event = events[0]
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.customer_id == customer.id
        assert event.organization_id == customer.organization_id

        price = product.prices[0]
        assert is_fixed_price(price)
        billing_entry_repository = BillingEntryRepository.from_session(session)
        billing_entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(billing_entries) == 1
        billing_entry = billing_entries[0]
        assert (
            billing_entry.start_timestamp == updated_subscription.current_period_start
        )
        assert billing_entry.end_timestamp == updated_subscription.current_period_end
        assert billing_entry.direction == BillingEntryDirection.debit
        assert billing_entry.customer_id == customer.id
        assert billing_entry.product_price_id == price.id
        assert billing_entry.event_id == event.id
        assert billing_entry.amount == price.price_amount
        assert billing_entry.currency == price.price_currency

        enqueue_job_mock.assert_any_call("order.subscription_cycle", subscription.id)

    async def test_free_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product_recurring_free_price, customer=customer
        )

        await subscription_service.cycle(session, subscription)

        price = product_recurring_free_price.prices[0]
        assert is_free_price(price)
        billing_entry_repository = BillingEntryRepository.from_session(session)
        billing_entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(billing_entries) == 1
        billing_entry = billing_entries[0]
        assert billing_entry.amount == 0
        assert billing_entry.currency == subscription.currency

    @freeze_time("2024-01-15")
    async def test_discount_repetition(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amount=1000,
            currency="usd",
            duration=DiscountDuration.repeating,
            duration_in_months=3,
            organization=organization,
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )

        second_month_subscription = await subscription_service.cycle(
            session, subscription
        )
        assert second_month_subscription.discount == discount

        third_month_subscription = await subscription_service.cycle(
            session, second_month_subscription
        )
        assert third_month_subscription.discount == discount

        fourth_month_subscription = await subscription_service.cycle(
            session, third_month_subscription
        )
        assert fourth_month_subscription.discount is None

    async def test_cancel_at_period_end(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, cancel_at_period_end=True
        )

        previous_current_period_start = subscription.current_period_start
        previous_current_period_end = subscription.current_period_end

        updated_subscription = await subscription_service.cycle(session, subscription)

        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.ended_at == updated_subscription.ends_at
        assert (
            updated_subscription.current_period_start == previous_current_period_start
        )
        assert updated_subscription.current_period_end == previous_current_period_end

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_revoked
        )
        assert len(events) == 1
        event = events[0]
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.customer_id == customer.id
        assert event.organization_id == customer.organization_id

        billing_entry_repository = BillingEntryRepository.from_session(session)
        billing_entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(billing_entries) == 0

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="revoke",
            customer_id=customer.id,
            product_id=product.id,
            subscription_id=subscription.id,
        )
        enqueue_job_mock.assert_any_call("order.subscription_cycle", subscription.id)


@pytest.mark.asyncio
class TestRevoke:
    async def test_already_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            stripe_subscription_id=None,
        )

        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.revoke(session, subscription)

    async def test_valid(
        self,
        frozen_time: datetime,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )

        updated_subscription = await subscription_service.revoke(session, subscription)

        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.canceled_at == frozen_time
        assert updated_subscription.ends_at == frozen_time
        assert updated_subscription.ended_at == frozen_time

        enqueue_benefits_grants_mock.assert_called_once_with(
            session, updated_subscription
        )


@pytest.mark.asyncio
class TestCancel:
    async def test_repeat_cancel_raises(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is True

        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.cancel(session, subscription)


@pytest.mark.asyncio
class TestUncancel:
    async def test_not_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )

        with pytest.raises(BadRequest):
            await subscription_service.uncancel(session, subscription)

    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            cancel_at_period_end=True,
            stripe_subscription_id=None,
        )

        updated_subscription = await subscription_service.uncancel(
            session, subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ends_at is None
        assert updated_subscription.canceled_at is None

    async def test_uncancel_active(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is False

        with pytest.raises(BadRequest):
            await subscription_service.uncancel(session, subscription)

    async def test_uncancel_already_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
            cancel_at_period_end=False,
            revoke=True,
        )
        assert subscription.cancel_at_period_end is False
        assert subscription.ended_at
        assert subscription.canceled_at

        with pytest.raises(ResourceUnavailable):
            await subscription_service.uncancel(session, subscription)


@pytest.mark.asyncio
class TestUpdateFromStripe:
    async def test_not_existing_subscription(
        self, session: AsyncSession, locker: Locker, product: Product
    ) -> None:
        stripe_subscription = construct_stripe_subscription(product=product)

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.update_from_stripe(
                session, locker, stripe_subscription=stripe_subscription
            )

    async def test_valid(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        stripe_payment_method = build_stripe_payment_method(
            customer=customer.stripe_customer_id,
        )
        stripe_service_mock.get_payment_method.return_value = stripe_payment_method
        stripe_subscription = construct_stripe_subscription(
            product=product,
            status=SubscriptionStatus.active,
            default_payment_method=stripe_payment_method.id,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.started_at is not None
        assert updated_subscription.payment_method is not None
        assert (
            updated_subscription.payment_method.processor_id == stripe_payment_method.id
        )

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_discount_reset(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
    ) -> None:
        stripe_subscription = construct_stripe_subscription(
            product=product, status=SubscriptionStatus.active, discounts=[]
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
            discount=discount_percentage_50,
        )
        assert subscription.discount is not None

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.discount is None

    async def test_valid_cancel_at_period_end(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(subscription)

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True

        enqueue_benefits_grants_mock.assert_called_once()
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})

    async def test_send_cancel_hooks_once(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is False
        stripe_subscription = cloned_stripe_subscription(
            subscription, cancel_at_period_end=True
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True
        assert updated_subscription.ends_at
        assert updated_subscription.canceled_at
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})
        reset_hooks(subscription_hooks)

        repeat_cancellation = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )
        assert repeat_cancellation.status == SubscriptionStatus.active
        assert repeat_cancellation.cancel_at_period_end is True
        assert repeat_cancellation.ends_at
        assert repeat_cancellation.canceled_at
        assert_hooks_called_once(subscription_hooks, {"updated"})

    async def test_valid_uncancel(
        self,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is True
        assert subscription.ends_at
        assert subscription.canceled_at

        stripe_subscription = cloned_stripe_subscription(
            subscription, cancel_at_period_end=False
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ends_at is None
        assert updated_subscription.canceled_at is None
        assert_hooks_called_once(subscription_hooks, {"updated", "uncanceled"})

    async def test_valid_revokation(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(
            subscription, revoke=True
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ended_at

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    customer_id=subscription.customer_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
            ]
        )
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled", "revoked"})

    async def test_valid_cancel_and_revoke(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        organization: Organization,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(
            subscription,
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})
        reset_hooks(subscription_hooks)

        # Now revoke
        stripe_subscription = cloned_stripe_canceled_subscription(
            updated_subscription, revoke=True
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, locker, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ended_at

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    customer_id=subscription.customer_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
            ]
        )
        assert_hooks_called_once(subscription_hooks, {"updated", "revoked"})


async def create_event_billing_entry(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    product: Product,
    price: ProductPrice,
    subscription: Subscription,
    tokens: int,
) -> BillingEntry:
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        customer=customer,
        metadata={"tokens": tokens},
    )
    billing_entry = BillingEntry(
        start_timestamp=event.timestamp,
        end_timestamp=event.timestamp,
        direction=BillingEntryDirection.debit,
        customer=customer,
        product_price=price,
        subscription=subscription,
        event=event,
    )
    await save_fixture(billing_entry)
    return billing_entry


UpdateMetersFixture: TypeAlias = tuple[Meter, Product, MeteredPrice, Subscription]


@pytest_asyncio.fixture
async def update_meters_fixtures(
    mocker: MockerFixture,
    session: AsyncSession,
    save_fixture: SaveFixture,
    customer: Customer,
    organization: Organization,
) -> UpdateMetersFixture:
    meter = await create_meter(
        save_fixture,
        filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
        aggregation=PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        ),
        organization=organization,
    )
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None)],
    )
    price = product.prices[0]
    assert is_metered_price(price)
    subscription = await create_active_subscription(
        save_fixture, product=product, customer=customer
    )

    return meter, product, price, subscription


@pytest.mark.asyncio
class TestUpdateMeters:
    async def test_no_entries(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        update_meters_fixtures: UpdateMetersFixture,
    ) -> None:
        meter, product, price, subscription = update_meters_fixtures
        subscription_meter = subscription.meters[0]
        subscription_meter.consumed_units = Decimal(100)
        subscription_meter.credited_units = 0
        subscription_meter.amount = 10000
        await save_fixture(subscription_meter)

        updated_subscription = await subscription_service.update_meters(
            session, subscription
        )

        assert len(updated_subscription.meters) == 1
        updated_subscription_meter = updated_subscription.meters[0]
        assert subscription_meter.id == updated_subscription_meter.id
        assert updated_subscription_meter.meter == meter
        assert updated_subscription_meter.consumed_units == 0
        assert updated_subscription_meter.credited_units == 0
        assert updated_subscription_meter.amount == 0

    async def test_basic(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        update_meters_fixtures: UpdateMetersFixture,
    ) -> None:
        meter, product, price, subscription = update_meters_fixtures
        subscription_meter = subscription.meters[0]
        entries = [
            await create_event_billing_entry(
                save_fixture,
                customer=customer,
                product=product,
                price=price,
                subscription=subscription,
                tokens=10,
            ),
            await create_event_billing_entry(
                save_fixture,
                customer=customer,
                product=product,
                price=price,
                subscription=subscription,
                tokens=20,
            ),
            await create_event_billing_entry(
                save_fixture,
                customer=customer,
                product=product,
                price=price,
                subscription=subscription,
                tokens=30,
            ),
        ]

        updated_subscription = await subscription_service.update_meters(
            session, subscription
        )

        assert len(updated_subscription.meters) == 1
        updated_subscription_meter = updated_subscription.meters[0]

        assert subscription_meter.id == updated_subscription_meter.id
        assert updated_subscription_meter.meter == meter
        assert updated_subscription_meter.consumed_units == 60
        assert updated_subscription_meter.credited_units == 0
        assert updated_subscription_meter.amount == 6000


@pytest.mark.asyncio
class TestEnqueueBenefitsGrants:
    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.incomplete, SubscriptionStatus.incomplete_expired]
    )
    async def test_incomplete_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_not_called()

    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.trialing, SubscriptionStatus.active]
    )
    async def test_active_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.enqueue_benefits_grants",
                    task="grant",
                    customer_id=subscription.customer_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
            ]
        )

    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.past_due,
            SubscriptionStatus.canceled,
            SubscriptionStatus.unpaid,
        ],
    )
    async def test_canceled_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    customer_id=subscription.customer_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
            ]
        )


@pytest.mark.asyncio
class TestUpdateProductBenefitsGrants:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        customer: Customer,
        product: Product,
        product_second: Product,
    ) -> None:
        subscription_1 = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_2 = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        await create_subscription(
            save_fixture,
            product=product_second,
            customer=customer,
        )

        # then
        session.expunge_all()

        await subscription_service.update_product_benefits_grants(session, product)

        assert enqueue_benefits_grants_mock.call_count == 2
        # Collect actual subscription IDs from the mock calls
        actual_ids = set(
            call.args[1].id for call in enqueue_benefits_grants_mock.call_args_list
        )
        expected_ids = {subscription_1.id, subscription_2.id}
        assert actual_ids == expected_ids


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 0
        assert count == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1

    @pytest.mark.auth
    async def test_metadata_filter(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription_1 = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "ABC"},
        )
        subscription_2 = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "DEF"},
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "GHI"},
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            metadata={"reference_id": ["ABC", "DEF"]},
        )

        assert len(results) == 2
        assert count == 2

        assert subscription_1 in results
        assert subscription_2 in results


@pytest.mark.asyncio
class TestUpdateProduct:
    async def test_meters(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        meter: Meter,
        product_recurring_fixed_and_metered: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product_recurring_fixed_and_metered, customer=customer
        )
        assert len(subscription.meters) == 1
        subscription_meter = subscription.meters[0]
        assert subscription_meter.meter == meter
        assert subscription_meter.subscription == subscription

        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            # Same meter, but the price comes after the fixed price
            # It's important to test that the order of prices does not matter
            prices=[(3000,), (meter, Decimal(50), None)],
        )

        updated_subscription = await subscription_service.update_product(
            session,
            subscription,
            product_id=new_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        assert updated_subscription.product == new_product
        assert len(updated_subscription.meters) == 1
        updated_subscription_meter = updated_subscription.meters[0]
        assert updated_subscription_meter.meter == meter
        assert updated_subscription_meter.subscription == updated_subscription

    async def test_update_to_metered_only_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        meter: Meter,
        product: Product,  # This is a product with fixed pricing
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Create a subscription with the initial product (which has fixed prices)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription.stripe_subscription_id = "sub_test_stripe_id"
        await save_fixture(subscription)

        # Create a new product that only has metered prices (no static/fixed prices)
        metered_only_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None)],
        )

        mock_placeholder_price = MagicMock()
        mock_placeholder_price.id = "price_placeholder_test_id"
        stripe_service_mock.create_placeholder_price.return_value = (
            mock_placeholder_price
        )

        updated_subscription = await subscription_service.update_product(
            session,
            subscription,
            product_id=metered_only_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )

        stripe_service_mock.create_placeholder_price.assert_called_once_with(
            metered_only_product,
            subscription.currency,
            idempotency_key=f"subscription_update_{subscription.id}_placeholder",
        )

        # Verify that update_subscription_price was called with the placeholder price
        stripe_service_mock.update_subscription_price.assert_called_once_with(
            subscription.stripe_subscription_id,
            new_prices=["price_placeholder_test_id"],
            proration_behavior="create_prorations",  # This is the Stripe equivalent of prorate
            metadata={
                "type": "product",
                "product_id": str(metered_only_product.id),
            },
        )

        assert updated_subscription.product == metered_only_product


@pytest.mark.asyncio
class TestUpdateDiscount:
    async def test_not_existing_discount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount_percentage_50,
        )

        with pytest.raises(PolarRequestValidationError):
            await subscription_service.update_discount(
                session, locker, subscription, discount_id=uuid.uuid4()
            )

    async def test_same_discount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
        discount_percentage_100: Discount,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount_percentage_50,
        )

        with pytest.raises(PolarRequestValidationError):
            await subscription_service.update_discount(
                session, locker, subscription, discount_id=discount_percentage_50.id
            )

    async def test_valid_removed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount_percentage_50,
        )

        subscription = await subscription_service.update_discount(
            session, locker, subscription, discount_id=None
        )

        assert subscription.discount is None
        stripe_service_mock.update_subscription_discount.assert_called_once_with(
            subscription.stripe_subscription_id,
            discount_percentage_50.stripe_coupon_id,
            None,
        )

    async def test_valid_added(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        subscription = await subscription_service.update_discount(
            session, locker, subscription, discount_id=discount_percentage_50.id
        )

        assert subscription.discount == discount_percentage_50
        stripe_service_mock.update_subscription_discount.assert_called_once_with(
            subscription.stripe_subscription_id,
            None,
            discount_percentage_50.stripe_coupon_id,
        )

    async def test_valid_modified(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
        discount_percentage_100: Discount,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount_percentage_50,
        )

        subscription = await subscription_service.update_discount(
            session, locker, subscription, discount_id=discount_percentage_100.id
        )

        assert subscription.discount == discount_percentage_100
        stripe_service_mock.update_subscription_discount.assert_called_once_with(
            subscription.stripe_subscription_id,
            discount_percentage_50.stripe_coupon_id,
            discount_percentage_100.stripe_coupon_id,
        )


@pytest.mark.asyncio
async def test_send_confirmation_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
) -> None:
    subscription = await create_subscription(
        save_fixture, product=product, customer=customer
    )

    await subscription_service.send_confirmation_email(session, subscription)


@pytest.mark.asyncio
async def test_send_past_due_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
) -> None:
    subscription = await create_subscription(
        save_fixture, product=product, customer=customer
    )

    await subscription_service.send_past_due_email(session, subscription)


@pytest.mark.asyncio
async def test_send_change_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
) -> None:
    subscription = await create_subscription(
        save_fixture, product=product, customer=customer
    )

    await subscription_service.send_subscription_updated_email(
        session, subscription, product, product
    )


@pytest.mark.asyncio
class TestMarkPastDue:
    """Test subscription service dunning functionality"""

    @freeze_time("2024-01-01 12:00:00")
    async def test_mark_past_due(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        enqueue_job_mock: MagicMock,
    ) -> None:
        # Given
        subscription.status = SubscriptionStatus.active
        await save_fixture(subscription)

        # Mock the Stripe calls in send_past_due_email
        stripe_subscription_mock = mocker.patch(
            "polar.subscription.service.stripe_lib.Subscription.retrieve_async"
        )
        stripe_subscription_mock.return_value = mocker.MagicMock(latest_invoice=None)

        invoice_mock = mocker.patch(
            "polar.subscription.service.stripe_service.get_invoice"
        )
        invoice_mock.return_value = mocker.MagicMock(hosted_invoice_url=None)

        mocker.patch("polar.subscription.service.enqueue_email")

        # When
        result_subscription = await subscription_service.mark_past_due(
            session, subscription
        )

        # Then
        assert result_subscription.status == SubscriptionStatus.past_due
        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="revoke",
            customer_id=subscription.customer.id,
            product_id=subscription.product.id,
            subscription_id=subscription.id,
        )

    @freeze_time("2024-01-01 12:00:00")
    async def test_mark_past_due_sends_email(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        enqueue_job_mock: MagicMock,
    ) -> None:
        # Given
        subscription.status = SubscriptionStatus.active
        await save_fixture(subscription)

        # Mock the Stripe calls in send_past_due_email
        stripe_subscription_mock = mocker.patch(
            "polar.subscription.service.stripe_lib.Subscription.retrieve_async"
        )
        stripe_subscription_mock.return_value = mocker.MagicMock(latest_invoice=None)

        invoice_mock = mocker.patch(
            "polar.subscription.service.stripe_service.get_invoice"
        )
        invoice_mock.return_value = mocker.MagicMock(hosted_invoice_url=None)

        mocker.patch("polar.subscription.service.enqueue_email")

        send_past_due_email_mock = mocker.patch.object(
            subscription_service, "send_past_due_email"
        )

        # When
        result_subscription = await subscription_service.mark_past_due(
            session, subscription
        )

        # Then
        assert result_subscription.status == SubscriptionStatus.past_due
        send_past_due_email_mock.assert_called_once_with(session, subscription)
