from collections.abc import Iterable

import structlog

from polar.enums import AccountType
from polar.kit.utils import generate_uuid
from polar.logging import Logger
from polar.models import Payout, Transaction
from polar.models.transaction import PlatformFeeType, Processor, TransactionType
from polar.postgres import AsyncSession

from ..repository import BalanceTransactionRepository, PayoutTransactionRepository
from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService

log: Logger = structlog.get_logger()


class PayoutTransactionService(BaseTransactionService):
    async def create(
        self,
        session: AsyncSession,
        payout: Payout,
        fees_balances: Iterable[tuple[Transaction, Transaction]],
    ) -> Transaction:
        account = payout.account
        transaction = Transaction(
            id=generate_uuid(),
            type=TransactionType.payout,
            processor=Processor.stripe,
            currency=payout.currency,
            amount=-payout.amount,
            account_currency=payout.account_currency,
            account_amount=-payout.account_amount,
            tax_amount=0,
            account=account,
            pledge=None,
            issue_reward=None,
            order=None,
            paid_transactions=[],
            incurred_transactions=[],
            account_incurred_transactions=[],
            payout=payout,
        )

        balance_transaction_repository = BalanceTransactionRepository.from_session(
            session
        )
        unpaid_balance_transactions = (
            await balance_transaction_repository.get_all_unpaid_by_account(account.id)
        )

        if account.account_type == AccountType.stripe:
            transaction.processor = Processor.stripe
        elif account.account_type == AccountType.open_collective:
            transaction.processor = Processor.open_collective
        elif account.account_type == AccountType.manual:
            transaction.processor = Processor.manual

        for balance_transaction in unpaid_balance_transactions:
            transaction.paid_transactions.append(balance_transaction)

        for outgoing, incoming in fees_balances:
            transaction.incurred_transactions.append(outgoing)
            transaction.account_incurred_transactions.append(outgoing)
            transaction.incurred_transactions.append(incoming)

        repository = PayoutTransactionRepository.from_session(session)
        return await repository.create(transaction, flush=True)

    async def reverse(
        self,
        session: AsyncSession,
        payout_transaction: Transaction,
        *,
        reason: str,
    ) -> Transaction:
        """
        Reverse a payout transaction due to ACH return or other failure.

        This creates offsetting balance entries that return funds to the user's account.
        The original payout transaction remains in the ledger for audit purposes,
        with a new reversal transaction linked to it.

        Args:
            session: Database session
            payout_transaction: The original payout transaction to reverse
            reason: Reason for the reversal (e.g., "ACH Return R01")

        Returns:
            The reversal transaction
        """
        account = payout_transaction.account
        if account is None:
            raise ValueError("Payout transaction has no associated account")

        # Create reversal transaction (opposite sign of original)
        reversal = Transaction(
            id=generate_uuid(),
            type=TransactionType.payout,  # Same type, but positive amount
            processor=payout_transaction.processor,
            currency=payout_transaction.currency,
            amount=-payout_transaction.amount,  # Reverse the negative to positive
            account_currency=payout_transaction.account_currency,
            account_amount=-payout_transaction.account_amount,
            tax_amount=0,
            account=account,
            balance_reversal_transaction=payout_transaction,  # Link to original
        )

        session.add(reversal)

        # Also reverse any fee transactions that were incurred
        for incurred in payout_transaction.incurred_transactions:
            if incurred.account_id is not None:
                # This is a fee that was charged to the user's account
                fee_reversal = Transaction(
                    id=generate_uuid(),
                    type=TransactionType.balance,
                    currency=incurred.currency,
                    amount=-incurred.amount,
                    account_currency=incurred.account_currency,
                    account_amount=-incurred.account_amount,
                    tax_amount=0,
                    account_id=incurred.account_id,
                    platform_fee_type=incurred.platform_fee_type,
                    balance_reversal_transaction=incurred,
                    incurred_by_transaction=reversal,
                )
                session.add(fee_reversal)

        await session.flush()

        log.info(
            "payout_transaction.reversed",
            original_id=str(payout_transaction.id),
            reversal_id=str(reversal.id),
            amount=reversal.amount,
            reason=reason,
        )

        return reversal


payout_transaction = PayoutTransactionService(Transaction)
