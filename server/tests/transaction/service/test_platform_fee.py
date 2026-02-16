from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import (
    Account,
    IssueReward,
    Order,
    Organization,
    Pledge,
    Transaction,
    User,
)
from polar.models.transaction import (
    PlatformFeeType,
    Processor,
    ProcessorFeeType,
    TransactionType,
)
from polar.postgres import AsyncSession
from polar.transaction.service.platform_fee import PayoutAmountTooLow
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account


async def create_balance_transactions(
    save_fixture: SaveFixture,
    *,
    account: Account,
    pledge: Pledge | None = None,
    issue_reward: IssueReward | None = None,
    order: Order | None = None,
    payment_charge_id: str | None = None,
) -> tuple[Transaction, Transaction]:
    payment_transaction = Transaction(
        type=TransactionType.payment,
        processor=Processor.stripe,
        currency="usd",
        amount=10000,
        account_currency="usd",
        account_amount=10000,
        tax_amount=2000,
        pledge=pledge,
        issue_reward=issue_reward,
        order=order,
        charge_id=payment_charge_id,
    )
    await save_fixture(payment_transaction)

    payment_transaction_fee = Transaction(
        type=TransactionType.processor_fee,
        processor=Processor.stripe,
        currency="usd",
        amount=-500,
        account_currency="usd",
        account_amount=-500,
        tax_amount=0,
        incurred_by_transaction=payment_transaction,
    )
    await save_fixture(payment_transaction_fee)

    outgoing = Transaction(
        type=TransactionType.balance,
        processor=None,
        currency="usd",
        amount=-10000,
        account_currency="usd",
        account_amount=-10000,
        tax_amount=0,
        pledge=pledge,
        issue_reward=issue_reward,
        order=order,
        balance_correlation_key="BALANCE_1",
        payment_transaction=payment_transaction,
    )
    incoming = Transaction(
        type=TransactionType.balance,
        processor=None,
        currency="usd",
        amount=10000,
        account_currency="usd",
        account_amount=10000,
        account=account,
        tax_amount=0,
        pledge=pledge,
        issue_reward=issue_reward,
        order=order,
        balance_correlation_key="BALANCE_1",
        payment_transaction=payment_transaction,
    )

    await save_fixture(outgoing)
    await save_fixture(incoming)

    return outgoing, incoming


async def load_balance_transactions(
    session: AsyncSession,
    balance_transactions: tuple[Transaction, Transaction],
) -> tuple[Transaction, Transaction]:
    outgoing, incoming = balance_transactions

    load_options = (
        joinedload(Transaction.account),
        joinedload(Transaction.pledge),
        joinedload(Transaction.issue_reward),
        joinedload(Transaction.order),
    )

    loaded_outgoing = await session.get(Transaction, outgoing.id, options=load_options)
    loaded_incoming = await session.get(Transaction, incoming.id, options=load_options)

    assert loaded_outgoing is not None
    assert loaded_incoming is not None

    return loaded_outgoing, loaded_incoming


