import uuid
from collections import namedtuple
from collections.abc import Generator
from datetime import datetime, timedelta
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
from polar.enums import (
    PaymentProcessor,
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
)
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.exceptions import (
    BadRequest,
    PolarRequestValidationError,
    ResourceUnavailable,
)
from polar.kit.pagination import PaginationParams
from polar.kit.trial import TrialInterval
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
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.checkout import CheckoutStatus
from polar.models.customer_seat import SeatStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.order import OrderBillingReasonInternal
from polar.models.product_price import ProductPriceSeatUnit
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import (
    MeteredPrice,
    is_fixed_price,
    is_free_price,
    is_metered_price,
)
from polar.subscription.schemas import (
    SubscriptionCreateCustomer,
    SubscriptionCreateExternalCustomer,
)
from polar.subscription.service import (
    AlreadyCanceledSubscription,
    BelowMinimumSeats,
    InactiveSubscription,
    MissingCheckoutCustomer,
    NotARecurringProduct,
    NotASeatBasedSubscription,
    SeatsAlreadyAssigned,
    TrialingSubscription,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_checkout,
    create_customer,
    create_customer_seat,
    create_discount,
    create_event,
    create_meter,
    create_product,
    create_product_price_seat_unit,
    create_subscription,
    create_subscription_with_seats,
    create_trialing_subscription,
    set_product_benefits,
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
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.subscription.service.enqueue_email")


@pytest.fixture
def frozen_time() -> Generator[datetime, None]:
    frozen_time = utc_now()
    with freezegun.freeze_time(frozen_time):
        yield frozen_time


@pytest.mark.asyncio
class TestCreate:
    async def test_product_does_not_exist(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
    ) -> None:
        subscription_create = SubscriptionCreateCustomer(
            product_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.create(
                session, subscription_create, auth_subject
            )

        errors = exc_info.value.errors()
        assert len(errors) == 2
        assert errors[0]["loc"] == ("body", "product_id")
        assert errors[0]["msg"] == "Product does not exist."
        assert errors[1]["loc"] == ("body", "customer_id")
        assert errors[1]["msg"] == "Customer does not exist."

    async def test_product_not_recurring(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        subscription_create = SubscriptionCreateCustomer(
            product_id=product_one_time.id,
            customer_id=customer.id,
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.create(
                session, subscription_create, auth_subject
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("body", "product_id")
        assert errors[0]["msg"] == "Product is not a recurring product."

    async def test_product_not_free(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product: Product,
        customer: Customer,
    ) -> None:
        subscription_create = SubscriptionCreateCustomer(
            product_id=product.id,
            customer_id=customer.id,
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.create(
                session, subscription_create, auth_subject
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("body", "product_id")
        assert (
            errors[0]["msg"]
            == "Product is not free. The customer should go through a checkout to create a paid subscription."
        )

    async def test_customer_does_not_exist_by_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_recurring_free_price: Product,
    ) -> None:
        subscription_create = SubscriptionCreateCustomer(
            product_id=product_recurring_free_price.id,
            customer_id=uuid.uuid4(),
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.create(
                session, subscription_create, auth_subject
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("body", "customer_id")
        assert errors[0]["msg"] == "Customer does not exist."

    async def test_customer_does_not_exist_by_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_recurring_free_price: Product,
    ) -> None:
        subscription_create = SubscriptionCreateExternalCustomer(
            product_id=product_recurring_free_price.id,
            external_customer_id="nonexistent",
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.create(
                session, subscription_create, auth_subject
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("body", "external_customer_id")
        assert errors[0]["msg"] == "Customer does not exist."

    async def test_valid_with_customer_id(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        subscription_hooks: Hooks,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        subscription_create = SubscriptionCreateCustomer(
            product_id=product_recurring_free_price.id,
            customer_id=customer.id,
            metadata={"key": "value"},
        )

        subscription = await subscription_service.create(
            session, subscription_create, auth_subject
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.product_id == product_recurring_free_price.id
        assert subscription.customer_id == customer.id
        assert subscription.prices == product_recurring_free_price.prices
        assert subscription.amount == 0
        assert subscription.currency == "usd"
        assert subscription.recurring_interval == SubscriptionRecurringInterval.month
        assert subscription.recurring_interval_count == 1
        assert subscription.user_metadata == {"key": "value"}

        assert subscription.started_at is not None
        assert subscription.current_period_start is not None
        assert subscription.current_period_end is not None
        assert subscription.started_at == subscription.current_period_start
        assert subscription.current_period_end > subscription.current_period_start

        assert_hooks_called_once(subscription_hooks, {"activated", "updated"})
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

    async def test_valid_with_external_customer_id(
        self,
        enqueue_benefits_grants_mock: MagicMock,
        subscription_hooks: Hooks,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_recurring_free_price: Product,
        customer_external_id: Customer,
    ) -> None:
        assert customer_external_id.external_id is not None

        subscription_create = SubscriptionCreateExternalCustomer(
            product_id=product_recurring_free_price.id,
            external_customer_id=customer_external_id.external_id,
        )

        subscription = await subscription_service.create(
            session, subscription_create, auth_subject
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.product_id == product_recurring_free_price.id
        assert subscription.customer_id == customer_external_id.id
        assert subscription.prices == product_recurring_free_price.prices

        assert_hooks_called_once(subscription_hooks, {"activated", "updated"})
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)


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
        assert updated_subscription.current_period_end is not None
        assert previous_current_period_end is not None
        assert updated_subscription.current_period_end > previous_current_period_end

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(
            session, updated_subscription
        )

    async def test_trial(
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
            trial_interval=TrialInterval.month,
            trial_interval_count=1,
        )

        (
            subscription,
            created,
        ) = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        assert created is True

        assert subscription.status == SubscriptionStatus.trialing
        assert subscription.prices == product.prices
        assert subscription.amount == checkout.total_amount
        assert subscription.payment_method == payment_method

        assert subscription.started_at is not None
        assert subscription.current_period_start is not None
        assert subscription.current_period_end is not None
        assert subscription.started_at == subscription.current_period_start
        assert subscription.current_period_end > subscription.current_period_start
        assert subscription.current_period_end == checkout.trial_end
        assert subscription.trial_start == subscription.current_period_start

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )
        enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)


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
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )

        previous_current_period_end = subscription.current_period_end

        updated_subscription = await subscription_service.cycle(session, subscription)

        assert updated_subscription.ended_at is None
        assert updated_subscription.current_period_start == previous_current_period_end
        assert updated_subscription.current_period_end is not None
        assert previous_current_period_end is not None
        assert updated_subscription.current_period_end > previous_current_period_end
        assert updated_subscription.scheduler_locked_at is None

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.subscription_cycled)
        assert len(events) == 1
        event = events[0]
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency
        assert (
            event.user_metadata["recurring_interval"]
            == subscription.recurring_interval.value
        )
        assert (
            event.user_metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )
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

        enqueue_job_mock.assert_any_call(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReasonInternal.subscription_cycle,
        )

        enqueue_email_mock.assert_not_called()

    async def test_free_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_recurring_free_price,
            customer=customer,
            scheduler_locked_at=utc_now(),
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
            save_fixture,
            product=product,
            customer=customer,
            discount=discount,
            scheduler_locked_at=utc_now(),
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

        billing_entry_repository = BillingEntryRepository.from_session(session)
        billing_entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(billing_entries) == 3

        (
            second_month_billing_entry,
            third_month_billing_entry,
            fourth_month_billing_entry,
        ) = billing_entries
        assert second_month_billing_entry.discount == discount
        assert third_month_billing_entry.discount == discount
        assert fourth_month_billing_entry.discount is None

    @freeze_time("2024-01-15")
    async def test_nth_month_cycle(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_every_second_month: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_recurring_every_second_month,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )

        first_period_start = subscription.current_period_start
        first_period_end = subscription.current_period_end
        assert first_period_start is not None
        assert first_period_end is not None
        assert first_period_end == first_period_start.replace(month=3)

        second_cycle_subscription = await subscription_service.cycle(
            session, subscription
        )
        second_period_start = second_cycle_subscription.current_period_start
        second_period_end = second_cycle_subscription.current_period_end
        assert second_period_start == first_period_end
        assert second_period_end is not None
        assert second_period_end == first_period_end.replace(month=5)

        third_cycle_subscription = await subscription_service.cycle(
            session, second_cycle_subscription
        )
        assert third_cycle_subscription.current_period_start == second_period_end
        assert third_cycle_subscription.current_period_end is not None
        assert third_cycle_subscription.current_period_end == second_period_end.replace(
            month=7
        )

        billing_entry_repository = BillingEntryRepository.from_session(session)
        billing_entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(billing_entries) == 2

        second_cycle_billing_entry, third_cycle_billing_entry = billing_entries
        assert second_cycle_billing_entry.start_timestamp == second_period_start
        assert second_cycle_billing_entry.end_timestamp == second_period_end
        assert (
            third_cycle_billing_entry.start_timestamp
            == third_cycle_subscription.current_period_start
        )
        assert (
            third_cycle_billing_entry.end_timestamp
            == third_cycle_subscription.current_period_end
        )

    async def test_cancel_at_period_end(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            cancel_at_period_end=True,
            scheduler_locked_at=utc_now(),
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
        assert updated_subscription.scheduler_locked_at is None

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_revoked
        )
        assert len(events) == 1
        event = events[0]
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency
        assert (
            event.user_metadata["recurring_interval"]
            == subscription.recurring_interval.value
        )
        assert (
            event.user_metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )
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
            delay=None,
        )
        enqueue_job_mock.assert_any_call(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReasonInternal.subscription_cycle,
        )

        enqueue_email_mock.assert_called_once()
        subject = enqueue_email_mock.call_args.kwargs["subject"]
        assert "ended" in subject.lower()

    async def test_trial_end(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )
        previous_trial_start = subscription.trial_start
        previous_trial_end = subscription.trial_end
        previous_current_period_end = subscription.current_period_end

        updated_subscription = await subscription_service.cycle(session, subscription)

        assert updated_subscription.ended_at is None
        assert updated_subscription.current_period_start == previous_current_period_end
        assert updated_subscription.current_period_end is not None
        assert previous_current_period_end is not None
        assert updated_subscription.current_period_end > previous_current_period_end
        assert updated_subscription.scheduler_locked_at is None
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.trial_start == previous_trial_start
        assert updated_subscription.trial_end == previous_trial_end

        enqueue_job_mock.assert_any_call(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReasonInternal.subscription_cycle_after_trial,
        )

        enqueue_email_mock.assert_not_called()

    async def test_trial_end_with_once_discount(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Create a "once" discount (e.g., 100% off)
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10_000,  # 100%
            duration=DiscountDuration.once,
            organization=organization,
            code="TRIAL100",
        )

        # Create trialing subscription with the discount
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount,
            scheduler_locked_at=utc_now(),
        )

        # Verify discount is applied
        assert subscription.discount == discount
        assert subscription.status == SubscriptionStatus.trialing

        # Cycle the subscription (trial ends, first billing cycle)
        updated_subscription = await subscription_service.cycle(session, subscription)

        # Verify discount is STILL applied after trial ends
        # This is the first actual billing cycle, so "once" discount should apply
        assert updated_subscription.discount == discount
        assert updated_subscription.status == SubscriptionStatus.active

        # Verify billing entry was created with discount
        billing_entry_repository = BillingEntryRepository.from_session(session)
        billing_entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert len(billing_entries) > 0
        cycle_entries = [
            entry for entry in billing_entries if entry.type == BillingEntryType.cycle
        ]
        assert len(cycle_entries) == 1
        assert cycle_entries[0].discount == discount
        assert cycle_entries[0].discount_amount is not None
        assert cycle_entries[0].discount_amount > 0

        # Now cycle again (second billing period)
        second_cycle_subscription = await subscription_service.cycle(
            session, updated_subscription
        )

        # Verify discount is NOW removed (used up after first billing cycle)
        assert second_cycle_subscription.discount is None


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

    async def test_uncancel_past_due(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            cancel_at_period_end=True,
        )

        updated_subscription = await subscription_service.uncancel(
            session, subscription
        )

        assert updated_subscription.status == SubscriptionStatus.past_due
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ends_at is None
        assert updated_subscription.canceled_at is None


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
        type=BillingEntryType.metered,
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
                    delay=None,
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
                    delay=None,
                )
            ]
        )

    async def test_seat_based_product_skips_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        await create_product_price_seat_unit(
            save_fixture,
            product=product,
            price_per_seat=1000,
        )
        await session.refresh(product)

        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
            status=SubscriptionStatus.active,
        )

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_not_called()

    async def test_non_seat_based_product_grants_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        from tests.fixtures.random_objects import create_customer

        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )

        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_called_once_with(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product.id,
            subscription_id=subscription.id,
            delay=None,
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
    async def test_trialing_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        product: Product,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(TrialingSubscription):
            await subscription_service.update_product(
                session, subscription, product_id=uuid.uuid4()
            )

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
        meter: Meter,
        product: Product,  # This is a product with fixed pricing
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Create a subscription with the initial product (which has fixed prices)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        await save_fixture(subscription)

        # Create a new product that only has metered prices (no static/fixed prices)
        metered_only_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None)],
        )

        updated_subscription = await subscription_service.update_product(
            session,
            subscription,
            product_id=metered_only_product.id,
            proration_behavior=SubscriptionProrationBehavior.prorate,
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

    async def test_valid_added(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        subscription = await subscription_service.update_discount(
            session, locker, subscription, discount_id=discount_percentage_50.id
        )

        assert subscription.discount == discount_percentage_50

    async def test_valid_modified(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
        discount_percentage_100: Discount,
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


@pytest.mark.asyncio
class TestUpdateTrial:
    async def test_trialing_subscription_ending_now(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )

        assert subscription.trial_end is not None
        original_trial_end = subscription.trial_end

        updated_subscription = await subscription_service.update_trial(
            session, subscription, trial_end="now"
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.trial_end is not None
        assert (
            updated_subscription.trial_end == updated_subscription.current_period_start
        )
        assert updated_subscription.trial_end < original_trial_end

    async def test_trialing_subscription_extending(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        subscription_hooks: Hooks,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )

        assert subscription.trial_end is not None
        original_trial_end = subscription.trial_end

        new_trial_end = original_trial_end + timedelta(days=30)

        reset_hooks(subscription_hooks)
        updated_subscription = await subscription_service.update_trial(
            session, subscription, trial_end=new_trial_end
        )

        assert updated_subscription.status == SubscriptionStatus.trialing
        assert updated_subscription.current_period_end == new_trial_end
        assert updated_subscription.trial_end == new_trial_end
        assert updated_subscription.trial_end is not None
        assert updated_subscription.trial_end > original_trial_end

        # Verify that the webhook was triggered
        assert_hooks_called_once(subscription_hooks, {"updated"})

    async def test_active_subscription_ending_now_validation_error(
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
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.update_trial(
                session, subscription, trial_end="now"
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "value_error"
        assert errors[0]["loc"] == ("body", "trial_end")
        assert "not currently trialing" in errors[0]["msg"]

    async def test_active_subscription_adding_trial(
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
        )

        assert subscription.current_period_end is not None

        trial_end = subscription.current_period_end + timedelta(days=14)

        updated_subscription = await subscription_service.update_trial(
            session, subscription, trial_end=trial_end
        )

        assert updated_subscription.status == SubscriptionStatus.trialing
        assert updated_subscription.trial_end == trial_end
        assert updated_subscription.current_period_end == trial_end
        assert updated_subscription.trialing

    async def test_active_subscription_adding_trial_before_current_period_end(
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
        )

        assert subscription.current_period_end is not None
        trial_end_before_period = subscription.current_period_end - timedelta(days=1)

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await subscription_service.update_trial(
                session, subscription, trial_end=trial_end_before_period
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "value_error"
        assert errors[0]["loc"] == ("body", "trial_end")
        assert "Trial end must be after the current period end" in errors[0]["msg"]

    async def test_seat_based_trialing_subscription_extending(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Trialing seat-based subscription
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
            trial_start=utc_now(),
            trial_end=utc_now() + timedelta(days=14),
            seats=5,
        )

        original_trial_end = subscription.trial_end
        assert original_trial_end is not None
        new_trial_end = original_trial_end + timedelta(days=30)

        # When: Extend trial
        updated_subscription = await subscription_service.update_trial(
            session, subscription, trial_end=new_trial_end
        )

        # Then: Trial extended, seats preserved
        assert updated_subscription.status == SubscriptionStatus.trialing
        assert updated_subscription.trial_end == new_trial_end
        assert updated_subscription.current_period_end == new_trial_end
        assert updated_subscription.seats == 5
        assert updated_subscription.amount == 5000


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
class TestMarkPastDue:
    """Test subscription service dunning functionality"""

    @freeze_time("2024-01-01 12:00:00")
    async def test_mark_past_due(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        enqueue_job_mock: MagicMock,
    ) -> None:
        # Given
        subscription.status = SubscriptionStatus.active
        await save_fixture(subscription)

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
            delay=None,
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


@pytest.mark.asyncio
class TestUpdatePaymentMethodFromRetry:
    async def test_existing_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        old_payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_old",
            type="card",
            customer=customer,
        )
        await save_fixture(old_payment_method)

        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription.payment_method = old_payment_method
        await save_fixture(subscription)

        # New payment method from retry
        new_payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_new",
            type="card",
            customer=customer,
        )
        await save_fixture(new_payment_method)

        # When
        updated_subscription = (
            await subscription_service.update_payment_method_from_retry(
                session, subscription, new_payment_method
            )
        )

        # But: Local subscription record is still updated
        assert updated_subscription.payment_method == new_payment_method

    async def test_subscription_without_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        # Given: Subscription without payment method
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription.payment_method = None
        await save_fixture(subscription)

        # New payment method from retry
        new_payment_method = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_new",
            type="card",
            customer=customer,
        )
        await save_fixture(new_payment_method)

        # When
        updated_subscription = (
            await subscription_service.update_payment_method_from_retry(
                session, subscription, new_payment_method
            )
        )

        # And: Local subscription record is updated
        assert updated_subscription.payment_method == new_payment_method


@pytest.mark.asyncio
class TestUpdateSeats:
    async def test_seat_increase_same_tier(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        enqueue_job_mock: MagicMock,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 5 seats at $10/seat = $50
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],  # $10 per seat
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )
        assert subscription.seats == 5
        assert subscription.amount == 5000

        # When: Increase to 10 seats
        updated = await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Seats and amount updated
        assert updated.seats == 10
        assert updated.amount == 10000

        # And: Proration entry created
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        proration_entries = [
            e for e in entries if e.type == BillingEntryType.subscription_seats_increase
        ]
        assert len(proration_entries) == 1
        entry = proration_entries[0]
        assert entry.direction == BillingEntryDirection.debit
        assert entry.amount is not None
        assert entry.amount > 0

    async def test_seat_increase_tier_change(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Product with tiered pricing
        # Tier 1: 1-10 seats at $10/seat
        # Tier 2: 11-50 seats at $8/seat
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        seat_price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "tiers": [
                    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
                    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
                ]
            },
            product=product,
        )
        await save_fixture(seat_price)
        product.prices.append(seat_price)
        await save_fixture(product)

        # Subscription with 5 seats = 5 * $10 = $50
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )
        assert subscription.amount == 5000

        # When: Increase to 15 seats (crosses to tier 2)
        updated = await subscription_service.update_seats(
            session,
            subscription,
            seats=15,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Amount = 15 * $8 = $120 (tier 2 pricing)
        assert updated.seats == 15
        assert updated.amount == 12000

    async def test_seat_decrease_blocked_by_assignments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 10 seats, 7 assigned
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=10,
        )

        # Create 7 assigned seats (mix of claimed and pending)
        for i in range(5):
            await create_customer_seat(
                save_fixture,
                subscription=subscription,
                status=SeatStatus.claimed,
                customer=await create_customer(
                    save_fixture,
                    organization=organization,
                    email=f"customer-{i}@example.com",
                ),
            )
        for i in range(2):
            await create_customer_seat(
                save_fixture,
                subscription=subscription,
                status=SeatStatus.pending,
            )

        # When: Try to decrease to 5 seats
        # Then: Raises error
        with pytest.raises(SeatsAlreadyAssigned) as exc_info:
            await subscription_service.update_seats(session, subscription, seats=5)

        assert exc_info.value.assigned_count == 7
        assert exc_info.value.requested_seats == 5

    async def test_seat_decrease_successful(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 10 seats, 3 assigned
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=10,
        )

        # Create only 3 assigned seats
        for i in range(3):
            await create_customer_seat(
                save_fixture,
                subscription=subscription,
                status=SeatStatus.claimed,
                customer=await create_customer(
                    save_fixture,
                    organization=organization,
                    email=f"customer-{i}@example.com",
                ),
            )

        # When: Decrease to 5 seats (above assigned count)
        updated = await subscription_service.update_seats(
            session,
            subscription,
            seats=5,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Successfully updated
        assert updated.seats == 5
        assert updated.amount == 5000

        # And: Credit entry created
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        credit_entries = [
            e for e in entries if e.type == BillingEntryType.subscription_seats_decrease
        ]
        assert len(credit_entries) == 1
        entry = credit_entries[0]
        assert entry.direction == BillingEntryDirection.credit
        assert entry.amount is not None
        assert entry.amount > 0

    async def test_below_minimum_seats(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Product with minimum 1 seat
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # When: Try to set seats=0
        # Then: Raises error
        with pytest.raises(BelowMinimumSeats) as exc_info:
            await subscription_service.update_seats(session, subscription, seats=0)

        assert exc_info.value.minimum_seats == 1
        assert exc_info.value.requested_seats == 0

    async def test_not_seat_based_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,  # This is a fixed price product
    ) -> None:
        # Given: Subscription without seat-based pricing
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        # When: Try to update seats
        # Then: Raises error
        with pytest.raises(NotASeatBasedSubscription):
            await subscription_service.update_seats(session, subscription, seats=10)

    async def test_trialing_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Trialing subscription
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        # Create using create_subscription directly to set seats
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
            trial_start=utc_now(),
            trial_end=utc_now() + timedelta(days=30),
            seats=5,
        )

        # When: Update seats during trial
        updated = await subscription_service.update_seats(
            session, subscription, seats=10
        )
        await session.flush()

        # Then: Successfully updated
        assert updated.seats == 10
        assert updated.amount == 10000

        # And: No proration entry created (no billing during trial)
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        assert len(entries) == 0

    async def test_canceled_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Canceled subscription
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        # Create using create_subscription directly to set seats
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            cancel_at_period_end=True,
            seats=5,
        )

        # When: Try to update seats
        # Then: Raises error
        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.update_seats(session, subscription, seats=10)

    async def test_proration_invoice_behavior(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        enqueue_job_mock: MagicMock,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 5 seats
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # When: Update with invoice behavior
        await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.invoice,
        )
        await session.flush()

        # Then: Order creation job enqueued
        enqueue_job_mock.assert_any_call(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReasonInternal.subscription_update,
        )

    async def test_proration_prorate_behavior(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        enqueue_job_mock: MagicMock,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 5 seats
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # When: Update with prorate behavior
        await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Order creation job NOT enqueued for immediate invoice
        # (prorate means add to next invoice, not create immediately)
        for call_args in enqueue_job_mock.call_args_list:
            assert call_args[0][0] != "order.create_subscription_order"

    async def test_no_proration_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription at end of period
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )
        # Set period end to past
        subscription.current_period_end = utc_now() - timedelta(hours=1)
        await save_fixture(subscription)

        # When: Update seats
        updated = await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Seats updated but no billing entry created
        assert updated.seats == 10
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        proration_entries = [
            e
            for e in entries
            if e.type
            in [
                BillingEntryType.subscription_seats_increase,
                BillingEntryType.subscription_seats_decrease,
            ]
        ]
        assert len(proration_entries) == 0

    async def test_seat_increase_with_fixed_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        enqueue_job_mock: MagicMock,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Mock webhook calls to avoid serialization issues with discount
        mocker.patch.object(
            subscription_service, "_after_subscription_updated", new=AsyncMock()
        )

        # Given: Subscription with 5 seats and $10 fixed discount
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],  # $10 per seat
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amount=1000,  # $10 discount
            currency="usd",
            duration=DiscountDuration.repeating,
            organization=organization,
            products=[product],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
            discount=discount,
        )
        assert subscription.seats == 5
        # $50 (5 seats * $10) - $10 discount = $40
        assert subscription.amount == 4000

        # When: Increase to 10 seats (delta = $50)
        updated = await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Discount applied to billing entry
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        proration_entries = [
            e for e in entries if e.type == BillingEntryType.subscription_seats_increase
        ]
        assert len(proration_entries) == 1
        entry = proration_entries[0]
        assert entry.direction == BillingEntryDirection.debit
        assert entry.discount_amount is not None
        # Base delta is $50, fixed discount of $10 on the delta
        # Since we're at the start of the period (100% time remaining),
        # proration factor is 1.0, so full discount applies
        assert entry.discount_amount == 1000  # $10 in cents
        assert entry.discount == discount
        # Net charge: $50 - $10 = $40
        assert entry.amount is not None
        assert entry.amount == 4000  # $40 in cents

    async def test_seat_increase_with_percentage_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        enqueue_job_mock: MagicMock,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Mock webhook calls to avoid serialization issues with discount
        mocker.patch.object(
            subscription_service, "_after_subscription_updated", new=AsyncMock()
        )

        # Given: Subscription with 5 seats and 20% discount
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],  # $10 per seat
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=2000,  # 20% discount
            duration=DiscountDuration.repeating,
            organization=organization,
            products=[product],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
            discount=discount,
        )

        # When: Increase to 10 seats (delta = $50, 20% discount = $10 off)
        await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Percentage discount applied
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        proration_entries = [
            e for e in entries if e.type == BillingEntryType.subscription_seats_increase
        ]
        assert len(proration_entries) == 1
        entry = proration_entries[0]
        assert entry.discount_amount is not None
        # Base delta is $50, 20% discount is $10
        # Since we're at the start of the period (100% time remaining),
        # proration factor is 1.0, so full discount applies
        assert entry.discount_amount == 1000  # $10 in cents (20% of $50)
        assert entry.discount == discount
        # Net charge: $50 - $10 = $40
        assert entry.amount is not None
        assert entry.amount == 4000  # $40 in cents

    async def test_seat_decrease_with_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        enqueue_job_mock: MagicMock,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Mock webhook calls to avoid serialization issues with discount
        mocker.patch.object(
            subscription_service, "_after_subscription_updated", new=AsyncMock()
        )

        # Given: Subscription with 10 seats and $10 fixed discount
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amount=1000,  # $10 discount
            currency="usd",
            duration=DiscountDuration.repeating,
            organization=organization,
            products=[product],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=10,
            discount=discount,
        )

        # When: Decrease to 5 seats (credit delta = -$50)
        await subscription_service.update_seats(
            session,
            subscription,
            seats=5,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: Discount reduces the credit amount
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        credit_entries = [
            e for e in entries if e.type == BillingEntryType.subscription_seats_decrease
        ]
        assert len(credit_entries) == 1
        entry = credit_entries[0]
        assert entry.direction == BillingEntryDirection.credit
        assert entry.discount_amount is not None
        # Base credit delta is -$50, discount of $10 on the delta
        # reduces the credit to -$40 (customer gets less credit)
        # Since we're at the start of the period (100% time remaining),
        # proration factor is 1.0, so full discount applies
        assert entry.discount_amount == 1000  # $10 in cents
        assert entry.discount == discount
        # Net credit: $50 - $10 = $40
        assert entry.amount is not None
        assert entry.amount == 4000  # $40 in cents

    async def test_seat_increase_without_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        frozen_time: datetime,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription without discount
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )
        assert subscription.discount is None

        # When: Increase seats
        await subscription_service.update_seats(
            session,
            subscription,
            seats=10,
            proration_behavior=SubscriptionProrationBehavior.prorate,
        )
        await session.flush()

        # Then: No discount in billing entry
        billing_entry_repo = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repo.get_pending_by_subscription(subscription.id)
        proration_entries = [
            e for e in entries if e.type == BillingEntryType.subscription_seats_increase
        ]
        assert len(proration_entries) == 1
        entry = proration_entries[0]
        assert entry.discount is None
        assert entry.discount_amount is None


