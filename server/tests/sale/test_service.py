from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

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
    Product,
    Sale,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.organization import Organization
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import TransactionType
from polar.sale.schemas import SalesStatisticsPeriod
from polar.sale.service import (
    InvoiceWithNoOrMultipleLines,
    NotASaleInvoice,
    ProductPriceDoesNotExist,
)
from polar.sale.service import sale as sale_service
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.platform_fee import PlatformFeeTransactionService
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_sale, create_subscription, create_user
from tests.transaction.conftest import create_transaction


def construct_stripe_invoice(
    *,
    id: str = "INVOICE_ID",
    total: int = 12000,
    tax: int = 2000,
    charge_id: str = "CHARGE_ID",
    subscription_id: str | None = "SUBSCRIPTION_ID",
    customer_id: str = "CUSTOMER_ID",
    lines: list[str] = ["PRICE_ID"],
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
            "lines": {"data": [{"price": {"id": price_id}} for price_id in lines]},
            "metadata": metadata,
        },
        None,
    )


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
        await create_sale(save_fixture, product=product, user=user_second)

        sales, count = await sale_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(sales) == 0

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
        await create_sale(save_fixture, product=product, user=user_second)

        sales, count = await sale_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(sales) == 0

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
        sale = await create_sale(save_fixture, product=product, user=user_second)
        await create_sale(
            save_fixture, product=product_organization_second, user=user_second
        )

        sales, count = await sale_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(sales) == 1
        assert sales[0].id == sale.id

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

        sale_organization = await create_sale(
            save_fixture, product=product, user=user_second
        )
        sale_organization_second = await create_sale(
            save_fixture, product=product_organization_second, user=user_second
        )

        # No filter
        sales, count = await sale_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )
        assert count == 2
        assert len(sales) == 2
        assert sales[0].id == sale_organization_second.id
        assert sales[1].id == sale_organization.id

        # Filter by organization
        sales, count = await sale_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            organization_id=organization_second.id,
        )

        assert count == 1
        assert len(sales) == 1
        assert sales[0].id == sale_organization_second.id

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
        sale = await create_sale(save_fixture, product=product, user=user_second)
        await create_sale(
            save_fixture, product=product_organization_second, user=user_second
        )

        sales, count = await sale_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(sales) == 1
        assert sales[0].id == sale.id


MonthlySales = list[tuple[int, int]]


async def create_sales(
    save_fixture: SaveFixture,
    *,
    product: Product,
    user: User,
    monthly_sales: MonthlySales,
) -> list[Sale]:
    assert len(monthly_sales) == 12, "12 months are required"
    sales: list[Sale] = []

    now = utc_now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    eleven_months_ago = now - relativedelta(months=11)
    current = eleven_months_ago
    i = 0

    while current <= now:
        amount, sales_count = monthly_sales[i]
        for _ in range(sales_count):
            sale = await create_sale(
                save_fixture,
                product=product,
                user=user,
                amount=int(amount / sales_count),
                created_at=current.replace(tzinfo=UTC),
            )
            await save_fixture(sale)
            sales.append(sale)
        i += 1
        current += relativedelta(months=1)

    return sales


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


def _merge_monthly_sales(*monthly_sales: MonthlySales) -> MonthlySales:
    return [
        (sum(sales[0] for sales in month), sum(sales[1] for sales in month))
        for month in zip(*monthly_sales)
    ]