@pytest_asyncio.fixture
async def account_processor_fees(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Account:
    return await create_account(
        save_fixture, organization, user, processor_fees_applicable=True
    )


@pytest_asyncio.fixture
async def account_custom_fees(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Account:
    return await create_account(
        save_fixture,
        organization,
        user,
        processor_fees_applicable=True,
        fee_basis_points=389,
        fee_fixed=35,
    )


@pytest.mark.asyncio
class TestCreateFeesReversalBalances:
    async def test_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_processor_fees: Account,
        transaction_order_subscription: Order,
    ) -> None:
        balance_transactions = await create_balance_transactions(
            save_fixture,
            account=account_processor_fees,
            order=transaction_order_subscription,
        )

        balance_transactions = await load_balance_transactions(
            session, balance_transactions
        )
        outgoing, incoming = balance_transactions

        fees_reversal_balances = (
            await platform_fee_transaction_service.create_fees_reversal_balances(
                session, balance_transactions=balance_transactions
            )
        )

        assert len(fees_reversal_balances) == 2

        # Payment fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[0]

        assert reversal_outgoing.amount == -520
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.payment
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 520
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.payment
        assert reversal_incoming.incurred_by_transaction == outgoing

        # Subscription fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[1]

        assert reversal_outgoing.amount == -60
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.subscription
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 60
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.subscription
        assert reversal_incoming.incurred_by_transaction == outgoing

    async def test_subscription_with_custom_fees(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_custom_fees: Account,
        transaction_order_subscription: Order,
    ) -> None:
        balance_transactions = await create_balance_transactions(
            save_fixture,
            account=account_custom_fees,
            order=transaction_order_subscription,
        )

        balance_transactions = await load_balance_transactions(
            session, balance_transactions
        )
        outgoing, incoming = balance_transactions

        fees_reversal_balances = (
            await platform_fee_transaction_service.create_fees_reversal_balances(
                session, balance_transactions=balance_transactions
            )
        )

        assert len(fees_reversal_balances) == 2

        # Payment fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[0]

        assert reversal_outgoing.amount == -502
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.payment
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 502
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.payment
        assert reversal_incoming.incurred_by_transaction == outgoing

        # Subscription fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[1]

        assert reversal_outgoing.amount == -60
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.subscription
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 60
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.subscription
        assert reversal_incoming.incurred_by_transaction == outgoing

    async def test_international_payment(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_processor_fees: Account,
        transaction_order_subscription: Order,
    ) -> None:
        stripe_service_mock = MagicMock(spec=StripeService)
        mocker.patch(
            "polar.transaction.service.platform_fee.stripe_service",
            new=stripe_service_mock,
        )
        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {
                "id": "STRIPE_CHARGE_ID",
                "payment_method_details": {
                    "type": "card",
                    "card": {
                        "country": "FR",
                    },
                },
            },
            None,
        )

        balance_transactions = await create_balance_transactions(
            save_fixture,
            account=account_processor_fees,
            order=transaction_order_subscription,
            payment_charge_id="STRIPE_CHARGE_ID",
        )

        balance_transactions = await load_balance_transactions(
            session, balance_transactions
        )
        outgoing, incoming = balance_transactions

        fees_reversal_balances = (
            await platform_fee_transaction_service.create_fees_reversal_balances(
                session, balance_transactions=balance_transactions
            )
        )

        assert len(fees_reversal_balances) == 3

        # Payment fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[0]

        assert reversal_outgoing.amount == -520
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.payment
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 520
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.payment
        assert reversal_incoming.incurred_by_transaction == outgoing

        # International payment fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[1]

        assert reversal_outgoing.amount == -180
        assert reversal_outgoing.account == incoming.account
        assert (
            reversal_outgoing.platform_fee_type == PlatformFeeType.international_payment
        )
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 180
        assert reversal_incoming.account is None
        assert (
            reversal_incoming.platform_fee_type == PlatformFeeType.international_payment
        )
        assert reversal_incoming.incurred_by_transaction == outgoing

        # Subscription fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[2]

        assert reversal_outgoing.amount == -60
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.subscription
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 60
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.subscription
        assert reversal_incoming.incurred_by_transaction == outgoing

    async def test_link_payment(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_processor_fees: Account,
        transaction_order_subscription: Order,
    ) -> None:
        stripe_service_mock = MagicMock(spec=StripeService)
        mocker.patch(
            "polar.transaction.service.platform_fee.stripe_service",
            new=stripe_service_mock,
        )
        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {
                "id": "STRIPE_CHARGE_ID",
                "payment_method_details": {
                    "type": "link",
                    "link": {
                        "country": "US",
                    },
                },
            },
            None,
        )

        balance_transactions = await create_balance_transactions(
            save_fixture,
            account=account_processor_fees,
            order=transaction_order_subscription,
            payment_charge_id="STRIPE_CHARGE_ID",
        )

        # then
        session.expunge_all()

        balance_transactions = await load_balance_transactions(
            session, balance_transactions
        )
        outgoing, incoming = balance_transactions

        fees_reversal_balances = (
            await platform_fee_transaction_service.create_fees_reversal_balances(
                session, balance_transactions=balance_transactions
            )
        )

        assert len(fees_reversal_balances) == 2

        # Payment fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[0]

        assert reversal_outgoing.amount == -520
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.payment
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 520
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.payment
        assert reversal_incoming.incurred_by_transaction == outgoing

        # Subscription fee
        reversal_outgoing, reversal_incoming = fees_reversal_balances[1]

        assert reversal_outgoing.amount == -60
        assert reversal_outgoing.account == incoming.account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.subscription
        assert reversal_outgoing.incurred_by_transaction == incoming

        assert reversal_incoming.amount == 60
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.subscription
        assert reversal_incoming.incurred_by_transaction == outgoing


@pytest.mark.asyncio
class TestCreateDisputeFeesBalances:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_processor_fees: Account,
        transaction_order_subscription: Order,
    ) -> None:
        payment_balance_transactions = await create_balance_transactions(
            save_fixture,
            account=account_processor_fees,
            order=transaction_order_subscription,
            payment_charge_id="STRIPE_CHARGE_ID",
        )

        dispute_fee = Transaction(
            type=TransactionType.processor_fee,
            processor=Processor.stripe,
            processor_fee_type=ProcessorFeeType.dispute,
            currency="usd",
            amount=-1500,
            account_currency="usd",
            account_amount=-1500,
            tax_amount=0,
        )
        await save_fixture(dispute_fee)

        fees_balances = (
            await platform_fee_transaction_service.create_dispute_fees_balances(
                session,
                dispute_fees=[dispute_fee],
                balance_transactions=payment_balance_transactions,
            )
        )

        assert len(fees_balances) == 1

        fee_balances = fees_balances[0]
        reversal_outgoing, reversal_incoming = fee_balances

        assert reversal_outgoing.amount == -1500
        assert reversal_outgoing.account == payment_balance_transactions[1].account
        assert reversal_outgoing.platform_fee_type == PlatformFeeType.dispute
        assert (
            reversal_outgoing.incurred_by_transaction == payment_balance_transactions[1]
        )

        assert reversal_incoming.amount == 1500
        assert reversal_incoming.account is None
        assert reversal_incoming.platform_fee_type == PlatformFeeType.dispute
        assert (
            reversal_incoming.incurred_by_transaction == payment_balance_transactions[0]
        )


@pytest.mark.asyncio
class TestCreatePayoutFeesBalances:
    async def test_not_processor_fees_applicable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture,
            organization,
            user,
            processor_fees_applicable=False,
        )

        (
            balance_amount,
            payout_fees_balances,
        ) = await platform_fee_transaction_service.create_payout_fees_balances(
            session, account=account, balance_amount=10000
        )

        assert balance_amount == 10000
        assert payout_fees_balances == []

    async def test_not_stripe(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture,
            organization=organization,
            user=user,
            account_type=AccountType.manual,
        )

        # then
        session.expunge_all()

        (
            balance_amount,
            payout_fees_balances,
        ) = await platform_fee_transaction_service.create_payout_fees_balances(
            session, account=account, balance_amount=10000
        )

        assert balance_amount == 10000
        assert payout_fees_balances == []

    async def test_stripe_amount_too_low(
        self, session: AsyncSession, account_processor_fees: Account
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(PayoutAmountTooLow):
            await platform_fee_transaction_service.create_payout_fees_balances(
                session, account=account_processor_fees, balance_amount=1
            )

    @pytest.mark.parametrize(
        "payout_created_at", [None, datetime.now(UTC) - timedelta(days=31)]
    )
    async def test_stripe_no_last_payout(
        self,
        payout_created_at: datetime | None,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_processor_fees: Account,
    ) -> None:
        if payout_created_at is not None:
            payout_transaction = Transaction(
                created_at=payout_created_at,
                type=TransactionType.payout,
                processor=Processor.stripe,
                currency="usd",
                amount=-10000,
                account_currency="usd",
                account_amount=-10000,
                account=account_processor_fees,
                tax_amount=0,
            )
            await save_fixture(payout_transaction)

        # then
        session.expunge_all()

        (
            balance_amount,
            payout_fees_balances,
        ) = await platform_fee_transaction_service.create_payout_fees_balances(
            session, account=account_processor_fees, balance_amount=10000
        )

        assert len(payout_fees_balances) == 2

        account_fee_outgoing = payout_fees_balances[0][0]
        assert account_fee_outgoing.platform_fee_type == PlatformFeeType.account
        assert account_fee_outgoing.account == account_processor_fees

        payout_fee_outgoing = payout_fees_balances[1][0]
        assert payout_fee_outgoing.platform_fee_type == PlatformFeeType.payout
        assert payout_fee_outgoing.account == account_processor_fees

        assert (
            balance_amount
            == 10000 + account_fee_outgoing.amount + payout_fee_outgoing.amount
        )

    async def test_stripe_last_payout(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account_processor_fees: Account,
    ) -> None:
        payout_transaction = Transaction(
            created_at=datetime.now(UTC) - timedelta(days=7),
            type=TransactionType.payout,
            processor=Processor.stripe,
            currency="usd",
            amount=-10000,
            account_currency="usd",
            account_amount=-10000,
            account=account_processor_fees,
            tax_amount=0,
        )
        await save_fixture(payout_transaction)

        # then
        session.expunge_all()

        (
            balance_amount,
            payout_fees_balances,
        ) = await platform_fee_transaction_service.create_payout_fees_balances(
            session, account=account_processor_fees, balance_amount=10000
        )

        assert len(payout_fees_balances) == 1

        payout_fee_outgoing = payout_fees_balances[0][0]
        assert payout_fee_outgoing.platform_fee_type == PlatformFeeType.payout
        assert payout_fee_outgoing.account == account_processor_fees

        assert balance_amount == 10000 + payout_fee_outgoing.amount

    async def test_stripe_cross_border(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        account = await create_account(
            save_fixture,
            organization,
            user,
            country="FR",
            currency="eur",
            processor_fees_applicable=True,
        )

        # then
        session.expunge_all()

        (
            balance_amount,
            payout_fees_balances,
        ) = await platform_fee_transaction_service.create_payout_fees_balances(
            session, account=account, balance_amount=10000
        )

        assert len(payout_fees_balances) == 3

        account_fee_outgoing = payout_fees_balances[0][0]
        assert account_fee_outgoing.platform_fee_type == PlatformFeeType.account
        assert account_fee_outgoing.account == account

        cross_border_fee_outgoing = payout_fees_balances[1][0]
        assert (
            cross_border_fee_outgoing.platform_fee_type
            == PlatformFeeType.cross_border_transfer
        )
        assert cross_border_fee_outgoing.account == account

        payout_fee_outgoing = payout_fees_balances[2][0]
        assert payout_fee_outgoing.platform_fee_type == PlatformFeeType.payout
        assert payout_fee_outgoing.account == account

        assert (
            balance_amount
            == 10000
            + account_fee_outgoing.amount
            + cross_border_fee_outgoing.amount
            + payout_fee_outgoing.amount
        )
