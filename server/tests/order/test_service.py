import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any, TypedDict, cast
from unittest.mock import ANY, AsyncMock, MagicMock, call

import pytest
import pytest_asyncio
import stripe as stripe_lib
from freezegun import freeze_time
from pydantic_extra_types.country import CountryAlpha2
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent
from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
from polar.kit.db.postgres import AsyncSession
from polar.kit.math import polar_round
from polar.kit.pagination import PaginationParams
from polar.kit.tax import TaxabilityReason, TaxCalculation, TaxID, calculate_tax
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    BillingEntry,
    Customer,
    Discount,
    Product,
    ProductPriceFixed,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountFixed, DiscountType
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.organization import Organization
from polar.models.payment import PaymentStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import PlatformFeeType, TransactionType
from polar.order.service import (
    CardPaymentFailed,
    MissingCheckoutCustomer,
    NoPendingBillingEntries,
    NotAnOrderInvoice,
    NotASubscriptionInvoice,
    NotRecurringProduct,
    OrderDoesNotExist,
    OrderNotEligibleForRetry,
    OrderNotPending,
    PaymentAlreadyInProgress,
    RecurringProduct,
    SubscriptionDoesNotExist,
)
from polar.order.service import order as order_service
from polar.product.guard import is_fixed_price, is_static_price
from polar.subscription.service import SubscriptionService
from polar.transaction.service.balance import (
    PaymentTransactionForChargeDoesNotExist,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.platform_fee import PlatformFeeTransactionService
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_billing_entry,
    create_canceled_subscription,
    create_checkout,
    create_customer,
    create_discount,
    create_event,
    create_order,
    create_payment,
    create_payment_method,
    create_product,
    create_subscription,
)
from tests.fixtures.stripe import construct_stripe_invoice
from tests.transaction.conftest import create_transaction


def build_stripe_payment_intent(
    *,
    amount: int = 0,
    status: str = "succeeded",
    customer: str | None = "CUSTOMER_ID",
    payment_method: str | None = "PAYMENT_METHOD_ID",
    latest_charge: str | None = "CHARGE_ID",
) -> stripe_lib.PaymentIntent:
    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "STRIPE_PAYMENT_INTENT_ID",
            "amount": amount,
            "status": status,
            "customer": customer,
            "payment_method": payment_method,
            "latest_charge": latest_charge,
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture, customer: Customer) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.order.service.stripe_service", new=mock)

    mock.get_customer.return_value = SimpleNamespace(
        id=customer.stripe_customer_id,
        email=customer.email,
        name=customer.name,
        address=customer.billing_address,
    )

    mock.get_tax_rate.return_value = stripe_lib.TaxRate.construct_from(
        {
            "id": "STRIPE_TAX_RATE_ID",
            "rate_type": "percentage",
            "percentage": 20.0,
            "flat_amount": None,
            "display_name": "VAT",
            "country": "FR",
            "state": None,
        },
        key=None,
    )

    return mock


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.order.service.enqueue_job")


