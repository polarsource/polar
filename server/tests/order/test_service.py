from unittest.mock import AsyncMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import ProductType
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.models import (
    Account,
    Product,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.organization import Organization
from polar.models.transaction import TransactionType
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
from tests.fixtures.random_objects import create_order
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
    billing_reason: str = "subscription_create",
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
            "billing_reason": billing_reason,
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

        enqueue_job_mock.assert_called_once_with(
            "order.discord_notification",
            order_id=order.id,
        )

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
            billing_reason="manual",
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

        enqueue_job_mock.assert_any_call(
            "order.discord_notification",
            order_id=order.id,
        )

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            user_id=user.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )
