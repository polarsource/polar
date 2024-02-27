import math

import structlog

from polar.config import settings
from polar.logging import Logger
from polar.models import Transaction
from polar.models.transaction import PlatformFeeType
from polar.postgres import AsyncSession

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


class PlatformFeeTransactionService(BaseTransactionService):
    async def create_fees_reversal_balances(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        fees_reversal_balances: list[tuple[Transaction, Transaction]] = []

        platform_fees_balances = await self._create_platform_fee(
            session, balance_transactions=balance_transactions
        )
        fees_reversal_balances.append(platform_fees_balances)

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


platform_fee_transaction = PlatformFeeTransactionService(Transaction)
