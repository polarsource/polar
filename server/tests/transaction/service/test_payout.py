from functools import partial
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.locker import Locker
from polar.models import Account, Organization, Payout, Transaction, User
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.transaction.service.transaction import transaction as transaction_service
from tests.fixtures import random_objects as ro
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account
from tests.fixtures.random_objects import create_payout as _create_payout


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.payout.stripe_service", new=mock)
    return mock


create_payment_transaction = partial(ro.create_payment_transaction, amount=10000)
create_refund_transaction = partial(ro.create_refund_transaction, amount=-10000)
create_balance_transaction = partial(ro.create_balance_transaction, amount=10000)


async def create_payout(
    save_fixture: SaveFixture,
    session: AsyncSession,
    account: Account,
) -> tuple[Payout, list[tuple[Transaction, Transaction]]]:
    balance_amount = await transaction_service.get_transactions_sum(session, account.id)
    (
        balance_amount_after_fees,
        payout_fees_balances,
    ) = await platform_fee_transaction_service.create_payout_fees_balances(
        session, account=account, balance_amount=balance_amount
    )

    payout = await _create_payout(
        save_fixture,
        account=account,
        amount=balance_amount_after_fees,
        account_amount=balance_amount_after_fees,
        account_currency=account.currency,
    )

    return payout, payout_fees_balances


