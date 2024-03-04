import datetime
import math
from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.logging import Logger
from polar.models import Account, Transaction
from polar.models.transaction import PlatformFeeType, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.fees.stripe import (
    get_reverse_stripe_payout_fees,
    get_stripe_account_fee,
    get_stripe_invoice_fee,
    get_stripe_subscription_fee,
)

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError

log: Logger = structlog.get_logger()


class PlatformFeeTransactionError(BaseTransactionServiceError):
    ...


class DanglingBalanceTransactions(PlatformFeeTransactionError):
    def __init__(self, balance_transactions: tuple[Transaction, Transaction]) -> None:
        self.balance_transactions = balance_transactions
        message = "Balance transactions not linked to a pledge or subscription."
        super().__init__(message)


class PayoutAmountTooLow(PlatformFeeTransactionError):
    def __init__(self, balance_amount: int) -> None:
        self.balance_amount = balance_amount
        message = "Fees are higher than the amount to be paid out."
        super().__init__(message)


class PlatformFeeTransactionService(BaseTransactionService):
    async def create_fees_reversal_balances(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        fees_reversal_balances: list[tuple[Transaction, Transaction]] = []

        # Platform fee
        platform_fees_balances = await self._create_platform_fee(
            session, balance_transactions=balance_transactions
        )
        fees_reversal_balances.append(platform_fees_balances)

        # Payment processor fees
        payment_processor_fees_balances = await self._create_payment_processor_fees(
            session, balance_transactions=balance_transactions
        )
        fees_reversal_balances += payment_processor_fees_balances

        return fees_reversal_balances

    async def get_payout_fees(
        self, session: AsyncSession, *, account: Account, balance_amount: int
    ) -> list[tuple[PlatformFeeType, int]]:
        if not account.processor_fees_applicable:
            return []

        if account.account_type != AccountType.stripe:
            return []

        payout_fees: list[tuple[PlatformFeeType, int]] = []

        last_payout = await self._get_last_payout(session, account)
        if last_payout is None:
            account_fee_amount = get_stripe_account_fee()
            balance_amount -= account_fee_amount
            payout_fees.append((PlatformFeeType.account, account_fee_amount))

        try:
            transfer_fee_amount, payout_fee_amount = get_reverse_stripe_payout_fees(
                balance_amount, account.country
            )
        except ValueError as e:
            raise PayoutAmountTooLow(balance_amount) from e

        if transfer_fee_amount > 0:
            payout_fees.append(
                (PlatformFeeType.cross_border_transfer, transfer_fee_amount)
            )

        if payout_fee_amount > 0:
            payout_fees.append((PlatformFeeType.payout, payout_fee_amount))

        return payout_fees

    async def create_payout_fees_balances(
        self, session: AsyncSession, *, account: Account, balance_amount: int
    ) -> tuple[int, list[tuple[Transaction, Transaction]]]:
        payout_fees = await self.get_payout_fees(
            session, account=account, balance_amount=balance_amount
        )

        payout_fees_balances: list[tuple[Transaction, Transaction]] = []
        for payout_fee_type, fee_amount in payout_fees:
            fee_balances = await balance_transaction_service.create_balance(
                session,
                source_account=account,
                destination_account=None,
                amount=fee_amount,
                platform_fee_type=payout_fee_type,
            )
            payout_fees_balances.append(fee_balances)
            balance_amount -= fee_amount

        return balance_amount, payout_fees_balances

    async def _create_platform_fee(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> tuple[Transaction, Transaction]:
        outgoing, incoming = balance_transactions
        account = incoming.account
        assert account is not None

        if incoming.pledge_id is not None and incoming.issue_reward_id is not None:
            fee_percent = account.platform_pledge_fee_percent
            fee_amount = math.floor(incoming.amount * (fee_percent / 100))
        elif incoming.subscription_id is not None:
            fee_percent = account.platform_subscription_fee_percent
            fee_amount = math.floor(incoming.amount * (fee_percent / 100))
        else:
            raise DanglingBalanceTransactions(balance_transactions)

        return await balance_transaction_service.create_reversal_balance(
            session,
            balance_transactions=balance_transactions,
            destination_currency=outgoing.currency,
            amount=fee_amount,
            platform_fee_type=PlatformFeeType.platform,
            outgoing_incurred_by=incoming,
            incoming_incurred_by=outgoing,
        )

    async def _create_payment_processor_fees(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        outgoing, incoming = balance_transactions

        assert incoming.account_id is not None
        account = await account_service.get_by_id(session, incoming.account_id)
        assert account is not None

        if not account.processor_fees_applicable:
            return []

        payment_processor_fees_balances: list[tuple[Transaction, Transaction]] = []

        # Payment fee
        if incoming.payment_transaction_id is not None:
            incurred_fees = await self._get_incurred_fee_transactions(
                session, incoming.payment_transaction_id
            )
            for incurred_fee in incurred_fees:
                fee_balances = (
                    await balance_transaction_service.create_reversal_balance(
                        session,
                        balance_transactions=balance_transactions,
                        destination_currency=outgoing.currency,
                        amount=-incurred_fee.amount,
                        platform_fee_type=PlatformFeeType.payment,
                        outgoing_incurred_by=incoming,
                        incoming_incurred_by=outgoing,
                    )
                )
                payment_processor_fees_balances.append(fee_balances)

        # Invoice fee
        pledge = incoming.pledge
        if pledge is not None and pledge.invoice_id is not None:
            invoice_fee_amount = get_stripe_invoice_fee(incoming.amount)
            fee_balances = await balance_transaction_service.create_reversal_balance(
                session,
                balance_transactions=balance_transactions,
                destination_currency=outgoing.currency,
                amount=invoice_fee_amount,
                platform_fee_type=PlatformFeeType.invoice,
                outgoing_incurred_by=incoming,
                incoming_incurred_by=outgoing,
            )
            payment_processor_fees_balances.append(fee_balances)

        # Subscription fee
        if incoming.subscription_id is not None:
            subscription_fee_amount = get_stripe_subscription_fee(incoming.amount)
            fee_balances = await balance_transaction_service.create_reversal_balance(
                session,
                balance_transactions=balance_transactions,
                destination_currency=outgoing.currency,
                amount=subscription_fee_amount,
                platform_fee_type=PlatformFeeType.subscription,
                outgoing_incurred_by=incoming,
                incoming_incurred_by=outgoing,
            )
            payment_processor_fees_balances.append(fee_balances)

        return payment_processor_fees_balances

    async def _get_incurred_fee_transactions(
        self, session: AsyncSession, transaction_id: UUID
    ) -> Sequence[Transaction]:
        statement = select(Transaction).where(
            Transaction.incurred_by_transaction_id == transaction_id
        )
        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_last_payout(
        self, session: AsyncSession, account: Account
    ) -> Transaction | None:
        statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.payout,
                Transaction.account_id == account.id,
                Transaction.created_at
                > datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30),
            )
            .limit(1)
            .order_by(Transaction.created_at.desc())
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()


platform_fee_transaction = PlatformFeeTransactionService(Transaction)
