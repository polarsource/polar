import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.held_balance.service import held_balance as held_balance_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Product, Subscription, Transaction
from polar.models.transaction import TransactionType
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
from tests.fixtures.database import SaveFixture
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
class TestCreateSaleFromStripe:
    async def test_not_a_sale_invoice(self, session: AsyncSession) -> None:
        invoice = construct_stripe_invoice(subscription_id=None)
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
