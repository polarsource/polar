from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
import stripe as stripe_lib
from dateutil.relativedelta import relativedelta
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import ProductType
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    Order,
    Product,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.organization import Organization
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import TransactionType
from polar.order.schemas import OrdersStatisticsPeriod
from polar.order.service import (
    CantDetermineInvoicePrice,
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
from tests.fixtures.random_objects import create_order, create_subscription, create_user
from tests.transaction.conftest import create_transaction


def construct_stripe_invoice(
    *,
    id: str = "INVOICE_ID",
    total: int = 12000,
    tax: int = 2000,
    charge_id: str = "CHARGE_ID",
    subscription_id: str | None = "SUBSCRIPTION_ID",
    customer_id: str = "CUSTOMER_ID",
    lines: list[tuple[str, bool]] = [("PRICE_ID", False)],
    metadata: dict[str, str] = {},
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": id,
            "total": total,
            "tax": tax,
            "currency": "usd",
            "charge": charge_id,
            "subscription": subscription_id,
            "customer": customer_id,
            "lines": {
                "data": [
                    {"price": {"id": price_id}, "proration": proration}
                    for price_id, proration in lines
                ]
            },
            "metadata": metadata,
        },
        None,
    )


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.order.service.enqueue_job")


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        await create_order(save_fixture, product=product, user=user_second)

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth
    async def test_user_not_organization_admin(
        self,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        await create_order(save_fixture, product=product, user=user_second)

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth
    async def test_user_organization_admin(
        self,
        auth_subject: AuthSubject[User],
        user_organization_admin: UserOrganization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        user_second: User,
    ) -> None:
        order = await create_order(save_fixture, product=product, user=user_second)
        await create_order(
            save_fixture, product=product_organization_second, user=user_second
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
        user_organization_admin: UserOrganization,
        organization_second: Organization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        user_second: User,
    ) -> None:
        user_organization_second_admin = UserOrganization(
            user_id=user.id,
            organization_id=organization_second.id,
            is_admin=True,
        )
        await save_fixture(user_organization_second_admin)

        order_organization = await create_order(
            save_fixture, product=product, user=user_second
        )
        order_organization_second = await create_order(
            save_fixture, product=product_organization_second, user=user_second
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
            organization_id=organization_second.id,
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
        user_second: User,
    ) -> None:
        order = await create_order(save_fixture, product=product, user=user_second)
        await create_order(
            save_fixture, product=product_organization_second, user=user_second
        )

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order.id


MonthlyOrders = list[tuple[int, int]]


async def create_orders(
    save_fixture: SaveFixture,
    *,
    product: Product,
    user: User,
    monthly_orders: MonthlyOrders,
) -> list[Order]:
    assert len(monthly_orders) == 12, "12 months are required"
    orders: list[Order] = []

    now = utc_now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    eleven_months_ago = now - relativedelta(months=11)
    current = eleven_months_ago
    i = 0

    while current <= now:
        amount, orders_count = monthly_orders[i]
        for _ in range(orders_count):
            order = await create_order(
                save_fixture,
                product=product,
                user=user,
                amount=int(amount / orders_count),
                created_at=current.replace(tzinfo=UTC),
            )
            await save_fixture(order)
            orders.append(order)
        i += 1
        current += relativedelta(months=1)

    return orders


SubscriptionFixture = tuple[SubscriptionStatus, datetime]


async def create_subscriptions(
    save_fixture: SaveFixture,
    *,
    product: Product,
    user: User,
    subscriptions: list[SubscriptionFixture],
) -> list[Subscription]:
    return [
        await create_subscription(
            save_fixture,
            product=product,
            user=user,
            status=status,
            current_period_end=current_period_end,
        )
        for status, current_period_end in subscriptions
    ]


def _merge_monthly_orders(*monthly_orders: MonthlyOrders) -> MonthlyOrders:
    return [
        (sum(orders[0] for orders in month), sum(orders[1] for orders in month))
        for month in zip(*monthly_orders)
    ]


def _statistics_periods_assertions(
    periods: Sequence[OrdersStatisticsPeriod],
    monthly_orders: MonthlyOrders,
    subscriptions: list[Subscription],
) -> None:
    assert len(periods) == 12

    for i, period in enumerate(periods):
        amount, orders_count = monthly_orders[i]
        assert period.orders == orders_count
        assert period.earnings == amount

        if i < 11:
            assert period.expected_orders == 0
            assert period.expected_earnings == 0
        else:
            now = utc_now()
            end_of_period = period.date + relativedelta(months=1)
            end_of_period_datetime = datetime(
                end_of_period.year,
                end_of_period.month,
                end_of_period.day,
                0,
                0,
                0,
                0,
                UTC,
            )

            relevant_subscriptions = [
                subscription
                for subscription in subscriptions
                if subscription.active
                and now <= subscription.current_period_end <= end_of_period_datetime
            ]
            assert period.expected_orders == len(relevant_subscriptions)
            assert period.expected_earnings == sum(
                subscription.price.price_amount
                for subscription in relevant_subscriptions
                if subscription.price
            )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetStatisticsPeriods:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        monthly_orders = [
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (500, 1),
        ]
        await create_orders(
            save_fixture,
            product=product,
            user=user_second,
            monthly_orders=monthly_orders,
        )
        subscription_fixtures = [
            (SubscriptionStatus.active, utc_now() + timedelta(minutes=1)),
            (SubscriptionStatus.active, utc_now() + timedelta(days=30)),
            (SubscriptionStatus.canceled, utc_now() + timedelta(minutes=1)),
        ]
        await create_subscriptions(
            save_fixture,
            product=product,
            user=user_second,
            subscriptions=subscription_fixtures,
        )

        periods = await order_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, [(0, 0)] * 12, [])

    @pytest.mark.auth
    async def test_user_organization_admin(
        self,
        auth_subject: AuthSubject[User],
        user_organization_admin: UserOrganization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        monthly_orders = [
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (500, 1),
        ]
        await create_orders(
            save_fixture,
            product=product,
            user=user_second,
            monthly_orders=monthly_orders,
        )
        subscription_fixtures = [
            (SubscriptionStatus.active, utc_now() + timedelta(minutes=1)),
            (SubscriptionStatus.active, utc_now() + timedelta(days=30)),
            (SubscriptionStatus.canceled, utc_now() + timedelta(minutes=1)),
        ]
        subscriptions = await create_subscriptions(
            save_fixture,
            product=product,
            user=user_second,
            subscriptions=subscription_fixtures,
        )

        periods = await order_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, monthly_orders, subscriptions)

    @pytest.mark.auth
    async def test_user_multiple_users_organization(
        self,
        auth_subject: AuthSubject[User],
        user_organization_admin: UserOrganization,
        organization: Organization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        user2 = await create_user(save_fixture)
        user2_organization = UserOrganization(
            user_id=user2.id,
            organization_id=organization.id,
        )
        await save_fixture(user2_organization)

        user3 = await create_user(save_fixture)
        user3_organization = UserOrganization(
            user_id=user3.id,
            organization_id=organization.id,
        )
        await save_fixture(user3_organization)

        monthly_orders = [
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (500, 1),
        ]
        await create_orders(
            save_fixture,
            product=product,
            user=user_second,
            monthly_orders=monthly_orders,
        )
        subscription_fixtures = [
            (SubscriptionStatus.active, utc_now() + timedelta(minutes=1)),
            (SubscriptionStatus.active, utc_now() + timedelta(days=30)),
            (SubscriptionStatus.canceled, utc_now() + timedelta(minutes=1)),
        ]
        subscriptions = await create_subscriptions(
            save_fixture,
            product=product,
            user=user_second,
            subscriptions=subscription_fixtures,
        )

        periods = await order_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, monthly_orders, subscriptions)

    @pytest.mark.auth
    async def test_user_filters(
        self,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization_admin: UserOrganization,
        organization: Organization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization_second: Organization,
        product_organization_second: Product,
        user_second: User,
    ) -> None:
        user_organization_second = UserOrganization(
            user_id=user.id, organization_id=organization_second.id, is_admin=True
        )
        await save_fixture(user_organization_second)

        monthly_orders = [
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (500, 1),
        ]
        await create_orders(
            save_fixture,
            product=product,
            user=user_second,
            monthly_orders=monthly_orders,
        )
        await create_orders(
            save_fixture,
            product=product_organization_second,
            user=user_second,
            monthly_orders=monthly_orders,
        )

        subscription_fixtures = [
            (SubscriptionStatus.active, utc_now() + timedelta(minutes=1)),
            (SubscriptionStatus.active, utc_now() + timedelta(days=30)),
            (SubscriptionStatus.canceled, utc_now() + timedelta(minutes=1)),
        ]
        subscriptions_organization = await create_subscriptions(
            save_fixture,
            product=product,
            user=user_second,
            subscriptions=subscription_fixtures,
        )
        subscriptions_organization_second = await create_subscriptions(
            save_fixture,
            product=product_organization_second,
            user=user_second,
            subscriptions=subscription_fixtures,
        )

        # No filter
        periods = await order_service.get_statistics_periods(session, auth_subject)
        _statistics_periods_assertions(
            periods,
            _merge_monthly_orders(monthly_orders, monthly_orders),
            [*subscriptions_organization, *subscriptions_organization_second],
        )

        # Organization filter
        periods = await order_service.get_statistics_periods(
            session, auth_subject, organization_id=organization_second.id
        )
        _statistics_periods_assertions(
            periods, monthly_orders, subscriptions_organization
        )

        # Product filter
        periods = await order_service.get_statistics_periods(
            session, auth_subject, product_id=product.id
        )
        _statistics_periods_assertions(
            periods, monthly_orders, subscriptions_organization
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        monthly_orders = [
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (1000, 1),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
            (0, 0),
        ]
        await create_orders(
            save_fixture,
            product=product,
            user=user_second,
            monthly_orders=monthly_orders,
        )

        subscription_fixtures = [
            (SubscriptionStatus.active, utc_now() + timedelta(minutes=1)),
            (SubscriptionStatus.active, utc_now() + timedelta(days=30)),
            (SubscriptionStatus.canceled, utc_now() + timedelta(minutes=1)),
        ]
        subscriptions = await create_subscriptions(
            save_fixture,
            product=product,
            user=user_second,
            subscriptions=subscription_fixtures,
        )

        periods = await order_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, monthly_orders, subscriptions)


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreateOrderFromStripe:
    @pytest.mark.parametrize(
        "metadata",
        [
            {"type": ProductType.pledge},
            {"type": ProductType.donation},
        ],
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
            [("PRICE_1", True), ("PRICE_2", True)],
            [("PRICE_1", False), ("PRICE_2", False)],
        ),
    )
    async def test_invalid_lines(
        self, lines: list[tuple[str, bool]], session: AsyncSession
    ) -> None:
        invoice = construct_stripe_invoice(lines=lines)
        with pytest.raises(CantDetermineInvoicePrice):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_not_existing_product_price(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice()
        with pytest.raises(ProductPriceDoesNotExist):
            await order_service.create_order_from_stripe(session, invoice=invoice)

    async def test_subscription_no_account(
        self,
        enqueue_job_mock: AsyncMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
    ) -> None:
        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[(product.prices[0].stripe_price_id, False)],
        )

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice.total - (invoice.tax or 0)
        assert order.user.id == subscription.user_id
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.user.stripe_customer_id == invoice.customer

        held_balance = await held_balance_service.get_by(
            session, organization_id=product.organization_id
        )
        assert held_balance is not None
        assert held_balance.order_id == order.id

        updated_payment_transaction = await payment_transaction_service.get(
            session, id=payment_transaction.id
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order_id == order.id

        enqueue_job_mock.assert_not_called()

    async def test_subscription_proration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
    ) -> None:
        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[
                ("PRICE_1", True),
                ("PRICE_2", True),
                (product.prices[0].stripe_price_id, False),
            ],
        )

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        order = await order_service.create_order_from_stripe(session, invoice=invoice)

        assert order.amount == invoice.total - (invoice.tax or 0)
        assert order.user.id == subscription.user_id
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.user.stripe_customer_id == invoice.customer

    async def test_subscription_with_account(
        self,
        enqueue_job_mock: AsyncMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        organization_account: Account,
    ) -> None:
        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[(product.prices[0].stripe_price_id, False)],
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        transaction_service_mock = mocker.patch(
            "polar.order.service.balance_transaction_service",
            spec=BalanceTransactionService,
        )
        transaction_service_mock.get_by.return_value = payment_transaction
        transaction_service_mock.create_balance_from_charge.return_value = (
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
        assert order.user.id == subscription.user_id
        assert order.product == product
        assert order.product_price == product.prices[0]
        assert order.subscription == subscription
        assert order.user.stripe_customer_id == invoice.customer

        transaction_service_mock.create_balance_from_charge.assert_called_once()
        assert (
            transaction_service_mock.create_balance_from_charge.call_args[1][
                "destination_account"
            ].id
            == organization_account.id
        )
        assert (
            transaction_service_mock.create_balance_from_charge.call_args[1][
                "charge_id"
            ]
            == invoice.charge
        )
        assert (
            transaction_service_mock.create_balance_from_charge.call_args[1]["amount"]
            == invoice_total
        )

        platform_fee_transaction_service_mock.create_fees_reversal_balances.assert_called_once()

        updated_payment_transaction = await payment_transaction_service.get(
            session, id=payment_transaction.id
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order_id == order.id

        enqueue_job_mock.assert_not_called()

    async def test_one_time_product(
        self,
        enqueue_job_mock: AsyncMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time: Product,
        organization_account: Account,
        user: User,
    ) -> None:
        invoice = construct_stripe_invoice(
            lines=[(product_one_time.prices[0].stripe_price_id, False)],
            subscription_id=None,
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        user.stripe_customer_id = "CUSTOMER_ID"
        await save_fixture(user)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        transaction_service_mock = mocker.patch(
            "polar.order.service.balance_transaction_service",
            spec=BalanceTransactionService,
        )
        transaction_service_mock.get_by.return_value = payment_transaction
        transaction_service_mock.create_balance_from_charge.return_value = (
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
        assert order.user.id == user.id
        assert order.product == product_one_time
        assert order.product_price == product_one_time.prices[0]
        assert order.subscription is None

        enqueue_job_mock.assert_called_once_with(
            "benefit.enqueue_benefits_grants",
            task="grant",
            user_id=user.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )
