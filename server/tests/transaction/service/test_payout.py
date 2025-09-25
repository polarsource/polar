from functools import partial

import pytest

from polar.enums import AccountType
from polar.models import Account, Organization, Payout, Transaction, User
from polar.models.transaction import Processor
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
        organization: Organization,
        user: User,
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

        payout, fees = await create_payout(save_fixture, session, account=account)

        transaction = await payout_transaction_service.create(session, payout, fees)

        assert transaction.account == account
        assert transaction.processor == Processor.stripe
        assert transaction.payout == payout
        assert transaction.currency == "usd"
        assert transaction.amount < 0
        assert transaction.account_currency == "usd"
        assert transaction.account_amount < 0
        assert transaction.transfer_id is None

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

    async def test_open_collective(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
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
