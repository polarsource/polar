from collections.abc import AsyncIterable, Sequence
from datetime import timedelta
from typing import cast

import stripe as stripe_lib
import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from polar.account.service import account as account_service
from polar.config import settings
from polar.enums import AccountType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.csv import IterableCSVWriter
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.utils import generate_uuid, utc_now
from polar.logging import Logger
from polar.models import Account, Issue, Order, Pledge, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.schemas import PayoutEstimate
from polar.worker import enqueue_job

from .base import BaseTransactionService, BaseTransactionServiceError
from .platform_fee import PayoutAmountTooLow
from .platform_fee import platform_fee_transaction as platform_fee_transaction_service
from .transaction import transaction as transaction_service

log: Logger = structlog.get_logger()


class PayoutTransactionError(BaseTransactionServiceError): ...


class InsufficientBalance(PayoutTransactionError):
    def __init__(self, account: Account, balance: int) -> None:
        self.account = account
        self.balance = balance
        message = (
            f"The account {account.id} has an insufficient balance "
            f"of {balance} to make a payout."
        )
        super().__init__(message)


class UnderReviewAccount(PayoutTransactionError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = f"The account {account.id} is under review and can't receive payouts."
        super().__init__(message)


class NotReadyAccount(PayoutTransactionError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = (
            f"The account {account.id} is not ready."
            f"The owner should go through the onboarding on {account.account_type}"
        )
        super().__init__(message)


class UnmatchingTransfersAmount(PayoutTransactionError):
    def __init__(self, payout_amount: int, transfers_amount: int) -> None:
        self.payout_amount = payout_amount
        self.transfers_amount = transfers_amount
        message = (
            "Can't split the balance transactions into transfers "
            "equal to the payout amount. "
            f"Expected {payout_amount} but got {transfers_amount}. "
            f"Difference: {payout_amount - transfers_amount}"
        )
        super().__init__(message)


class StripePayoutNotPaid(PayoutTransactionError):
    def __init__(self, payout_id: str) -> None:
        self.payout_id = payout_id
        message = "This Stripe payout is not paid, can't write it to transactions."
        super().__init__(message)


class UnknownAccount(PayoutTransactionError):
    def __init__(self, stripe_account_id: str) -> None:
        self.stripe_account_id = stripe_account_id
        message = (
            "Received a payout event for an "
            f"unknown Stripe account {stripe_account_id}"
        )
        super().__init__(message)


class PayoutTransactionService(BaseTransactionService):
    async def get_payout_estimate(
        self, session: AsyncSession, *, account: Account
    ) -> PayoutEstimate:
        if account.is_under_review():
            raise UnderReviewAccount(account)
        if not account.is_payout_ready():
            raise NotReadyAccount(account)

        balance_amount = await transaction_service.get_transactions_sum(
            session, account.id
        )
        if balance_amount <= 0:
            raise InsufficientBalance(account, balance_amount)

        try:
            payout_fees = await platform_fee_transaction_service.get_payout_fees(
                session, account=account, balance_amount=balance_amount
            )
        except PayoutAmountTooLow as e:
            raise InsufficientBalance(account, balance_amount) from e

        return PayoutEstimate(
            account_id=account.id,
            gross_amount=balance_amount,
            fees_amount=sum(fee for _, fee in payout_fees),
            net_amount=balance_amount - sum(fee for _, fee in payout_fees),
        )

    async def create_payout(
        self, session: AsyncSession, *, account: Account
    ) -> Transaction:
        if account.is_under_review():
            raise UnderReviewAccount(account)
        if not account.is_payout_ready():
            raise NotReadyAccount(account)

        balance_amount = await transaction_service.get_transactions_sum(
            session, account.id
        )
        if balance_amount <= 0:
            raise InsufficientBalance(account, balance_amount)

        try:
            (
                balance_amount_after_fees,
                payout_fees_balances,
            ) = await platform_fee_transaction_service.create_payout_fees_balances(
                session, account=account, balance_amount=balance_amount
            )
        except PayoutAmountTooLow as e:
            raise InsufficientBalance(account, balance_amount) from e

        transaction = Transaction(
            id=generate_uuid(),
            type=TransactionType.payout,
            currency="usd",  # FIXME: Main Polar currency
            amount=-balance_amount_after_fees,
            account_currency=account.currency,
            account_amount=-balance_amount_after_fees,
            tax_amount=0,
            account=account,
            pledge=None,
            issue_reward=None,
            order=None,
            paid_transactions=[],
            incurred_transactions=[],
            account_incurred_transactions=[],
        )

        unpaid_balance_transactions = await self._get_unpaid_balance_transactions(
            session, account
        )

        if account.account_type == AccountType.stripe:
            transaction = await self._prepare_stripe_payout(
                session,
                transaction=transaction,
                account=account,
                unpaid_balance_transactions=unpaid_balance_transactions,
            )
        elif account.account_type == AccountType.open_collective:
            transaction.processor = PaymentProcessor.open_collective

        for balance_transaction in unpaid_balance_transactions:
            transaction.paid_transactions.append(balance_transaction)

        for outgoing, incoming in payout_fees_balances:
            transaction.incurred_transactions.append(outgoing)
            transaction.account_incurred_transactions.append(outgoing)
            transaction.incurred_transactions.append(incoming)

        session.add(transaction)
        await session.flush()

        enqueue_job("payout.created", payout_id=transaction.id)

        return transaction

    async def trigger_stripe_payouts(self, session: AsyncSession) -> None:
        """
        The Stripe payout is a two-steps process:

        1. Transfer the balance transactions to the Stripe Connect account.
        2. Trigger a payout on the Stripe Connect account,
        but later once our safety delay is passed and the balance is actually available.

        This function performs the second step and tries to trigger pending payouts,
        if balance is available.
        """
        for payout in await self._get_pending_stripe_payouts(session):
            enqueue_job("payout.trigger_stripe_payout", payout_id=payout.id)

    async def trigger_stripe_payout(
        self, session: AsyncSession, payout: Transaction
    ) -> Transaction:
        assert payout.account_id is not None
        account = await account_service.get(session, payout.account_id)
        assert account is not None
        assert account.stripe_id is not None
        _, balance = await stripe_service.retrieve_balance(account.stripe_id)

        if balance < -payout.account_amount:
            log.info(
                (
                    "The Stripe Connect account doesn't have enough balance "
                    "to make the payout yet"
                ),
                account_id=str(account.id),
                balance=balance,
                payout_amount=-payout.account_amount,
            )
            return payout

        # Trigger a payout on the Stripe Connect account
        stripe_payout = await stripe_service.create_payout(
            stripe_account=account.stripe_id,
            amount=-payout.account_amount,
            currency=payout.account_currency,
            metadata={
                "payout_transaction_id": str(payout.id),
            },
        )
        payout.payout_id = stripe_payout.id

        session.add(payout)

        return payout

    async def create_payout_from_stripe(
        self,
        session: AsyncSession,
        *,
        payout: stripe_lib.Payout,
        stripe_account_id: str,
    ) -> Transaction:
        """
        Legacy behavior from the time when Stripe issued payouts automatically.

        It should be safe to remove this and the associated task in the future.
        """
        bound_logger = log.bind(
            stripe_account_id=stripe_account_id, payout_id=payout.id
        )

        if payout.status != "paid":
            raise StripePayoutNotPaid(payout.id)

        account = await account_service.get_by_stripe_id(session, stripe_account_id)
        if account is None:
            raise UnknownAccount(stripe_account_id)

        existing_payout_transaction = await self._get_payout_transaction(
            session, payout.id
        )
        if existing_payout_transaction is not None:
            return existing_payout_transaction

        transaction = Transaction(
            type=TransactionType.payout,
            processor=PaymentProcessor.stripe,
            currency="usd",  # FIXME: Main Polar currency
            amount=0,
            account_currency=payout.currency,
            account_amount=-payout.amount,  # Subtract the amount from the balance
            tax_amount=0,
            payout_id=payout.id,
            account=account,
        )

        # Retrieve and mark all transactions paid by this payout
        balance_transactions = await stripe_service.list_balance_transactions(
            account_id=account.stripe_id, payout=payout.id
        )
        async for balance_transaction in balance_transactions:
            source = balance_transaction.source
            if source is not None:
                source_transfer: str | None = getattr(source, "source_transfer", None)
                if source_transfer is not None:
                    paid_transactions_statement = select(Transaction).where(
                        Transaction.transfer_id == source_transfer,
                        Transaction.account_id == account.id,
                    )
                    paid_transactions = await session.stream_scalars(
                        paid_transactions_statement
                    )
                    async for paid_transaction in paid_transactions:
                        paid_transaction.payout_transaction = transaction
                        session.add(paid_transaction)

                        # Compute the amount in our main currency
                        transaction.currency = paid_transaction.currency
                        transaction.amount -= paid_transaction.amount
                else:
                    bound_logger.warning(
                        "An unknown type of transaction was paid out",
                        source_id=get_expandable_id(source),
                    )

        session.add(transaction)
        await session.flush()

        return transaction

    async def get_payout_csv(
        self, sessionmaker: AsyncSessionMaker, *, account: Account, payout: Transaction
    ) -> AsyncIterable[str]:
        statement = (
            select(Transaction)
            .where(
                Transaction.payout_transaction_id == payout.id,
                Transaction.account_id == account.id,
            )
            .order_by(Transaction.created_at)
            .options(
                # Order
                selectinload(Transaction.order).joinedload(Order.product),
                # Pledge
                selectinload(Transaction.pledge)
                .joinedload(Pledge.issue)
                .options(
                    joinedload(Issue.organization),
                    joinedload(Issue.repository),
                ),
            )
        )

        csv_writer = IterableCSVWriter(dialect="excel")
        yield csv_writer.getrow(
            (
                "Date",
                "Payout ID",
                "Transaction ID",
                "Description",
                "Currency",
                "Amount",
                "Payout Total",
                "Account Currency",
                "Account Payout Total",
            )
        )

        # StreamingResponse is running its own async task to exhaust the iterator
        # Thus, rely on the main session generated by the FastAPI dependency leads to
        # garbage collection problems.
        # We create a new session to avoid this.
        async with sessionmaker() as session:
            transactions = await session.stream_scalars(statement)
            async for transaction in transactions:
                description = ""
                if transaction.platform_fee_type is not None:
                    if transaction.platform_fee_type == "platform":
                        description = "Polar fee"
                    else:
                        description = (
                            f"Payment processor fee ({transaction.platform_fee_type})"
                        )
                elif transaction.pledge is not None:
                    description = f"Pledge to {transaction.pledge.issue.reference_key}"
                elif transaction.order is not None:
                    product = transaction.order.product
                    if transaction.order.subscription_id is not None:
                        description = f"Subscription to {product.name}"
                    else:
                        description = f"Order of {product.name}"

                transaction_id = (
                    str(transaction.id)
                    if transaction.incurred_by_transaction_id is None
                    else str(transaction.incurred_by_transaction_id)
                )

                yield csv_writer.getrow(
                    (
                        transaction.created_at.isoformat(),
                        str(payout.id),
                        transaction_id,
                        description,
                        transaction.currency,
                        transaction.amount / 100,
                        abs(payout.amount / 100),
                        account.currency,
                        abs(payout.account_amount / 100),
                    )
                )

    async def _prepare_stripe_payout(
        self,
        session: AsyncSession,
        *,
        transaction: Transaction,
        account: Account,
        unpaid_balance_transactions: Sequence[Transaction],
    ) -> Transaction:
        """
        The Stripe payout is a two-steps process:

        1. Transfer the balance transactions to the Stripe Connect account.
        2. Trigger a payout on the Stripe Connect account,
        but later once the balance is actually available.

        This function performs the first step and returns the transaction
        with an empty payout_id.
        """
        transaction.processor = PaymentProcessor.stripe
        transfer_group = str(transaction.id)

        # Balances that we'll be able to pull money from
        payment_balance_transactions = [
            balance_transaction
            for balance_transaction in unpaid_balance_transactions
            if balance_transaction.payment_transaction is not None
            and balance_transaction.payment_transaction.charge_id is not None
        ]

        # Balances that are not tied to a payment. Typically, this is:
        # * Payout fees we just created
        # * Refunds that have been issued after the payment has been paid out
        outstanding_balance_transactions = [
            balance_transaction
            for balance_transaction in unpaid_balance_transactions
            if balance_transaction not in payment_balance_transactions
            and balance_transaction.balance_reversal_transaction
            not in payment_balance_transactions
        ]

        # This is the amount we should subtract from the total transfer
        outstanding_amount = abs(
            sum(
                balance_transaction.amount
                for balance_transaction in outstanding_balance_transactions
            )
        )

        # Compute transfers out of each payment balance, making sure to subtract the outstanding amount
        transfers: list[tuple[str, int, Transaction]] = []
        for balance_transaction in payment_balance_transactions:
            assert balance_transaction.payment_transaction is not None
            assert balance_transaction.payment_transaction.charge_id is not None
            source_transaction = balance_transaction.payment_transaction.charge_id
            transfer_amount = max(
                balance_transaction.transferable_amount - outstanding_amount, 0
            )
            if transfer_amount > 0:
                transfers.append(
                    (source_transaction, transfer_amount, balance_transaction)
                )
            outstanding_amount -= (
                balance_transaction.transferable_amount - transfer_amount
            )

        # Make sure the expected amount of the payout actually matches the sum of the transfers
        transfers_sum = sum(amount for _, amount, _ in transfers)
        if transfers_sum != -transaction.amount:
            raise UnmatchingTransfersAmount(-transaction.amount, transfers_sum)

        # If the account currency is different from the transaction currency,
        # Set the account amount to 0 and get the converted amount when making transfers
        if transaction.currency != transaction.account_currency:
            transaction.account_amount = 0

        # Make individual transfers with the payment transaction as source
        assert account.stripe_id is not None
        for source_transaction, amount, balance_transaction in transfers:
            if balance_transaction.transfer_id is None:
                stripe_transfer = await stripe_service.transfer(
                    account.stripe_id,
                    amount,
                    source_transaction=source_transaction,
                    # transfer_group=transfer_group,
                    metadata={"payout_transaction_id": str(transaction.id)},
                )
                balance_transaction.transfer_id = stripe_transfer.id

                # Immediately commit the transfer_id: it's now effective in Stripe,
                # we don't want to lose it
                session.add(balance_transaction)
                await session.commit()
            # Case where the transfer has already been made
            # Legacy behavior from the time when we automatically
            # transferred each balance
            else:
                stripe_transfer = await stripe_service.get_transfer(
                    balance_transaction.transfer_id
                )
                await stripe_service.update_transfer(
                    stripe_transfer.id,
                    metadata={"payout_transaction_id": str(transaction.id)},
                )

            # Different source and destination currencies: get the converted amount
            if transaction.currency != transaction.account_currency:
                assert stripe_transfer.destination_payment is not None
                stripe_destination_charge = await stripe_service.get_charge(
                    get_expandable_id(stripe_transfer.destination_payment),
                    stripe_account=account.stripe_id,
                    expand=["balance_transaction"],
                )
                stripe_destination_balance_transaction = cast(
                    stripe_lib.BalanceTransaction,
                    stripe_destination_charge.balance_transaction,
                )
                transaction.account_amount -= (
                    stripe_destination_balance_transaction.amount
                )
                log.info(
                    (
                        "Source and destination currency don't match. "
                        "A conversion has been done by Stripe."
                    ),
                    source_currency=transaction.currency,
                    destination_currency=transaction.account_currency,
                    source_amount=amount,
                    destination_amount=stripe_destination_balance_transaction.amount,
                    exchange_rate=stripe_destination_balance_transaction.exchange_rate,
                    account_id=str(account.id),
                )

        return transaction

    async def _get_unpaid_balance_transactions(
        self, session: AsyncSession, account: Account
    ) -> Sequence[Transaction]:
        statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.balance,
                Transaction.account_id == account.id,
                Transaction.payout_transaction_id.is_(None),
            )
            .options(
                selectinload(Transaction.balance_reversal_transaction),
                selectinload(Transaction.balance_reversal_transactions),
                selectinload(Transaction.payment_transaction),
            )
        )
        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_pending_stripe_payouts(
        self, session: AsyncSession, delay: timedelta = settings.ACCOUNT_PAYOUT_DELAY
    ) -> Sequence[Transaction]:
        statement = (
            select(Transaction)
            .distinct(Transaction.account_id)
            .where(
                Transaction.type == TransactionType.payout,
                Transaction.processor == PaymentProcessor.stripe,
                Transaction.payout_id.is_(None),
                Transaction.created_at < utc_now() - delay,
            )
            .options(joinedload(Transaction.account))
            .order_by(Transaction.account_id, Transaction.created_at)
        )
        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_payout_transaction(
        self, session: AsyncSession, payout_id: str
    ) -> Transaction | None:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.payout,
            Transaction.payout_id == payout_id,
        )
        result = await session.execute(statement)
        return result.scalar()


payout_transaction = PayoutTransactionService(Transaction)