@pytest.fixture
def enqueue_job_mock_billing_entry(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.billing_entry.service.enqueue_job")


@pytest.fixture
def publish_checkout_event_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.order.service.publish_checkout_event")


@pytest.fixture
def event_creation_time() -> tuple[datetime, int]:
    created_datetime = datetime.fromisoformat("2024-01-01T00:00:00Z")
    created_unix_timestamp = int(created_datetime.timestamp())
    return created_datetime, created_unix_timestamp


@pytest.fixture
def calculate_tax_mock(mocker: MockerFixture) -> AsyncMock:
    mock = AsyncMock(spec=calculate_tax)
    mocker.patch("polar.order.service.calculate_tax", new=mock)
    mock.return_value = {
        "processor_id": "TAX_PROCESSOR_ID",
        "amount": 100,
        "taxability_reason": TaxabilityReason.standard_rated,
        "tax_rate": {},
    }
    return mock


def assert_set_order_item_ids(
    enqueue_job_mock: MagicMock,
    expected_billing_entry_ids: list[uuid.UUID],
    expected_order_item_ids: list[uuid.UUID],
) -> None:
    # `enqueue_job` gets called a couple of times, only one of which
    # we care about. We do the following to extract only that "one" and
    # assert that it's just called once or never in the two cases.
    calls = [
        (args, kwargs)
        for args, kwargs in enqueue_job_mock.call_args_list
        if args[0] == "billing_entry.set_order_item"
    ]
    billing_entry_ids = set()
    order_item_ids = set()
    for args, kwargs in calls:
        billing_entry_ids |= set(args[1])
        order_item_ids.add(args[2])

    assert billing_entry_ids == set(expected_billing_entry_ids)
    assert order_item_ids == set(expected_order_item_ids)


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        customer: Customer,
        customer_organization_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_1",
        )
        await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
            stripe_invoice_id="INVOICE_2",
        )

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order.id

    @pytest.mark.auth
    async def test_user_organization_filter(
        self,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        organization_second: Organization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        customer: Customer,
        customer_organization_second: Customer,
    ) -> None:
        user_organization_second_admin = UserOrganization(
            user_id=user.id, organization_id=organization_second.id
        )
        await save_fixture(user_organization_second_admin)

        order_organization = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_1",
        )
        order_organization_second = await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
            stripe_invoice_id="INVOICE_2",
        )

        # No filter
        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )
        assert count == 2
        assert len(orders) == 2
        assert orders[0].id == order_organization_second.id
        assert orders[1].id == order_organization.id

        # Filter by organization
        orders, count = await order_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            organization_id=[organization_second.id],
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order_organization_second.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        customer: Customer,
        customer_organization_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_1",
        )
        await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
            stripe_invoice_id="INVOICE_2",
        )

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order.id

    @pytest.mark.auth
    async def test_product_billing_type_filter(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_organization: UserOrganization,
        product: Product,
        product_one_time_custom_price: Product,
        product_one_time_free_price: Product,
        customer: Customer,
    ) -> None:
        order1 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_1",
        )
        order2 = await create_order(
            save_fixture,
            product=product_one_time_custom_price,
            customer=customer,
            stripe_invoice_id="INVOICE_2",
        )

        orders, count = await order_service.list(
            session,
            auth_subject,
            product_billing_type=(ProductBillingType.recurring,),
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order1.id

        orders, count = await order_service.list(
            session,
            auth_subject,
            product_billing_type=(ProductBillingType.one_time,),
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order2.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        order1 = await create_order(
            save_fixture,
            user_metadata={"reference_id": "ABC"},
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_1",
        )
        order2 = await create_order(
            save_fixture,
            user_metadata={"reference_id": "DEF"},
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_2",
        )
        await create_order(
            save_fixture,
            user_metadata={"reference_id": "GHI"},
            product=product,
            customer=customer,
            stripe_invoice_id="INVOICE_3",
        )

        orders, total = await order_service.list(
            session,
            auth_subject,
            metadata={"reference_id": ["ABC", "DEF"]},
            pagination=PaginationParams(1, 10),
        )

        assert len(orders) == 2
        assert total == 2

        assert order1 in orders
        assert order2 in orders


@pytest.mark.asyncio
class TestCreateFromCheckoutOneTime:
    async def test_recurring_product(
        self, save_fixture: SaveFixture, session: AsyncSession, product: Product
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], status=CheckoutStatus.confirmed
        )
        with pytest.raises(RecurringProduct):
            await order_service.create_from_checkout_one_time(session, checkout)

    async def test_missing_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product_one_time], status=CheckoutStatus.confirmed
        )
        with pytest.raises(MissingCheckoutCustomer):
            await order_service.create_from_checkout_one_time(session, checkout)

    async def test_fixed(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time
        assert len(order.items) == len(product_one_time.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_custom(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_custom_price: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_custom_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
            amount=4242,
            currency="usd",
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_custom_price
        assert len(order.items) == len(product_one_time_custom_price.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_custom_price.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_free(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_free_price: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_free_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == 0
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_free_price
        assert len(order.items) == len(product_one_time_free_price.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_free_price.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_fixed_discounted_100(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        discount_percentage_100: Discount,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
            discount=discount_percentage_100,
        )

        discount_amount = sum(
            cast(ProductPriceFixed, price).price_amount
            for price in product_one_time.prices
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == 0
        assert order.discount_amount == discount_amount
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time
        assert len(order.items) == len(product_one_time.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )


@pytest.mark.asyncio
class TestCreateFromCheckoutSubscription:
    async def test_not_recurring_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        subscription: Subscription,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product_one_time], status=CheckoutStatus.confirmed
        )
        with pytest.raises(NotRecurringProduct):
            await order_service.create_from_checkout_subscription(
                session, checkout, subscription, OrderBillingReason.subscription_create
            )

    async def test_missing_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], status=CheckoutStatus.confirmed
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(MissingCheckoutCustomer):
            await order_service.create_from_checkout_subscription(
                session, checkout, subscription, OrderBillingReason.subscription_create
            )

    async def test_fixed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        order = await order_service.create_from_checkout_subscription(
            session, checkout, subscription, OrderBillingReason.subscription_create
        )

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.subscription_create
        assert order.customer == checkout.customer
        assert order.product == product
        assert len(order.items) == len(product.prices)

    async def test_metered(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_metered],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )
        subscription = await create_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )

        order = await order_service.create_from_checkout_subscription(
            session, checkout, subscription, OrderBillingReason.subscription_create
        )

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.subscription_create
        assert order.customer == checkout.customer
        assert order.product == product_recurring_metered
        assert len(order.items) == len(
            [p for p in product_recurring_metered.prices if is_static_price(p)]
        )


@pytest.mark.asyncio
class TestCreateSubscriptionOrderWithStripe:
    async def test_no_pending_billing_items(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        with pytest.raises(NoPendingBillingEntries):
            await order_service.create_subscription_order(
                session, subscription, OrderBillingReason.subscription_cycle
            )

    async def test_cycle_fixed_price(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        billing_entry = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        assert len(order.items) == 1
        order_item = order.items[0]
        assert order_item.product_price == price
        assert order_item.amount == billing_entry.amount
        assert order_item.order == order

        assert order.subtotal_amount == billing_entry.amount
        assert order.status == OrderStatus.pending
        assert order.billing_reason == OrderBillingReason.subscription_cycle
        assert order.subscription == subscription

        assert order.tax_amount == calculate_tax_mock.return_value["amount"]
        assert (
            order.tax_calculation_processor_id
            == calculate_tax_mock.return_value["processor_id"]
        )
        assert (
            order.taxability_reason
            == calculate_tax_mock.return_value["taxability_reason"]
        )
        assert order.tax_rate == calculate_tax_mock.return_value["tax_rate"]
        assert order.tax_transaction_processor_id is None

        enqueue_job_mock.assert_any_call(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=subscription.payment_method_id,
        )

    async def test_cycle_discount(
        self,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5000,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        assert order.discount == discount
        assert order.discount_amount == price.price_amount / 2
        assert order.net_amount == order.subtotal_amount - order.discount_amount

        calculate_tax_mock.assert_called_once_with(
            order.id,
            subscription.currency,
            order.net_amount,
            product.stripe_product_id,
            customer.billing_address,
            [],
            False,
        )

    async def test_cycle_free_order(
        self,
        enqueue_job_mock: MagicMock,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10000,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        calculate_tax_mock.return_value = {
            "processor_id": "TAX_PROCESSOR_ID",
            "amount": 0,
            "taxability_reason": TaxabilityReason.not_subject_to_tax,
            "tax_rate": {},
        }

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        assert order.net_amount == 0
        assert order.status == OrderStatus.paid

        enqueued_jobs = [call[0][0] for call in enqueue_job_mock.call_args_list]
        assert "order.trigger_payment" not in enqueued_jobs

    async def test_cycle_tax_exempted(
        self,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, tax_exempted=True
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        calculate_tax_mock.return_value = {
            "processor_id": "TAX_PROCESSOR_ID",
            "amount": 0,
            "taxability_reason": TaxabilityReason.not_subject_to_tax,
            "tax_rate": {},
        }

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        calculate_tax_mock.assert_called_once_with(
            order.id,
            subscription.currency,
            order.subtotal_amount,
            product.stripe_product_id,
            customer.billing_address,
            [],
            True,
        )

    async def test_cycle_proration_discount(
        self,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5000,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            customer=subscription.customer,
            product_price=price,
            amount=500,
            currency=price.price_currency,
            subscription=subscription,
        )
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        assert order.subtotal_amount == price.price_amount + 500
        assert order.discount == discount
        assert order.discount_amount == price.price_amount / 2
        assert order.net_amount == order.subtotal_amount - order.discount_amount

        calculate_tax_mock.assert_called_once_with(
            order.id,
            subscription.currency,
            order.net_amount,
            product.stripe_product_id,
            customer.billing_address,
            [],
            False,
        )


class DiscountFixture(TypedDict):
    type: DiscountType
    duration: DiscountDuration
    basis_points: int
    duration_in_months: int
    applies_to: list[str] | None


class ProrationFixture(TypedDict):
    discount: DiscountFixture | None
    products: dict[str, tuple[SubscriptionRecurringInterval, int]]
    history: list[
        tuple[
            str,
            BillingEntryType,
            tuple[BillingEntryDirection, int, int],
            datetime,
            datetime,
        ]
    ]
    expected_discount: int
    expected_subtotal: int
    expected_tax: int


@pytest.mark.asyncio
class TestCreateSubscriptionOrder:
    @pytest.fixture
    def calculate_tax_mock(self, mocker: MockerFixture) -> AsyncMock:
        mock = AsyncMock(spec=calculate_tax)
        mocker.patch("polar.order.service.calculate_tax", new=mock)

        def mocked_calculate_tax(
            identifier: uuid.UUID,
            currency: str,
            amount: int,
            stripe_product_id: str,
            address: Address,
            tax_ids: list[TaxID],
            tax_exempted: bool,
        ) -> TaxCalculation:
            return {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": polar_round(amount * 0.20),
                "taxability_reason": TaxabilityReason.standard_rated,
                "tax_rate": None,
            }

        mock.side_effect = mocked_calculate_tax

        return mock

    @pytest_asyncio.fixture
    async def subscription(
        self, save_fixture: SaveFixture, organization: Organization, product: Product
    ) -> Subscription:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("DK")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        return subscription

    async def test_cycle_proration(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        enqueue_job_mock_billing_entry: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(500,)],
        )
        old_price = cast(ProductPriceFixed, old_product.prices[0])
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(3000,)],
        )
        new_price = cast(ProductPriceFixed, new_product.prices[0])

        billing_entry_credit = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.credit,
            start_timestamp=datetime(2025, 6, 1, tzinfo=UTC),
            end_timestamp=datetime(2025, 6, 16, tzinfo=UTC),
            customer=subscription.customer,
            product_price=old_price,
            amount=round(old_price.price_amount * 0.5),  # 250
            currency=old_price.price_currency,
            subscription=subscription,
        )
        billing_entry_debit = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.debit,
            start_timestamp=datetime(2025, 6, 16, tzinfo=UTC),
            end_timestamp=datetime(2025, 7, 1, tzinfo=UTC),
            customer=subscription.customer,
            product_price=new_price,
            amount=round(new_price.price_amount * 0.5),  # 1500
            currency=new_price.price_currency,
            subscription=subscription,
        )
        billing_entry_cycle = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            direction=BillingEntryDirection.debit,
            start_timestamp=datetime(2025, 7, 1, tzinfo=UTC),
            end_timestamp=datetime(2025, 8, 1, tzinfo=UTC),
            customer=subscription.customer,
            product_price=new_price,
            amount=new_price.price_amount,  # 3000
            currency=new_price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        assert len(order.items) == 3
        order_items = sorted(order.items, key=lambda i: i.amount)
        assert order_items[0].product_price == old_price
        assert order_items[0].amount == -250
        assert order_items[1].product_price == new_price
        assert order_items[1].amount == 1500
        assert order_items[2].product_price == new_price
        assert order_items[2].amount == 3000

        assert order.status == OrderStatus.pending
        assert order.billing_reason == OrderBillingReason.subscription_cycle
        assert order.subscription == subscription

        assert order.subtotal_amount == 4250
        assert order.tax_amount == 850
        assert order.tax_calculation_processor_id == "TAX_PROCESSOR_ID"
        assert order.taxability_reason == TaxabilityReason.standard_rated
        # assert order.tax_rate == calculate_tax_mock.return_value["tax_rate"]
        assert order.tax_transaction_processor_id is None

        assert_set_order_item_ids(
            enqueue_job_mock_billing_entry,
            [
                billing_entry_credit.id,
                billing_entry_debit.id,
                billing_entry_cycle.id,
            ],
            [o.id for o in order_items],
        )

        enqueue_job_mock.assert_any_call(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=subscription.payment_method_id,
        )

    @pytest.mark.parametrize(
        "setup",
        [
            pytest.param(
                # 25% off every month for 3 months
                # Switch from Basic to Pro middle of month
                {
                    "discount": {
                        # 25% off on Basic
                        "type": DiscountType.percentage,
                        "basis_points": 2500,
                        "duration": DiscountDuration.repeating,
                        "duration_in_months": 3,
                        "applies_to": ["p-basic"],
                    },
                    "products": {
                        "p-basic": (SubscriptionRecurringInterval.month, 3000),
                        "p-pro": (SubscriptionRecurringInterval.month, 9000),
                    },
                    "history": [
                        (
                            "p-basic",
                            # 3000 x 50% (half a month), discount: (100 - 25)% x 1500 = 375
                            # (BillingEntryDirection.credit, 1125),
                            # BillingEntries don't include discounts
                            BillingEntryType.proration,
                            # INCLUDES discount
                            (BillingEntryDirection.credit, 1125, 375),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2026, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.proration,
                            # 9000 x 50% (half a month) discount: (100 - 25)% x 4500 = 1125
                            # INCLUDES discount
                            (BillingEntryDirection.debit, 3375, 1125),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2025, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.cycle,
                            # EXCLUDES discount
                            (BillingEntryDirection.debit, 9000, 1800),
                            datetime(2025, 10, 1, tzinfo=UTC),
                            datetime(2025, 11, 1, tzinfo=UTC),
                        ),
                    ],
                    "expected_discount": 0 + 2250,
                    # (4500 - 1125) - (1500 - 375) = 2250
                    "expected_subtotal": 2250 + 9000,
                    # Tax: 2250 x 20% = 450 ; (9000 - 2250) x 25% = 1440
                    "expected_tax": 450 + 1350,
                },
                id="discount-applies-only-to-first-product",
            ),
            pytest.param(
                # $10 off every month for 3 months
                # Switch from Basic to Pro middle of month
                {
                    "discount": {
                        "type": DiscountType.fixed,
                        "amount": 1000,
                        "currency": "usd",
                        "duration": DiscountDuration.repeating,
                        "duration_in_months": 3,
                        "applies_to": ["p-basic"],
                    },
                    "products": {
                        "p-basic": (SubscriptionRecurringInterval.month, 3000),
                        "p-pro": (SubscriptionRecurringInterval.month, 9000),
                    },
                    "history": [
                        # Discounts aren't applied on the BillingEntry, but they are applied to the OrderItem
                        (
                            "p-basic",
                            BillingEntryType.proration,
                            # 3000 x 50% (half a month)
                            # INCLUDES discount
                            (BillingEntryDirection.credit, 500, 1000),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2026, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.proration,
                            # 9000 x 50% (half a month)
                            # INCLUDES discount
                            (BillingEntryDirection.debit, 2750, 1750),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2025, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.cycle,
                            # EXCLUDES discount
                            (BillingEntryDirection.debit, 9000, 1000),
                            datetime(2025, 10, 1, tzinfo=UTC),
                            datetime(2025, 11, 1, tzinfo=UTC),
                        ),
                    ],
                    "expected_discount": 1000,
                    # (4500 - 1750) - (1500 - 1000) = 2250
                    "expected_subtotal": 2250 + 9000,
                    "expected_tax": 450 + 1600,  # 2250 x 20% = 450 ; 8000 x 20% = 1600
                    # You paid 2000 for the month. Now you get 1000 back (50% the month).
                },
                id="fixed-discount-on-first-product",
            ),
            pytest.param(
                # Switch from yearly to monthly after 3 months and 1 day
                {
                    "discount": {
                        "type": DiscountType.percentage,
                        "basis_points": 5000,
                        "duration": DiscountDuration.forever,
                    },
                    "products": {
                        "p-monthly": (SubscriptionRecurringInterval.month, 3000),
                        "p-yearly": (SubscriptionRecurringInterval.year, 30000),
                    },
                    "history": [
                        (
                            "p-yearly",
                            BillingEntryType.proration,
                            # INCLUDES discount
                            # 30000 * 50% * (365 - 30 - 31 - 31) / 365 = 11219
                            (BillingEntryDirection.credit, 11219, 11219),
                            datetime(2025, 6, 1, tzinfo=UTC),
                            datetime(2025, 9, 1, tzinfo=UTC),
                        ),
                        (
                            "p-monthly",
                            BillingEntryType.cycle,
                            # EXCLUDES discount
                            (BillingEntryDirection.debit, 3000, 1500),
                            datetime(2025, 9, 1, tzinfo=UTC),
                            datetime(2025, 10, 1, tzinfo=UTC),
                        ),
                    ],
                    "expected_discount": 1500,
                    "expected_subtotal": -11219 + 3000,
                    "expected_tax": -1944,  # (-11219 + 3000 - 1500) * 20%
                },
                id="yearly-to-monthly",
            ),
        ],
    )
    async def test_cycle_proration_discount(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        enqueue_job_mock_billing_entry: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        subscription: Subscription,
        setup: ProrationFixture,
    ) -> None:
        products = {}
        prices = {}
        for key, (recurring_interval, price_amount) in setup["products"].items():
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=recurring_interval,
                prices=[(price_amount,)],
            )
            products[key] = product

            price = cast(ProductPriceFixed, product.prices[0])
            prices[key] = price

        entries = []
        for product_key, type, (
            dir,
            amount,
            discount_amount,
        ), start_dt, end_dt in setup["history"]:
            price = prices[product_key]
            entry = await create_billing_entry(
                save_fixture,
                type=type,
                direction=dir,
                start_timestamp=start_dt,
                end_timestamp=end_dt,
                customer=subscription.customer,
                product_price=price,
                amount=amount,
                discount_amount=discount_amount,
                currency=price.price_currency,
                subscription=subscription,
            )
            entries.append(entry)

        if setup["discount"]:
            discount = await create_discount(
                save_fixture,
                type=setup["discount"]["type"],
                amount=setup["discount"].get("amount"),
                currency=setup["discount"].get("currency"),
                basis_points=setup["discount"].get("basis_points"),
                duration=setup["discount"]["duration"],
                duration_in_months=setup["discount"].get("duration_in_months"),
                organization=organization,
                products=[products[key] for key in setup["discount"]["applies_to"]]  # type: ignore
                if setup["discount"].get("applies_to")
                else None,
            )
            subscription.discount = discount
            session.add(subscription)
            await session.flush()

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReason.subscription_cycle
        )

        assert len(order.items) == len(setup["history"])
        assert order.discount_amount == setup["expected_discount"]
        assert order.subtotal_amount == setup["expected_subtotal"]
        assert order.tax_amount == setup["expected_tax"]
        # order_items = sorted(order.items, key=lambda i: i.amount)
        # assert order_items[0].product_price == old_price
        # assert order_items[0].amount == -250
        # assert order_items[1].product_price == new_price
        # assert order_items[1].amount == 1500
        # assert order_items[2].product_price == new_price
        # assert order_items[2].amount == 3000

        if order.subtotal_amount < 0:
            assert order.status == OrderStatus.paid
            assert order.tax_calculation_processor_id is None
            assert order.taxability_reason == TaxabilityReason.standard_rated
            # assert order.tax_rate == calculate_tax_mock.return_value["tax_rate"]
            assert order.tax_transaction_processor_id is None
        else:
            assert order.status == OrderStatus.pending
            assert order.tax_calculation_processor_id == "TAX_PROCESSOR_ID"
            assert order.taxability_reason == TaxabilityReason.standard_rated
            # assert order.tax_rate == calculate_tax_mock.return_value["tax_rate"]
            assert order.tax_transaction_processor_id is None

        assert order.billing_reason == OrderBillingReason.subscription_cycle
        assert order.subscription == subscription

        # assert order_ids == set([oi.id for oi in order.items])
        assert_set_order_item_ids(
            enqueue_job_mock_billing_entry,
            [e.id for e in entries],
            [oi.id for oi in order.items],
        )

        customer_balance = await order_service.customer_balance(session, customer)
        if order.subtotal_amount >= 0:
            enqueue_job_mock.assert_any_call(
                "order.trigger_payment",
                order_id=order.id,
                payment_method_id=subscription.payment_method_id,
            )
            assert customer_balance == 0
        else:
            assert (
                customer_balance
                == setup["expected_subtotal"]
                - setup["expected_discount"]
                + setup["expected_tax"]
            )

    @pytest.mark.parametrize(
        "billing_reason",
        [
            OrderBillingReason.subscription_cycle,
            OrderBillingReason.subscription_update,
        ],
    )
    async def test_metered(
        self,
        billing_reason: OrderBillingReason,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        subscription_service_mock = mocker.patch(
            "polar.order.service.subscription_service", spec=SubscriptionService
        )

        subscription = await create_active_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )

        event = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
        )
        await save_fixture(
            BillingEntry.from_metered_event(
                customer, subscription.subscription_product_prices[0], event
            )
        )

        order = await order_service.create_subscription_order(
            session, subscription, billing_reason
        )

        assert len(order.items) == 1
        assert order.subtotal_amount == 100

        subscription_service_mock.reset_meters.assert_awaited_once_with(
            session, subscription
        )


@pytest.mark.asyncio
class TestCreateOrderFromStripe:
    async def test_not_order_invoice(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(
            lines=[], metadata={"type": ProductType.pledge}
        )
        with pytest.raises(NotAnOrderInvoice):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_not_subscription_invoice(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(lines=[], subscription_id=None)
        with pytest.raises(NotASubscriptionInvoice):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(lines=[])
        with pytest.raises(SubscriptionDoesNotExist):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_basic(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )

        order = await order_service.create_order_from_stripe(session, invoice)

        assert order.net_amount == invoice.total
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.subscription == subscription
        assert order.customer.stripe_customer_id == invoice.customer
        assert order.billing_reason == invoice.billing_reason
        assert order.created_at == created_datetime

    async def test_discount(
        self,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
        discount_fixed_once: Discount,
    ) -> None:
        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            customer_id=cast(str, subscription.customer.stripe_customer_id),
            discount_amount=cast(DiscountFixed, discount_fixed_once).amount,
            discount=discount_fixed_once,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.discount_amount == cast(DiscountFixed, discount_fixed_once).amount
        assert order.net_amount == invoice.total
        assert order.discount == discount_fixed_once

    @pytest.mark.parametrize(
        "customer_address",
        [
            None,
            {"country": None},
        ],
    )
    async def test_no_billing_address(
        self,
        customer_address: dict[str, Any] | None,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        product: Product,
        subscription: Subscription,
    ) -> None:
        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {"id": "CHARGE_ID", "payment_method_details": None},
            key=None,
        )

        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            customer_address=customer_address,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)
        assert order.billing_address is None

    @pytest.mark.parametrize(
        "customer_address",
        [
            {"country": "US", "state": "NY"},
            {"country": "CA", "state": "QC"},
        ],
    )
    async def test_state_normalization(
        self,
        customer_address: dict[str, str],
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        product: Product,
        subscription: Subscription,
    ) -> None:
        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            customer_address=customer_address,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)
        assert order.billing_address is not None
        assert order.billing_address.country == customer_address["country"]
        assert (
            order.billing_address.state
            == f"{customer_address['country']}-{customer_address['state']}"
        )

    async def test_billing_address_from_payment_method(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
    ) -> None:
        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {
                "id": "CHARGE_ID",
                "payment_method_details": {
                    "card": {
                        "country": "US",
                    }
                },
            },
            key=None,
        )

        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            customer_address=None,
            billing_reason="manual",
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)
        assert order.billing_address == Address(country="US")  # type: ignore

    async def test_checkout(
        self,
        publish_checkout_event_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], status=CheckoutStatus.succeeded
        )
        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            customer_id=cast(str, subscription.customer.stripe_customer_id),
            subscription_details={
                "metadata": {"checkout_id": str(checkout.id)},
            },
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.checkout == checkout

        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_tax(
        self,
        stripe_service_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            amount_paid=100,
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 1,
                }
                for price in product.prices
                if is_static_price(price)
            ],
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )

        order = await order_service.create_order_from_stripe(session, invoice)

        assert order.tax_amount == 1
        assert order.tax_rate is not None
        assert order.taxability_reason == TaxabilityReason.standard_rated


@pytest.mark.asyncio
class TestUpdateOrderFromStripe:
    async def test_not_existing(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(lines=[])
        with pytest.raises(OrderDoesNotExist):
            await order_service.update_order_from_stripe(session, invoice=invoice)

    async def test_paid_charge(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        invoice = construct_stripe_invoice(status="paid", lines=[])
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id=invoice.id,
        )

        updated_order = await order_service.update_order_from_stripe(
            session, invoice=invoice
        )
        assert updated_order.status == OrderStatus.paid

    async def test_paid_out_of_band(
        self,
        stripe_service_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        payment_intent = build_stripe_payment_intent(amount=1000)
        stripe_service_mock.get_payment_intent.return_value = payment_intent

        invoice = construct_stripe_invoice(
            status="paid", lines=[], metadata={"payment_intent_id": payment_intent.id}
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id=invoice.id,
        )

        updated_order = await order_service.update_order_from_stripe(
            session, invoice=invoice
        )
        assert updated_order.status == OrderStatus.paid


@pytest.mark.asyncio
class TestCreateOrderBalance:
    async def test_no_payment_transaction(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        with pytest.raises(PaymentTransactionForChargeDoesNotExist):
            await order_service.create_order_balance(session, order, "CHARGE_ID")

    async def test_no_account(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment, charge_id="CHARGE_ID"
        )

        await order_service.create_order_balance(session, order, "CHARGE_ID")

        held_balance = await held_balance_service.get_by(
            session, organization_id=product.organization_id
        )
        assert held_balance is not None
        assert held_balance.order_id == order.id

        updated_payment_transaction = await payment_transaction_service.get(
            session,
            id=payment_transaction.id,
            options=(joinedload(Transaction.payment_customer),),
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order == order
        assert updated_payment_transaction.payment_customer == order.customer

    async def test_with_account(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        organization_account: Account,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment, charge_id="CHARGE_ID"
        )

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge"
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-order.net_amount),
            Transaction(
                type=TransactionType.balance,
                amount=order.net_amount,
                account=organization_account,
            ),
        )

        platform_fee_transaction_service_mock = mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )
        platform_fee_transaction_service_mock.create_fees_reversal_balances.return_value = [
            (
                Transaction(
                    type=TransactionType.balance,
                    amount=-100,
                    platform_fee_type=PlatformFeeType.payment,
                ),
                Transaction(
                    type=TransactionType.balance,
                    amount=100,
                    platform_fee_type=PlatformFeeType.payment,
                    account=organization_account,
                ),
            ),
            (
                Transaction(
                    type=TransactionType.balance,
                    amount=-50,
                    platform_fee_type=PlatformFeeType.payment,
                ),
                Transaction(
                    type=TransactionType.balance,
                    amount=50,
                    platform_fee_type=PlatformFeeType.payment,
                    account=organization_account,
                ),
            ),
        ]

        await order_service.create_order_balance(session, order, "CHARGE_ID")

        assert create_balance_from_charge_mock.mock_calls[0] == call(
            ANY,
            source_account=None,
            destination_account=organization_account,
            charge_id="CHARGE_ID",
            amount=payment_transaction.amount,
            order=order,
        )

        create_balance_from_charge_mock.assert_awaited_once_with(
            ANY,
            source_account=None,
            destination_account=organization_account,
            charge_id="CHARGE_ID",
            amount=payment_transaction.amount,
            order=order,
        )

        platform_fee_transaction_service_mock.create_fees_reversal_balances.assert_called_once()
        assert order.platform_fee_amount == 150

        updated_payment_transaction = await payment_transaction_service.get(
            session,
            id=payment_transaction.id,
            options=(joinedload(Transaction.payment_customer),),
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order == order
        assert updated_payment_transaction.payment_customer == order.customer


@pytest.mark.asyncio
async def test_send_confirmation_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
    organization: Organization,
) -> None:
    order = await create_order(save_fixture, product=product, customer=customer)

    await order_service.send_confirmation_email(session, organization, order)


@pytest.mark.asyncio
class TestHandlePayment:
    async def test_order_not_pending(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create an order that is already paid
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
            stripe_invoice_id=None,
        )

        with pytest.raises(OrderNotPending):
            await order_service.handle_payment(session, order, None)

    async def test_full_case_with_payment_and_tax(
        self,
        stripe_service_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Create a pending order with tax calculation processor ID
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        # Set tax_calculation_processor_id
        order.tax_calculation_processor_id = "tax_calc_123"
        await save_fixture(order)

        # Create a payment
        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_123",
        )

        # Mock stripe tax transaction creation
        mock_tax_transaction = MagicMock()
        mock_tax_transaction.id = "tax_txn_456"
        stripe_service_mock.create_tax_transaction.return_value = mock_tax_transaction

        # Call handle_payment
        updated_order = await order_service.handle_payment(session, order, payment)

        # Verify order status is updated to paid
        assert updated_order.status == OrderStatus.paid
        assert updated_order.tax_transaction_processor_id == "tax_txn_456"

        # Verify enqueue_job was called to balance the order
        enqueue_job_mock.assert_called_once_with(
            "order.balance", order_id=order.id, charge_id="stripe_payment_123"
        )

        # Verify stripe tax transaction was created
        stripe_service_mock.create_tax_transaction.assert_called_once_with(
            "tax_calc_123", str(order.id)
        )

    async def test_stripe_order_not_pending(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Create a Stripe order that is already paid
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
        )

        # Create a payment
        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_123",
        )

        await order_service.handle_payment(session, order, payment)

        # Verify enqueue_job was called to balance the order
        enqueue_job_mock.assert_called_once_with(
            "order.balance", order_id=order.id, charge_id="stripe_payment_123"
        )


