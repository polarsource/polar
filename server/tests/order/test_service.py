from datetime import datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
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
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderBillingReason
from polar.models.organization import Organization
from polar.models.transaction import TransactionType
from polar.order.service import (
    CantDetermineInvoicePrice,
    InvoiceWithoutCharge,
    NotAnOrderInvoice,
    ProductPriceDoesNotExist,
)
from polar.order.service import order as order_service
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.platform_fee import PlatformFeeTransactionService
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.email import WatcherEmailRenderer, watch_email
from tests.fixtures.random_objects import create_checkout, create_order
from tests.fixtures.stripe import construct_stripe_invoice
from tests.transaction.conftest import create_transaction


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
            customer=customer,
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
            customer=customer,
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
            customer=customer,
            stripe_invoice_id="INVOICE_2",
        )

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order.id


@pytest.mark.asyncio
class TestCreateOrderFromStripe:
    @pytest.mark.parametrize(
        "metadata",
        [{"type": ProductType.pledge}],
    )
    async def test_not_a_order_invoice(
        self, metadata: dict[str, str], session: AsyncSession
    ) -> None:
        invoice = construct_stripe_invoice(metadata=metadata)
        with pytest.raises(NotAnOrderInvoice):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    @pytest.mark.parametrize(
        "lines",
        (
            [],
            [("PRICE_1", False, None), ("PRICE_2", False, None)],
        ),
    )
    async def test_invalid_lines(
        self,
        lines: list[tuple[str, bool, dict[str, str] | None]],
        session: AsyncSession,
    ) -> None:
        invoice = construct_stripe_invoice(lines=lines)
        with pytest.raises(CantDetermineInvoicePrice):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_not_existing_product_price(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice()
        with pytest.raises(ProductPriceDoesNotExist):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_no_charge(
        self, session: AsyncSession, product: Product, subscription: Subscription
    ) -> None:
        invoice = construct_stripe_invoice(
            charge_id=None,
            lines=[(product.prices[0].stripe_price_id, False, None)],
            metadata={},
        )
        with pytest.raises(InvoiceWithoutCharge):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_subscription_no_account(
        self,
        enqueue_job_mock: AsyncMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[(product.prices[0].stripe_price_id, False, None)],
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice.total - (invoice.tax or 0)
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.customer.stripe_customer_id == invoice.customer
        assert order.billing_reason == invoice.billing_reason
        assert order.created_at == created_datetime

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
        assert updated_payment_transaction.order_id == order.id
        assert updated_payment_transaction.payment_customer == order.customer

        enqueue_job_mock.assert_called_once_with(
            "order.discord_notification",
            order_id=order.id,
        )

    async def test_subscription_proration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                ("PRICE_1", True, None),
                ("PRICE_2", True, None),
                (product.prices[0].stripe_price_id, False, None),
            ],
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice.total - (invoice.tax or 0)
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.customer.stripe_customer_id == invoice.customer
        assert order.billing_reason == invoice.billing_reason
        assert order.created_at == created_datetime

    async def test_subscription_only_proration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                ("PRICE_1", True, None),
                ("PRICE_2", True, None),
            ],
            subscription_details={
                "metadata": {"product_price_id": str(product.prices[0].id)}
            },
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice.total - (invoice.tax or 0)
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.customer.stripe_customer_id == invoice.customer
        assert order.billing_reason == invoice.billing_reason
        assert order.created_at == created_datetime

    async def test_subscription_with_account(
        self,
        enqueue_job_mock: AsyncMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        organization_account: Account,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[(product.prices[0].stripe_price_id, False, None)],
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        platform_fee_transaction_service_mock = mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.customer.stripe_customer_id == invoice.customer
        assert order.billing_reason == invoice.billing_reason
        assert order.created_at == created_datetime

        create_balance_from_charge_mock.assert_awaited_once()
        assert (
            create_balance_from_charge_mock.call_args[1]["destination_account"].id
            == organization_account.id
        )
        assert (
            create_balance_from_charge_mock.call_args[1]["charge_id"] == invoice.charge
        )
        assert (
            create_balance_from_charge_mock.call_args[1]["amount"]
            == payment_transaction.amount
        )

        platform_fee_transaction_service_mock.create_fees_reversal_balances.assert_called_once()

        updated_payment_transaction = await payment_transaction_service.get(
            session,
            id=payment_transaction.id,
            options=(joinedload(Transaction.payment_customer),),
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order_id == order.id
        assert updated_payment_transaction.payment_customer == order.customer

        enqueue_job_mock.assert_called_once_with(
            "order.discord_notification",
            order_id=order.id,
        )

    async def test_subscription_applied_balance(
        self,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            amount_paid=0,
            charge_id=None,
            lines=[
                ("PRICE_1", True, None),
                ("PRICE_2", True, None),
            ],
            subscription_details={
                "metadata": {"product_price_id": str(product.prices[0].id)}
            },
            created=created_unix_timestamp,
            customer_id=cast(str, subscription.customer.stripe_customer_id),
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice.total - (invoice.tax or 0)
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.customer.stripe_customer_id == invoice.customer
        assert order.billing_reason == invoice.billing_reason
        assert order.created_at == created_datetime

    async def test_subscription_discount(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        organization_account: Account,
        discount_fixed_once: Discount,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[(product.prices[0].stripe_price_id, False, None)],
            discount=discount_fixed_once,
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.discount == discount_fixed_once
        assert order.created_at == created_datetime

        updated_subscription = await session.get(Subscription, subscription.id)
        assert updated_subscription is not None
        assert updated_subscription

    async def test_one_time_product(
        self,
        enqueue_job_mock: AsyncMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time: Product,
        organization_account: Account,
        customer: Customer,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            lines=[(product_one_time.prices[0].stripe_price_id, False, None)],
            subscription_id=None,
            billing_reason="manual",
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.customer == customer
        assert order.product == product_one_time
        assert order.product_price == product_one_time.prices[0]
        assert order.subscription is None
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.billing_address == Address(country="FR")  # pyright: ignore
        assert order.created_at == created_datetime

        updated_payment_transaction = await payment_transaction_service.get(
            session,
            id=payment_transaction.id,
            options=(joinedload(Transaction.payment_customer),),
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order_id == order.id
        assert updated_payment_transaction.payment_customer == order.customer

        enqueue_job_mock.assert_any_call(
            "order.discord_notification",
            order_id=order.id,
        )

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )

    async def test_one_time_product_discount(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time: Product,
        organization_account: Account,
        customer: Customer,
        discount_fixed_once: Discount,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            lines=[(product_one_time.prices[0].stripe_price_id, False, None)],
            subscription_id=None,
            billing_reason="manual",
            discount=discount_fixed_once,
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.discount == discount_fixed_once
        assert order.created_at == created_datetime

    async def test_one_time_custom_price_product(
        self,
        enqueue_job_mock: AsyncMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time_custom_price: Product,
        organization_account: Account,
        customer: Customer,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            lines=[
                (
                    "CUSTOM_STRIPE_PRICE_ID",
                    False,
                    {
                        "product_price_id": str(
                            product_one_time_custom_price.prices[0].id
                        )
                    },
                )
            ],
            subscription_id=None,
            billing_reason="manual",
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.customer == customer
        assert order.product == product_one_time_custom_price
        assert order.product_price == product_one_time_custom_price.prices[0]
        assert order.subscription is None
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.created_at == created_datetime

        enqueue_job_mock.assert_any_call(
            "order.discord_notification",
            order_id=order.id,
        )

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_custom_price.id,
            order_id=order.id,
        )

    async def test_one_time_free_product(
        self,
        enqueue_job_mock: AsyncMock,
        session: AsyncSession,
        product_one_time_free_price: Product,
        customer: Customer,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            charge_id=None,
            total=0,
            tax=0,
            lines=[
                (product_one_time_free_price.prices[0].stripe_price_id, False, None)
            ],
            subscription_id=None,
            billing_reason="manual",
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.customer == customer
        assert order.product == product_one_time_free_price
        assert order.product_price == product_one_time_free_price.prices[0]
        assert order.subscription is None
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.created_at == created_datetime

        enqueue_job_mock.assert_any_call(
            "order.discord_notification", order_id=order.id
        )

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_free_price.id,
            order_id=order.id,
        )

    async def test_charge_from_metadata(
        self,
        enqueue_job_mock: AsyncMock,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time: Product,
        organization_account: Account,
        customer: Customer,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        stripe_service_mock.get_payment_intent.return_value = (
            stripe_lib.PaymentIntent.construct_from(
                {"latest_charge": "CHARGE_ID"}, key=None
            )
        )

        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            charge_id=None,
            metadata={"payment_intent_id": "PAYMENT_INTENT_ID"},
            lines=[(product_one_time.prices[0].stripe_price_id, False, None)],
            subscription_id=None,
            billing_reason="manual",
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice_total
        assert order.customer == customer
        assert order.product == product_one_time
        assert order.product_price == product_one_time.prices[0]
        assert order.subscription is None
        assert order.billing_reason == OrderBillingReason.purchase
        assert order.created_at == created_datetime

        enqueue_job_mock.assert_any_call(
            "order.discord_notification",
            order_id=order.id,
        )

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )

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
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        session: AsyncSession,
        product: Product,
        organization_account: Account,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {"id": "CHARGE_ID", "payment_method_details": None},
            key=None,
        )

        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            lines=[(product.prices[0].stripe_price_id, False, None)],
            customer_address=customer_address,
            subscription_id=None,
            billing_reason="manual",
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)
        assert order.billing_address is None
        assert order.created_at == created_datetime

    async def test_billing_address_from_payment_method(
        self,
        mocker: MockerFixture,
        stripe_service_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        organization_account: Account,
        event_creation_time: tuple[datetime, int],
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

        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            charge_id="CHARGE_ID",
            lines=[(product_one_time.prices[0].stripe_price_id, False, None)],
            customer_address=None,
            subscription_id=None,
            billing_reason="manual",
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)
        assert order.billing_address == Address(country="US")  # type: ignore
        assert order.created_at == created_datetime

    async def test_with_checkout(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time: Product,
        organization_account: Account,
        customer: Customer,
        event_creation_time: tuple[datetime, int],
    ) -> None:
        publish_checkout_event_mock = mocker.patch(
            "polar.order.service.publish_checkout_event"
        )

        price = product_one_time.prices[0]
        checkout = await create_checkout(
            save_fixture, products=[product_one_time], status=CheckoutStatus.succeeded
        )

        created_datetime, created_unix_timestamp = event_creation_time

        invoice = construct_stripe_invoice(
            lines=[(price.stripe_price_id, False, None)],
            subscription_id=None,
            billing_reason="manual",
            metadata={"checkout_id": str(checkout.id)},
            created=created_unix_timestamp,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge",
            spec=BalanceTransactionService.create_balance_from_charge,
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-invoice_total),
            Transaction(
                type=TransactionType.balance,
                amount=invoice_total,
                account_id=organization_account.id,
            ),
        )
        mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.checkout == checkout
        assert order.created_at == created_datetime

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret,
            "checkout.order_created",
        )


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
