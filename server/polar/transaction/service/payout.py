from collections.abc import Sequence
from typing import cast

import stripe as stripe_lib
import structlog
from sqlalchemy import select

from polar.enums import AccountType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.utils import generate_uuid
from polar.logging import Logger
from polar.models import Account, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.schemas import PayoutEstimate

from .base import BaseTransactionService, BaseTransactionServiceError
from .platform_fee import PayoutAmountTooLow
from .platform_fee import platform_fee_transaction as platform_fee_transaction_service
from .transaction import transaction as transaction_service

log: Logger = structlog.get_logger()


class PayoutTransactionError(BaseTransactionServiceError):
    ...


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


class PayoutTransactionService(BaseTransactionService):
    async def get_payout_estimate(
        self, session: AsyncSession, *, account: Account
    ) -> PayoutEstimate:
        if account.is_under_review():
            raise UnderReviewAccount(account)
        if not account.is_ready():
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
        if not account.is_ready():
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
            subscription=None,
            paid_transactions=[],
            incurred_transactions=[],
            account_incurred_transactions=[],
        )

        if account.account_type == AccountType.stripe:
            transaction = await self._create_stripe_payout(
                transaction=transaction, account=account
            )
        elif account.account_type == AccountType.open_collective:
            transaction.processor = PaymentProcessor.open_collective

        for balance_transaction in await self.get_unpaid_balance_transactions(
            session, account
        ):
            transaction.paid_transactions.append(balance_transaction)

        for outgoing, incoming in payout_fees_balances:
            transaction.incurred_transactions.append(outgoing)
            transaction.account_incurred_transactions.append(outgoing)
            transaction.incurred_transactions.append(incoming)

        session.add(transaction)
        await session.commit()

        return transaction

    async def _create_stripe_payout(
        self, *, transaction: Transaction, account: Account
    ) -> Transaction:
        transaction.processor = PaymentProcessor.stripe

        # Let's first make a transfer to the Stripe Connect account
        assert account.stripe_id is not None
        stripe_transfer = stripe_service.transfer(
            account.stripe_id,
            -transaction.amount,
            metadata={"payout_transaction_id": str(transaction.id)},
        )
        transaction.transfer_id = stripe_transfer.id

        # Different source and destination currencies: get the converted amount
        if transaction.currency != transaction.account_currency:
            assert stripe_transfer.destination_payment is not None
            stripe_destination_charge = stripe_service.get_charge(
                get_expandable_id(stripe_transfer.destination_payment),
                stripe_account=account.stripe_id,
                expand=["balance_transaction"],
            )
            stripe_destination_balance_transaction = cast(
                stripe_lib.BalanceTransaction,
                stripe_destination_charge.balance_transaction,
            )
            transaction.account_amount = -stripe_destination_balance_transaction.amount
            log.info(
                (
                    "Source and destination currency don't match. "
                    "A conversion has been done by Stripe."
                ),
                source_currency=transaction.currency,
                destination_currency=transaction.account_currency,
                source_amount=transaction.amount,
                destination_amount=transaction.account_amount,
                exchange_rate=stripe_destination_balance_transaction.exchange_rate,
                account_id=str(account.id),
            )

        # Trigger a payout on the Stripe Connect account
        stripe_payout = stripe_service.create_payout(
            stripe_account=account.stripe_id,
            amount=-transaction.account_amount,
            currency=transaction.account_currency,
            metadata={
                "stripe_transfer_id": stripe_transfer.id,
                "payout_transaction_id": str(transaction.id),
            },
        )
        transaction.payout_id = stripe_payout.id

        return transaction

    async def get_unpaid_balance_transactions(
        self, session: AsyncSession, account: Account
    ) -> Sequence[Transaction]:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.balance,
            Transaction.account_id == account.id,
            Transaction.payout_transaction_id.is_(None),
        )
        result = await session.execute(statement)
        return result.scalars().all()


payout_transaction = PayoutTransactionService(Transaction)