@pytest.mark.asyncio
class TestHandlePaymentFailure:
    """Test order service handle payment failure functionality"""

    @freeze_time("2024-01-01 12:00:00")
    async def test_subscription_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service handles payment failure for subscription orders"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_mark_past_due.return_value = subscription

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_called_once_with(session, subscription)

    @freeze_time("2024-01-01 12:00:00")
    async def test_ignores_payment_failure_for_already_paid_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that payment failure is ignored for orders that are already paid"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.paid,  # Order is already paid
        )
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None  # No retry scheduled
        assert result_order.status == OrderStatus.paid  # Status unchanged
        mock_mark_past_due.assert_not_called()  # Subscription not marked past_due

    async def test_stripe_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service skips dunning for stripe subscription orders"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        order.subscription.stripe_subscription_id = "sub_stripe_123"
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None

        mock_mark_past_due.assert_not_called()

    async def test_non_subscription_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service skips dunning for non-subscription orders"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None

        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_consecutive_first_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service schedules first retry after one failed payment"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Create one failed payment for this order
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            order=order,
        )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        # Should schedule second retry (5 days from now, as per DUNNING_RETRY_INTERVALS[1])
        expected_retry_date = utc_now() + timedelta(days=5)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_consecutive_second_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service schedules second retry after two failed payments"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Create two failed payments for this order
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            order=order,
        )
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            order=order,
        )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        # Should schedule third retry (7 days from now, as per DUNNING_RETRY_INTERVALS[2])
        expected_retry_date = utc_now() + timedelta(days=7)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_final_attempt_cancels_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service cancels subscription after final retry attempt"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Create 4 failed payments for this order (equal to DUNNING_RETRY_INTERVALS length)
        for _ in range(4):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                order=order,
            )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_called_once_with(session, subscription)
        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_final_attempt_canceled_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service cancels subscription after final retry attempt"""
        # Given
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
            revoke=True,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Create 4 failed payments for this order (equal to DUNNING_RETRY_INTERVALS length)
        for _ in range(4):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                order=order,
            )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_not_called()
        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_only_failed_payments_counted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service only counts failed payments, not successful ones"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=None,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Create one failed payment and one successful payment for this order
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            order=order,
        )
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.succeeded,
            order=order,
        )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        # Should schedule second retry (5 days) since only 1 failed payment exists
        expected_retry_date = utc_now() + timedelta(days=5)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_not_called()


@pytest.mark.asyncio
class TestProcessDunningOrder:
    """Test order service process dunning order functionality"""

    async def test_process_dunning_order_no_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test that process_dunning_order logs warning for orders without subscription"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )

        # When
        await order_service.process_dunning_order(session, order)

        # Then
        assert "Order has no subscription, skipping dunning" in caplog.text

    async def test_process_dunning_order_cancelled_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test that process_dunning_order removes retry date for cancelled subscriptions"""
        # Given - create a subscription and manually set it to canceled status
        subscription = await create_canceled_subscription(
            save_fixture,
            customer=customer,
            product=product,
        )
        subscription.status = SubscriptionStatus.canceled
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method = payment_method
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() + timedelta(days=1)
        await save_fixture(order)

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        assert order.next_payment_attempt_at is None

    async def test_process_dunning_order_no_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test that process_dunning_order logs warning for subscriptions without payment method"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        subscription.payment_method_id = None
        await save_fixture(subscription)

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        assert (
            "Order subscription has no payment method, skipping dunning" in caplog.text
        )

    async def test_process_dunning_order_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        enqueue_job_mock: MagicMock,
    ) -> None:
        """Test that process_dunning_order successfully enqueues payment retry"""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method_id = payment_method.id

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        enqueue_job_mock.assert_called_once_with(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=payment_method.id,
        )


@pytest.mark.asyncio
class TestTriggerPayment:
    """Test payment lock mechanism in trigger_payment service method."""

    async def test_trigger_payment_when_already_locked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that trigger_payment raises PaymentAlreadyInProgress when order is already locked."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.payment_lock_acquired_at = utc_now()
        await save_fixture(order)

        # When/Then
        with pytest.raises(PaymentAlreadyInProgress):
            await order_service.trigger_payment(session, order, payment_method)

    async def test_trigger_payment_acquires_lock_successfully(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that trigger_payment acquires lock and processes payment normally."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # When
        await order_service.trigger_payment(session, order, payment_method)

        # Then
        stripe_service_mock.create_payment_intent.assert_called_once()

        await session.refresh(order)
        assert order.payment_lock_acquired_at is not None

    async def test_trigger_payment_releases_lock_on_failure(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that lock is released when payment processing fails."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        stripe_service_mock.create_payment_intent.side_effect = Exception(
            "Payment failed"
        )

        # When/Then
        with pytest.raises(Exception, match="Payment failed"):
            await order_service.trigger_payment(session, order, payment_method)

        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_trigger_payment_card_error_raises_card_payment_failed(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # Mock Stripe service to raise CardError
        card_error = stripe_lib.CardError(
            message="Your card was declined.",
            param="card",
            code="card_declined",
        )
        stripe_service_mock.create_payment_intent.side_effect = card_error

        # When/Then
        with pytest.raises(CardPaymentFailed) as exc_info:
            await order_service.trigger_payment(session, order, payment_method)

        # Verify the exception details
        assert exc_info.value.order == order
        assert exc_info.value.stripe_error == card_error
        assert "Your card was declined." in str(exc_info.value)

        # Verify lock is released on failure
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_trigger_payment_other_stripe_errors_not_converted(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # Mock Stripe service to raise APIConnectionError
        api_error = stripe_lib.APIConnectionError("Network connection failed")
        stripe_service_mock.create_payment_intent.side_effect = api_error

        # When/Then - should raise the original exception, not CardPaymentFailed
        with pytest.raises(stripe_lib.APIConnectionError) as exc_info:
            await order_service.trigger_payment(session, order, payment_method)

        assert str(exc_info.value) == "Network connection failed"

        # Verify lock is released on failure
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None


@pytest.mark.asyncio
class TestAcquirePaymentLock:
    async def test_acquire_payment_lock_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test successful payment lock acquisition."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        async with order_service.acquire_payment_lock(session, order):
            await session.refresh(order)
            assert order.payment_lock_acquired_at is not None

        # Lock should be released after context
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_acquire_payment_lock_already_acquired(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test acquiring lock when already acquired raises exception."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.payment_lock_acquired_at = utc_now()
        await save_fixture(order)

        with pytest.raises(PaymentAlreadyInProgress):
            async with order_service.acquire_payment_lock(session, order):
                pass

    async def test_acquire_payment_lock_release_on_exception(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test lock is released when exception occurs in context."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        with pytest.raises(ValueError):
            async with order_service.acquire_payment_lock(session, order):
                await session.refresh(order)
                assert order.payment_lock_acquired_at is not None
                raise ValueError("Test exception")

        # Lock should be released after exception
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_acquire_payment_lock_no_release_on_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test lock can be kept after successful context when release_on_success=False."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        async with order_service.acquire_payment_lock(
            session, order, release_on_success=False
        ):
            await session.refresh(order)
            assert order.payment_lock_acquired_at is not None

        await session.refresh(order)
        assert order.payment_lock_acquired_at is not None


@pytest.mark.asyncio
class TestProcessRetryPayment:
    async def test_process_retry_payment_success(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test successful retry payment processing."""
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "succeeded"
        mock_payment_intent.client_secret = None
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "succeeded"
        assert result.client_secret is None
        assert result.error is None

        stripe_service_mock.create_payment_intent.assert_called_once()

    async def test_process_retry_payment_requires_action(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test retry payment requiring additional action."""
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "requires_action"
        mock_payment_intent.client_secret = "pi_test_client_secret"
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "requires_action"
        assert result.client_secret == "pi_test_client_secret"
        assert result.error is None

    async def test_process_retry_payment_failed(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test failed retry payment."""
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "failed"
        mock_payment_intent.client_secret = None
        mock_payment_intent.last_payment_error = MagicMock()
        mock_payment_intent.last_payment_error.message = "Card was declined."
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "failed"
        assert result.client_secret is None
        assert result.error == "Card was declined."

    async def test_process_retry_payment_stripe_error(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test retry payment with Stripe error."""
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )
        await save_fixture(order)

        mock_error = MagicMock()
        mock_error.message = "Payment method not available."
        stripe_error = stripe_lib.StripeError("Payment method not available.")
        stripe_error.error = mock_error
        stripe_service_mock.create_payment_intent = AsyncMock(side_effect=stripe_error)

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "failed"
        assert result.client_secret is None
        assert result.error == "Payment method not available."

    async def test_process_retry_payment_order_not_pending(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment with non-pending order."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,  # Not pending
        )
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_no_next_attempt(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment with no next payment attempt scheduled."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            next_payment_attempt_at=None,  # No retry scheduled
        )
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_no_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment with no subscription."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            next_payment_attempt_at=utc_now(),
            subscription=None,  # No subscription
        )
        await save_fixture(order)

        from polar.order.service import OrderNotEligibleForRetry

        with pytest.raises(OrderNotEligibleForRetry):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_already_in_progress(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment when payment already in progress."""
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
            payment_lock_acquired_at=utc_now(),  # Lock already acquired
        )
        await save_fixture(order)

        with pytest.raises(PaymentAlreadyInProgress):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )
