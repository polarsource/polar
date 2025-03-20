from datetime import datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import ANY, AsyncMock, MagicMock, call

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.models import (
    Account,
    Customer,
    Discount,
    Product,
    ProductPriceFixed,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountFixed
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.organization import Organization
from polar.models.product import ProductBillingType
from polar.models.transaction import TransactionType
from polar.order.service import (
    MissingCheckoutCustomer,
    MissingStripeCustomerID,
    NotAnOrderInvoice,
    NotASubscriptionInvoice,
    OrderDoesNotExist,
    RecurringProduct,
    SubscriptionDoesNotExist,
)
from polar.order.service import order as order_service
from polar.transaction.service.balance import (
    PaymentTransactionForChargeDoesNotExist,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.platform_fee import PlatformFeeTransactionService
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.email import WatcherEmailRenderer, watch_email
from tests.fixtures.random_objects import (
    create_checkout,
    create_customer,
    create_order,
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

    return mock


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.order.service.enqueue_job")


@pytest.fixture
def publish_checkout_event_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.order.service.publish_checkout_event")


@pytest.fixture
def event_creation_time() -> tuple[datetime, int]:
    created_datetime = datetime.fromisoformat("2024-01-01T00:00:00Z")
    created_unix_timestamp = int(created_datetime.timestamp())
    return created_datetime, created_unix_timestamp


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


@pytest.mark.asyncio
class TestCreateFromCheckout:
    async def test_recurring_product(
        self, save_fixture: SaveFixture, session: AsyncSession, product: Product
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], status=CheckoutStatus.confirmed
        )
        with pytest.raises(RecurringProduct):
            await order_service.create_from_checkout(session, checkout, None)

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
            await order_service.create_from_checkout(session, checkout, None)

    async def test_missing_customer_stripe_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=product_one_time.organization,
            stripe_customer_id=None,
        )
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )
        with pytest.raises(MissingStripeCustomerID):
            await order_service.create_from_checkout(session, checkout, None)

    async def test_fixed(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        stripe_invoice = construct_stripe_invoice(
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product_one_time.prices
            ]
        )
        stripe_service_mock.create_out_of_band_invoice.return_value = (
            stripe_invoice,
            {
                price.stripe_price_id: line
                for price, line in zip(product_one_time.prices, stripe_invoice.lines)
            },
        )

        payment_intent = build_stripe_payment_intent(amount=checkout.total_amount or 0)

        order = await order_service.create_from_checkout(
            session, checkout, payment_intent
        )

        assert order.net_amount == checkout.subtotal_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time
        assert len(order.items) == len(product_one_time.prices)

        stripe_service_mock.create_out_of_band_invoice.assert_called_once_with(
            customer=customer.stripe_customer_id,
            currency=checkout.currency,
            prices=[price.stripe_price_id for price in product_one_time.prices],
            coupon=None,
            automatic_tax=True,
            metadata=ANY,
        )

        enqueue_job_mock.assert_any_call(
            "order.balance", order_id=order.id, charge_id="CHARGE_ID"
        )
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
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_custom_price: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_custom_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
            amount=4242,
            currency="usd",
        )

        stripe_service_mock.create_ad_hoc_custom_price.return_value = SimpleNamespace(
            id="STRIPE_CUSTOM_PRICE_ID"
        )
        stripe_invoice = construct_stripe_invoice(
            lines=[
                {
                    "price_id": "STRIPE_CUSTOM_PRICE_ID",
                    "amount": 4242,
                    "tax_amount": 0,
                }
                for price in product_one_time_custom_price.prices
            ]
        )
        stripe_service_mock.create_out_of_band_invoice.return_value = (
            stripe_invoice,
            {
                price: line
                for price, line in zip(["STRIPE_CUSTOM_PRICE_ID"], stripe_invoice.lines)
            },
        )

        payment_intent = build_stripe_payment_intent(amount=checkout.total_amount or 0)

        order = await order_service.create_from_checkout(
            session, checkout, payment_intent
        )

        assert order.net_amount == checkout.subtotal_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_custom_price
        assert len(order.items) == len(product_one_time_custom_price.prices)

        stripe_service_mock.create_out_of_band_invoice.assert_called_once_with(
            customer=customer.stripe_customer_id,
            currency=checkout.currency,
            prices=["STRIPE_CUSTOM_PRICE_ID"],
            coupon=None,
            automatic_tax=True,
            metadata=ANY,
        )

        enqueue_job_mock.assert_any_call(
            "order.balance", order_id=order.id, charge_id="CHARGE_ID"
        )
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
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_free_price: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_free_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        stripe_invoice = construct_stripe_invoice(
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": 0,
                    "tax_amount": 0,
                }
                for price in product_one_time_free_price.prices
            ]
        )
        stripe_service_mock.create_out_of_band_invoice.return_value = (
            stripe_invoice,
            {
                price.stripe_price_id: line
                for price, line in zip(
                    product_one_time_free_price.prices, stripe_invoice.lines
                )
            },
        )

        order = await order_service.create_from_checkout(session, checkout, None)

        assert order.net_amount == 0
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_free_price
        assert len(order.items) == len(product_one_time_free_price.prices)

        stripe_service_mock.create_out_of_band_invoice.assert_called_once_with(
            customer=customer.stripe_customer_id,
            currency="usd",
            prices=[
                price.stripe_price_id for price in product_one_time_free_price.prices
            ],
            coupon=None,
            automatic_tax=False,
            metadata=ANY,
        )

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
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        discount_percentage_100: Discount,
        customer: Customer,
        stripe_service_mock: MagicMock,
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
        stripe_invoice = construct_stripe_invoice(
            lines=[
                {
                    "price_id": price.stripe_price_id,
                    "amount": cast(ProductPriceFixed, price).price_amount,
                    "tax_amount": 0,
                }
                for price in product_one_time.prices
            ],
            discount=discount_percentage_100,
            discount_amount=discount_amount,
        )
        stripe_service_mock.create_out_of_band_invoice.return_value = (
            stripe_invoice,
            {
                price.stripe_price_id: line
                for price, line in zip(product_one_time.prices, stripe_invoice.lines)
            },
        )

        order = await order_service.create_from_checkout(session, checkout, None)

        assert order.net_amount == 0
        assert order.discount_amount == discount_amount
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time
        assert len(order.items) == len(product_one_time.prices)

        stripe_service_mock.create_out_of_band_invoice.assert_called_once_with(
            customer=customer.stripe_customer_id,
            currency="usd",
            prices=[price.stripe_price_id for price in product_one_time.prices],
            coupon=discount_percentage_100.stripe_coupon_id,
            automatic_tax=False,
            metadata=ANY,
        )

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
        enqueue_job_mock: AsyncMock,
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
            ],
            customer_address=customer_address,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)
        assert order.billing_address is None

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
            ],
            customer_id=cast(str, subscription.customer.stripe_customer_id),
            metadata={"checkout_id": str(checkout.id)},
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.checkout == checkout

        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )


@pytest.mark.asyncio
class TestUpdateOrderFromStripe:
    async def test_not_existing(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(lines=[])
        with pytest.raises(OrderDoesNotExist):
            await order_service.update_order_from_stripe(session, invoice=invoice)

    async def test_paid_charge(
        self,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        invoice = construct_stripe_invoice(status="paid", lines=[])
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id=invoice.id,
        )

        updated_order = await order_service.update_order_from_stripe(
            session, invoice=invoice
        )
        assert updated_order.status == OrderStatus.paid

        enqueue_job_mock.assert_any_call(
            "order.balance", order_id=order.id, charge_id="CHARGE_ID"
        )

    async def test_paid_out_of_band(
        self,
        enqueue_job_mock: AsyncMock,
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
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            stripe_invoice_id=invoice.id,
        )

        updated_order = await order_service.update_order_from_stripe(
            session, invoice=invoice
        )
        assert updated_order.status == OrderStatus.paid

        enqueue_job_mock.assert_any_call(
            "order.balance", order_id=order.id, charge_id=payment_intent.latest_charge
        )


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
                account_id=organization_account.id,
            ),
        )
        platform_fee_transaction_service_mock = mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

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

        updated_payment_transaction = await payment_transaction_service.get(
            session,
            id=payment_transaction.id,
            options=(joinedload(Transaction.payment_customer),),
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order == order
        assert updated_payment_transaction.payment_customer == order.customer


@pytest.mark.asyncio
@pytest.mark.email_order_confirmation
async def test_send_confirmation_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
    organization: Organization,
) -> None:
    with WatcherEmailRenderer() as email_sender:
        mocker.patch("polar.order.service.enqueue_email", email_sender)

        order = await create_order(save_fixture, product=product, customer=customer)

        async def _send_confirmation_email() -> None:
            await order_service.send_confirmation_email(session, organization, order)

        await watch_email(_send_confirmation_email, email_sender.path)