@pytest.mark.asyncio
class TestCreate:
    async def test_stripe(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", balance_transaction="STRIPE_BALANCE_TRANSACTION_ID"
        )

        payout, fees = await create_payout(save_fixture, session, account=account)

        transaction = await payout_transaction_service.create(session, payout, fees)

        assert transaction.account == account
        assert transaction.processor == Processor.stripe
        assert transaction.payout == payout
        assert transaction.currency == "usd"
        assert transaction.amount < 0
        assert transaction.account_currency == "usd"
        assert transaction.account_amount < 0

        assert len(transaction.paid_transactions) == 2 + len(
            transaction.account_incurred_transactions
        )
        assert transaction.paid_transactions[0].id == balance_transaction_1.id
        assert transaction.paid_transactions[1].id == balance_transaction_2.id

        assert len(transaction.incurred_transactions) > 0
        assert (
            len(transaction.account_incurred_transactions)
            == len(transaction.incurred_transactions) / 2
        )

        transfer_mock: MagicMock = stripe_service_mock.transfer
        assert transfer_mock.call_count == 2
        for call in transfer_mock.call_args_list:
            assert call[0][0] == account.stripe_id
            assert call[1]["source_transaction"] in [
                payment_transaction_1.charge_id,
                payment_transaction_2.charge_id,
            ]
            assert call[1]["metadata"]["payout_transaction_id"] == str(transaction.id)

        stripe_service_mock.create_payout.assert_not_called()

    async def test_stripe_different_currencies(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, country="FR", currency="eur"
        )

        payment_transaction_1 = await create_payment_transaction(save_fixture)
        balance_transaction_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )

        payment_transaction_2 = await create_payment_transaction(save_fixture)
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID",
            balance_transaction="STRIPE_BALANCE_TRANSACTION_ID",
            destination_payment="STRIPE_DESTINATION_CHARGE_ID",
        )
        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            id="STRIPE_DESTINATION_CHARGE_ID",
            balance_transaction=SimpleNamespace(
                amount=900, currency="eur", exchange_rate=0.9
            ),
        )
        stripe_service_mock.create_payout.return_value = SimpleNamespace(
            id="STRIPE_PAYOUT_ID"
        )

        payout, fees = await create_payout(save_fixture, session, account=account)

        transaction = await payout_transaction_service.create(session, payout, fees)

        assert transaction.account == account
        assert transaction.processor == Processor.stripe
        assert transaction.payout == payout
        assert transaction.currency == "usd"
        assert transaction.amount < 0
        assert transaction.account_currency == "eur"
        assert transaction.account_amount < 0

        assert len(transaction.paid_transactions) == 2 + len(
            transaction.account_incurred_transactions
        )
        assert transaction.paid_transactions[0].id == balance_transaction_1.id
        assert transaction.paid_transactions[1].id == balance_transaction_2.id

        stripe_service_mock.create_payout.assert_not_called()

    async def test_stripe_refund(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_ID_1"
        )
        balance_transaction_payment_1 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_1
        )
        balance_transaction_fee_1 = await create_balance_transaction(
            save_fixture,
            account=account,
            amount=-100,
            balance_reversal_transaction=balance_transaction_payment_1,
        )

        payment_transaction_2 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_ID_2"
        )
        balance_transaction_payment_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )
        balance_transaction_fee_2 = await create_balance_transaction(
            save_fixture,
            account=account,
            amount=-100,
            balance_reversal_transaction=balance_transaction_payment_2,
        )

        assert payment_transaction_2.charge_id is not None
        refund_transaction_2 = await create_refund_transaction(
            save_fixture,
            amount=-payment_transaction_2.amount,
            charge_id=payment_transaction_2.charge_id,
        )
        balance_transaction_refund_2 = await create_balance_transaction(
            save_fixture,
            account=account,
            amount=refund_transaction_2.amount,
            balance_reversal_transaction=balance_transaction_payment_2,
        )

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", balance_transaction="STRIPE_BALANCE_TRANSACTION_ID"
        )

        payout, fees = await create_payout(save_fixture, session, account=account)

        transaction = await payout_transaction_service.create(session, payout, fees)

        assert transaction.account == account
        assert transaction.processor == Processor.stripe
        assert transaction.payout == payout
        assert transaction.currency == "usd"
        assert transaction.amount < 0
        assert transaction.account_currency == "usd"
        assert transaction.account_amount < 0

        assert len(transaction.paid_transactions) == 5 + len(
            transaction.account_incurred_transactions
        )
        assert set(t.id for t in transaction.paid_transactions).issuperset(
            {
                balance_transaction_payment_1.id,
                balance_transaction_fee_1.id,
                balance_transaction_payment_2.id,
                balance_transaction_fee_2.id,
                balance_transaction_refund_2.id,
            }
        )

        assert len(transaction.incurred_transactions) > 0
        assert (
            len(transaction.account_incurred_transactions)
            == len(transaction.incurred_transactions) / 2
        )

        transfer_mock: MagicMock = stripe_service_mock.transfer
        assert transfer_mock.call_count == 1
        for call in transfer_mock.call_args_list:
            assert call[0][0] == account.stripe_id
            assert call[1]["source_transaction"] in [
                payment_transaction_1.charge_id,
                payment_transaction_2.charge_id,
            ]
            assert call[1]["metadata"]["payout_transaction_id"] == str(transaction.id)

        stripe_service_mock.create_payout.assert_not_called()

    async def test_stripe_refund_of_paid_payment(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = await create_account(save_fixture, organization, user)

        previous_payout = Transaction(
            type=TransactionType.payout,
            account=account,
            processor=Processor.stripe,
            currency="usd",
            amount=-10000,
            account_currency="usd",
            account_amount=-10000,
            tax_amount=0,
        )
        await save_fixture(previous_payout)

        payment_transaction_1 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_ID_1"
        )
        balance_transaction_1 = await create_balance_transaction(
            save_fixture,
            account=account,
            payment_transaction=payment_transaction_1,
            payout_transaction=previous_payout,
        )

        payment_transaction_2 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_ID_2"
        )
        balance_transaction_2 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_2
        )

        payment_transaction_3 = await create_payment_transaction(
            save_fixture, charge_id="CHARGE_ID_3"
        )
        balance_transaction_3 = await create_balance_transaction(
            save_fixture, account=account, payment_transaction=payment_transaction_3
        )

        assert payment_transaction_1.charge_id is not None
        refund_transaction_1 = await create_refund_transaction(
            save_fixture,
            amount=-payment_transaction_1.amount,
            charge_id=payment_transaction_1.charge_id,
        )
        balance_transaction_4 = await create_balance_transaction(
            save_fixture,
            account=account,
            amount=refund_transaction_1.amount,
            balance_reversal_transaction=balance_transaction_1,
        )

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", balance_transaction="STRIPE_BALANCE_TRANSACTION_ID"
        )

        payout, fees = await create_payout(save_fixture, session, account=account)

        transaction = await payout_transaction_service.create(session, payout, fees)

        assert transaction.account == account
        assert transaction.processor == Processor.stripe
        assert transaction.payout == payout
        assert transaction.currency == "usd"
        assert transaction.amount < 0
        assert transaction.account_currency == "usd"
        assert transaction.account_amount < 0

        assert len(transaction.paid_transactions) == 3 + len(
            transaction.account_incurred_transactions
        )
        assert transaction.paid_transactions[0].id == balance_transaction_2.id
        assert transaction.paid_transactions[1].id == balance_transaction_3.id
        assert transaction.paid_transactions[2].id == balance_transaction_4.id

        assert len(transaction.incurred_transactions) > 0
        assert (
            len(transaction.account_incurred_transactions)
            == len(transaction.incurred_transactions) / 2
        )

        transfer_mock: MagicMock = stripe_service_mock.transfer
        assert transfer_mock.call_count == 1
        for call in transfer_mock.call_args_list:
            assert call[0][0] == account.stripe_id
            assert call[1]["source_transaction"] in [
                payment_transaction_2.charge_id,
                payment_transaction_3.charge_id,
            ]
            # assert call[1]["transfer_group"] == str(payout.id)
            assert call[1]["metadata"]["payout_transaction_id"] == str(transaction.id)

        stripe_service_mock.create_payout.assert_not_called()

    async def test_open_collective(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = await create_account(
            save_fixture, organization, user, account_type=AccountType.open_collective
        )

        balance_transaction = await create_balance_transaction(
            save_fixture, account=account
        )

        payout, fees = await create_payout(save_fixture, session, account=account)

        transaction = await payout_transaction_service.create(session, payout, fees)

        assert transaction.account == account
        assert transaction.processor == Processor.open_collective
        assert transaction.currency == "usd"
        assert transaction.amount == -balance_transaction.amount
        assert transaction.account_currency == "usd"
        assert transaction.account_amount == -balance_transaction.amount

        assert len(transaction.paid_transactions) == 1 + len(
            transaction.account_incurred_transactions
        )
        assert transaction.paid_transactions[0].id == balance_transaction.id

        assert len(transaction.incurred_transactions) == 0
        assert len(transaction.account_incurred_transactions) == 0
