import math
from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.account.service import account as account_service
from polar.config import settings
from polar.logging import Logger
from polar.models import Transaction
from polar.models.transaction import PlatformFeeType
from polar.postgres import AsyncSession

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError

log: Logger = structlog.get_logger()


def _round_stripe(amount: float) -> int:
    return math.ceil(amount) if amount - int(amount) >= 0.5 else math.floor(amount)


def _get_stripe_subscription_fee(amount: int) -> int:
    return _round_stripe(amount * 0.005)


def _get_stripe_invoice_fee(amount: int) -> int:
    return _round_stripe(amount * 0.005)


class PlatformFeeTransactionError(BaseTransactionServiceError):
    ...


class DanglingBalanceTransactions(PlatformFeeTransactionError):
    def __init__(self, balance_transactions: tuple[Transaction, Transaction]) -> None:
        self.balance_transactions = balance_transactions
        message = "Balance transactions not linked to a pledge or subscription."
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

    async def _create_platform_fee(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> tuple[Transaction, Transaction]:
        outgoing, incoming = balance_transactions

        if incoming.pledge_id is not None and incoming.issue_reward_id is not None:
            fee_amount = math.floor(
                incoming.amount * (settings.PLEDGE_FEE_PERCENT / 100)
            )
        elif incoming.subscription_id is not None:
            fee_amount = math.floor(
                incoming.amount * (settings.SUBSCRIPTION_FEE_PERCENT / 100)
            )
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
            invoice_fee_amount = _get_stripe_invoice_fee(incoming.amount)
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
            subscription_fee_amount = _get_stripe_subscription_fee(incoming.amount)
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


platform_fee_transaction = PlatformFeeTransactionService(Transaction)