@pytest.mark.asyncio
class TestEnqueueBenefitsGrantsGracePeriod:
    async def test_grace_period_not_expired(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        product.organization.subscription_settings[
            "benefit_revocation_grace_period"
        ] = 7
        await save_fixture(product.organization)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.status = SubscriptionStatus.past_due
        subscription.past_due_at = utc_now() - timedelta(days=2)
        await save_fixture(subscription)

        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        await subscription_service.enqueue_benefits_grants(session, subscription)
        enqueue_job_mock.assert_not_called()

    async def test_grace_period_expired(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        product.organization.subscription_settings[
            "benefit_revocation_grace_period"
        ] = 7
        await save_fixture(product.organization)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.status = SubscriptionStatus.past_due
        subscription.past_due_at = utc_now() - timedelta(days=8)
        await save_fixture(subscription)

        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        await subscription_service.enqueue_benefits_grants(session, subscription)
        enqueue_job_mock.assert_called_once_with(
            "benefit.enqueue_benefits_grants",
            task="revoke",
            customer_id=customer.id,
            product_id=product.id,
            subscription_id=subscription.id,
            delay=None,
        )

    async def test_grace_period_immediate_revocation(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        product.organization.subscription_settings[
            "benefit_revocation_grace_period"
        ] = 0
        await save_fixture(product.organization)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.status = SubscriptionStatus.past_due
        subscription.past_due_at = utc_now() - timedelta(minutes=1)
        await save_fixture(subscription)

        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        await subscription_service.enqueue_benefits_grants(session, subscription)
        enqueue_job_mock.assert_called_once_with(
            "benefit.enqueue_benefits_grants",
            task="revoke",
            customer_id=customer.id,
            product_id=product.id,
            subscription_id=subscription.id,
            delay=None,
        )

    async def test_grace_period_only_applies_to_past_due_unpaid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        product.organization.subscription_settings[
            "benefit_revocation_grace_period"
        ] = 7
        await save_fixture(product.organization)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.status = SubscriptionStatus.canceled
        await save_fixture(subscription)

        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        await subscription_service.enqueue_benefits_grants(session, subscription)
        enqueue_job_mock.assert_called_once_with(
            "benefit.enqueue_benefits_grants",
            task="revoke",
            customer_id=customer.id,
            product_id=product.id,
            subscription_id=subscription.id,
            delay=None,
        )
