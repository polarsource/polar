import uuid
from collections import namedtuple
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, call

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.util.typing import TypeAlias

from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.exceptions import (
    BadRequest,
    PolarRequestValidationError,
    ResourceUnavailable,
)
from polar.integrations.stripe.service import StripeService
from polar.kit.pagination import PaginationParams
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
    Product,
    ProductPrice,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.billing_entry import BillingEntryDirection
from polar.models.checkout import CheckoutStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import MeteredPrice, is_metered_price
from polar.subscription.service import (
    AlreadyCanceledSubscription,
    MissingCheckoutCustomer,
    MissingStripeCustomerID,
    NotARecurringProduct,
    SubscriptionDoesNotExist,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.email import WatcherEmailRenderer, watch_email
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_checkout,
    create_customer,
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

    async def test_missing_customer_stripe_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=product.organization, stripe_customer_id=None
        )
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )
        with pytest.raises(MissingStripeCustomerID):
            await subscription_service.create_or_update_from_checkout(
                session, checkout, None
            )

    async def test_new_fixed(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        stripe_payment_method = build_stripe_payment_method(
            customer=customer.stripe_customer_id,
        )
        stripe_service_mock.get_payment_method.return_value = stripe_payment_method
        stripe_subscription = construct_stripe_subscription(product=product)
        stripe_service_mock.create_out_of_band_subscription.return_value = (
            stripe_subscription,
            SimpleNamespace(id="STRIPE_INVOICE_ID", total=checkout.total_amount),
        )

        payment_intent = build_stripe_payment_intent(amount=checkout.total_amount)

        subscription = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_intent
        )

        assert subscription.status == stripe_subscription.status
        assert subscription.prices == product.prices
        assert subscription.amount == checkout.total_amount
        assert subscription.payment_method is not None
        assert subscription.payment_method.processor_id == stripe_payment_method.id

        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

    async def test_new_custom(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_custom_price: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_custom_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
            amount=4242,
            currency="usd",
        )

        stripe_payment_method = build_stripe_payment_method(
            customer=customer.stripe_customer_id,
        )
        stripe_service_mock.get_payment_method.return_value = stripe_payment_method
        stripe_subscription = construct_stripe_subscription(
            product=product_recurring_custom_price
        )
        stripe_service_mock.create_ad_hoc_custom_price.return_value = SimpleNamespace(
            id="STRIPE_CUSTOM_PRICE_ID"
        )
        stripe_service_mock.create_out_of_band_subscription.return_value = (
            stripe_subscription,
            SimpleNamespace(id="STRIPE_INVOICE_ID", total=checkout.total_amount),
        )

        payment_intent = build_stripe_payment_intent(amount=checkout.total_amount)

        subscription = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_intent
        )

        assert subscription.status == stripe_subscription.status
        assert subscription.prices == product_recurring_custom_price.prices
        assert subscription.amount == checkout.total_amount
        assert subscription.currency == checkout.currency
        assert subscription.payment_method is not None
        assert subscription.payment_method.processor_id == stripe_payment_method.id

        stripe_service_mock.create_ad_hoc_custom_price.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        assert stripe_service_mock.create_out_of_band_subscription.call_args[1][
            "prices"
        ] == ["STRIPE_CUSTOM_PRICE_ID"]
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

    async def test_new_free(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_free_price: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_free_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        stripe_subscription = construct_stripe_subscription(
            product=product_recurring_free_price
        )
        stripe_service_mock.create_out_of_band_subscription.return_value = (
            stripe_subscription,
            SimpleNamespace(id="STRIPE_INVOICE_ID", total=checkout.total_amount),
        )

        subscription = await subscription_service.create_or_update_from_checkout(
            session, checkout, None
        )

        assert subscription.status == stripe_subscription.status
        assert subscription.prices == product_recurring_free_price.prices
        assert subscription.amount == 0
        assert subscription.currency == "usd"
        assert subscription.payment_method is None

        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        assert (
            stripe_service_mock.create_out_of_band_subscription.call_args[1][
                "automatic_tax"
            ]
            is False
        )
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

    async def test_new_metered(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_metered],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        stripe_subscription = construct_stripe_subscription(
            product=product_recurring_metered
        )
        stripe_service_mock.create_out_of_band_subscription.return_value = (
            stripe_subscription,
            SimpleNamespace(id="STRIPE_INVOICE_ID", total=checkout.total_amount),
        )

        subscription = await subscription_service.create_or_update_from_checkout(
            session, checkout, None
        )

        assert subscription.status == stripe_subscription.status
        assert subscription.prices == product_recurring_metered.prices
        assert subscription.amount == 0
        assert subscription.currency == "usd"

        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        assert (
            stripe_service_mock.create_out_of_band_subscription.call_args[1][
                "automatic_tax"
            ]
            is True
        )
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

    async def test_new_custom_discount_percentage_100(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_custom_price: Product,
        customer: Customer,
        discount_percentage_100: Discount,
        stripe_service_mock: MagicMock,
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

        stripe_subscription = construct_stripe_subscription(
            product=product_recurring_custom_price
        )
        stripe_service_mock.create_ad_hoc_custom_price.return_value = SimpleNamespace(
            id="STRIPE_CUSTOM_PRICE_ID"
        )
        stripe_service_mock.create_out_of_band_subscription.return_value = (
            stripe_subscription,
            SimpleNamespace(id="STRIPE_INVOICE_ID", total=checkout.total_amount),
        )

        subscription = await subscription_service.create_or_update_from_checkout(
            session, checkout, None
        )

        assert subscription.status == stripe_subscription.status
        assert subscription.prices == product_recurring_custom_price.prices
        assert subscription.amount == 0
        assert subscription.currency == checkout.currency

        stripe_service_mock.create_ad_hoc_custom_price.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        assert stripe_service_mock.create_out_of_band_subscription.call_args[1][
            "prices"
        ] == ["STRIPE_CUSTOM_PRICE_ID"]
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

    async def test_upgrade_fixed(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_free_price: Product,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
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

        stripe_payment_method = build_stripe_payment_method(
            customer=customer.stripe_customer_id,
        )
        stripe_service_mock.get_payment_method.return_value = stripe_payment_method
        stripe_subscription = construct_stripe_subscription(product=product)
        stripe_service_mock.update_out_of_band_subscription.return_value = (
            stripe_subscription,
            SimpleNamespace(id="STRIPE_INVOICE_ID", total=checkout.total_amount),
        )

        payment_intent = build_stripe_payment_intent(amount=checkout.total_amount)

        subscription = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_intent
        )

        assert subscription.status == stripe_subscription.status
        assert subscription.prices == product.prices
        assert subscription.amount == checkout.total_amount
        assert subscription.currency == checkout.currency
        assert subscription.payment_method is not None
        assert subscription.payment_method.processor_id == stripe_payment_method.id

        stripe_service_mock.update_out_of_band_subscription.assert_called_once()
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )


@pytest.mark.asyncio
class TestUpdateFromStripe:
    async def test_not_existing_subscription(
        self, session: AsyncSession, product: Product
    ) -> None:
        stripe_subscription = construct_stripe_subscription(product=product)

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.update_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

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
            session, stripe_subscription=stripe_subscription
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
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        discount_percentage_50: Discount,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

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
            session, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.discount is None

    async def test_valid_cancel_at_period_end(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(subscription)

        updated_subscription = await subscription_service.update_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True

        enqueue_benefits_grants_mock.assert_called_once()
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})

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

    async def test_send_cancel_hooks_once(
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
        stripe_subscription = cloned_stripe_subscription(
            subscription, cancel_at_period_end=True
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True
        assert updated_subscription.ends_at
        assert updated_subscription.canceled_at
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})
        reset_hooks(subscription_hooks)

        repeat_cancellation = await subscription_service.update_from_stripe(
            session, stripe_subscription=stripe_subscription
        )
        assert repeat_cancellation.status == SubscriptionStatus.active
        assert repeat_cancellation.cancel_at_period_end is True
        assert repeat_cancellation.ends_at
        assert repeat_cancellation.canceled_at
        assert_hooks_called_once(subscription_hooks, {"updated"})

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

    async def test_valid_uncancel(
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
        assert subscription.ends_at
        assert subscription.canceled_at

        stripe_subscription = cloned_stripe_subscription(
            subscription, cancel_at_period_end=False
        )

        updated_subscription = await subscription_service.update_from_stripe(
            session, stripe_subscription=stripe_subscription
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
            session, stripe_subscription=stripe_subscription
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
            session, stripe_subscription=stripe_subscription
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
            session, stripe_subscription=stripe_subscription
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
        mocker: MockerFixture,
        customer: Customer,
        product: Product,
        product_second: Product,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

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
        assert enqueue_benefits_grants_mock.call_args_list[0].args[1] == subscription_1
        assert enqueue_benefits_grants_mock.call_args_list[1].args[1] == subscription_2


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
@pytest.mark.email_subscription_confirmation
async def test_send_confirmation_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
) -> None:
    with WatcherEmailRenderer() as email_sender:
        mocker.patch("polar.subscription.service.enqueue_email", email_sender)

        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        async def _send_confirmation_email() -> None:
            await subscription_service.send_confirmation_email(session, subscription)

        await watch_email(_send_confirmation_email, email_sender.path)