def _statistics_periods_assertions(
    periods: Sequence[SalesStatisticsPeriod],
    monthly_sales: MonthlySales,
    subscriptions: list[Subscription],
) -> None:
    assert len(periods) == 12

    for i, period in enumerate(periods):
        amount, sales_count = monthly_sales[i]
        assert period.sales == sales_count
        assert period.earnings == amount

        if i < 11:
            assert period.expected_sales == 0
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
            assert period.expected_sales == len(relevant_subscriptions)
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
        monthly_sales = [
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
        await create_sales(
            save_fixture, product=product, user=user_second, monthly_sales=monthly_sales
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

        periods = await sale_service.get_statistics_periods(session, auth_subject)

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
        monthly_sales = [
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
        await create_sales(
            save_fixture, product=product, user=user_second, monthly_sales=monthly_sales
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

        periods = await sale_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, monthly_sales, subscriptions)

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

        monthly_sales = [
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
        await create_sales(
            save_fixture, product=product, user=user_second, monthly_sales=monthly_sales
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

        periods = await sale_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, monthly_sales, subscriptions)

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

        monthly_sales = [
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
        await create_sales(
            save_fixture, product=product, user=user_second, monthly_sales=monthly_sales
        )
        await create_sales(
            save_fixture,
            product=product_organization_second,
            user=user_second,
            monthly_sales=monthly_sales,
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
        periods = await sale_service.get_statistics_periods(session, auth_subject)
        _statistics_periods_assertions(
            periods,
            _merge_monthly_sales(monthly_sales, monthly_sales),
            [*subscriptions_organization, *subscriptions_organization_second],
        )

        # Organization filter
        periods = await sale_service.get_statistics_periods(
            session, auth_subject, organization_id=organization_second.id
        )
        _statistics_periods_assertions(
            periods, monthly_sales, subscriptions_organization
        )

        # Product filter
        periods = await sale_service.get_statistics_periods(
            session, auth_subject, product_id=product.id
        )
        _statistics_periods_assertions(
            periods, monthly_sales, subscriptions_organization
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
        monthly_sales = [
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
        await create_sales(
            save_fixture, product=product, user=user_second, monthly_sales=monthly_sales
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

        periods = await sale_service.get_statistics_periods(session, auth_subject)

        _statistics_periods_assertions(periods, monthly_sales, subscriptions)


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreateSaleFromStripe:
    @pytest.mark.parametrize(
        "metadata",
        [
            {"type": ProductType.pledge},
            {"type": ProductType.donation},
        ],
    )
    async def test_not_a_sale_invoice(
        self, metadata: dict[str, str], session: AsyncSession
    ) -> None:
        invoice = construct_stripe_invoice(metadata=metadata)
        with pytest.raises(NotASaleInvoice):
            await sale_service.create_sale_from_stripe(session, invoice=invoice)

    @pytest.mark.parametrize("lines", ([], ["PRICE_1", "PRICE_2"]))
    async def test_invalid_lines(self, lines: list[str], session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(lines=lines)
        with pytest.raises(InvoiceWithNoOrMultipleLines):
            await sale_service.create_sale_from_stripe(session, invoice=invoice)

    async def test_not_existing_product_price(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice()
        with pytest.raises(ProductPriceDoesNotExist):
            await sale_service.create_sale_from_stripe(session, invoice=invoice)

    async def test_no_account(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
    ) -> None:
        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[product.prices[0].stripe_price_id],
        )

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        sale = await sale_service.create_sale_from_stripe(session, invoice=invoice)

        assert sale.amount == invoice.total - (invoice.tax or 0)
        assert sale.user.id == subscription.user_id
        assert sale.product == product
        assert sale.product_price == product.prices[0]
        assert sale.subscription == subscription
        assert sale.user.stripe_customer_id == invoice.customer

        held_balance = await held_balance_service.get_by(
            session, organization_id=product.organization_id
        )
        assert held_balance is not None
        assert held_balance.sale_id == sale.id

        updated_payment_transaction = await payment_transaction_service.get(
            session, id=payment_transaction.id
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.sale_id == sale.id

    async def test_with_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        organization_account: Account,
    ) -> None:
        invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id,
            lines=[product.prices[0].stripe_price_id],
        )
        invoice_total = invoice.total - (invoice.tax or 0)

        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment
        )
        payment_transaction.charge_id = "CHARGE_ID"
        await save_fixture(payment_transaction)

        transaction_service_mock = mocker.patch(
            "polar.sale.service.balance_transaction_service",
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
            "polar.sale.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )

        sale = await sale_service.create_sale_from_stripe(session, invoice=invoice)

        assert sale.amount == invoice_total
        assert sale.user.id == subscription.user_id
        assert sale.product == product
        assert sale.product_price == product.prices[0]
        assert sale.subscription == subscription
        assert sale.user.stripe_customer_id == invoice.customer

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
        assert updated_payment_transaction.sale_id == sale.id
