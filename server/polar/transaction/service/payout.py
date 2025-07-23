import asyncio
import random
from collections.abc import Iterable
from typing import cast

import stripe as stripe_lib
import structlog

from polar.enums import AccountType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.utils import generate_uuid
from polar.logging import Logger
from polar.models import Account, Payout, Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession

from ..repository import BalanceTransactionRepository, PayoutTransactionRepository
from .base import BaseTransactionService, BaseTransactionServiceError

log: Logger = structlog.get_logger()


class PayoutTransactionError(BaseTransactionServiceError): ...


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


class TransferError(PayoutTransactionError):
    def __init__(self) -> None:
        super().__init__(
            "An error occurred while creating the transfer. Please contact us."
        )


payout_transfer_semaphore = asyncio.Semaphore(8)


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
            transaction = await self._prepare_stripe_payout(
                session,
                account,
                payout,
                transaction,
                unpaid_balance_transactions,
            )
        elif account.account_type == AccountType.open_collective:
            transaction.processor = Processor.open_collective

        for balance_transaction in unpaid_balance_transactions:
            transaction.paid_transactions.append(balance_transaction)

        for outgoing, incoming in fees_balances:
            transaction.incurred_transactions.append(outgoing)
            transaction.account_incurred_transactions.append(outgoing)
            transaction.incurred_transactions.append(incoming)

        repository = PayoutTransactionRepository.from_session(session)
        return await repository.create(transaction, flush=True)

    async def _prepare_stripe_payout(
        self,
        session: AsyncSession,
        account: Account,
        payout: Payout,
        transaction: Transaction,
        unpaid_balance_transactions: Iterable[Transaction],
    ) -> Transaction:
        """
        The Stripe payout is a two-steps process:

        1. Transfer the balance transactions to the Stripe Connect account.
        2. Trigger a payout on the Stripe Connect account,
        but later once the balance is actually available.

        This function performs the first step.
        """

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

        # Sort payment_balance_transactions by increasing transferable amount
        # This way, if we have negative transferrable amount, they'll increase the outstanding amount
        # and be compensated by the positive transferrable amounts coming after
        payment_balance_transactions.sort(
            key=lambda balance_transaction: balance_transaction.transferable_amount
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
        transfer_tasks: list[asyncio.Task[tuple[Transaction, int | None]]] = []
        for source_transaction, amount, balance_transaction in transfers:
            task = asyncio.create_task(
                self._create_stripe_transfer(
                    account,
                    transaction,
                    {
                        "payout_id": str(payout.id),
                        "payout_transaction_id": str(transaction.id),
                    },
                    source_transaction,
                    amount,
                    balance_transaction,
                )
            )
            transfer_tasks.append(task)

        transfer_results = await asyncio.gather(*transfer_tasks, return_exceptions=True)
        error = False
        for transfer_result in transfer_results:
            if isinstance(transfer_result, BaseException):
                log.error(
                    "Error while creating transfer",
                    error=transfer_result,
                    account_id=account.id,
                    payout_id=payout.id,
                    transaction_id=transaction.id,
                )
                error = True
                continue

            balance_transaction, transfer_account_amount = transfer_result
            session.add(balance_transaction)
            if transaction.currency != transaction.account_currency:
                assert transfer_account_amount is not None
                transaction.account_amount -= transfer_account_amount

        if error:
            # Put the account under review to make sure the user doesn't try to create another payout
            # since we'll need a manual operation to fix the issue
            account.status = Account.Status.UNDER_REVIEW
            session.add(account)
            # Commit, because we don't want to lose the transfers we created
            await session.commit()
            raise TransferError()

        return transaction

    async def _create_stripe_transfer(
        self,
        account: Account,
        transaction: Transaction,
        metadata: dict[str, str],
        source_transaction: str,
        amount: int,
        balance_transaction: Transaction,
        *,
        retry: int = 0,
    ) -> tuple[Transaction, int | None]:
        try:
            # We use a semaphore to limit the number of concurrent requests to Stripe
            async with payout_transfer_semaphore:
                if balance_transaction.transfer_id is None:
                    assert account.stripe_id is not None
                    stripe_transfer = await stripe_service.transfer(
                        account.stripe_id,
                        amount,
                        source_transaction=source_transaction,
                        metadata=metadata,
                    )
                    balance_transaction.transfer_id = stripe_transfer.id
                # Case where the transfer has already been made
                # Legacy behavior from the time when we automatically
                # transferred each balance
                else:
                    stripe_transfer = await stripe_service.get_transfer(
                        balance_transaction.transfer_id
                    )
                    await stripe_service.update_transfer(
                        stripe_transfer.id, metadata=metadata
                    )

                # Different source and destination currencies: get the converted amount
                account_amount: int | None = None
                if transaction.currency != transaction.account_currency:
                    assert stripe_transfer.destination_payment is not None
                    stripe_destination_charge = await stripe_service.get_charge(
                        get_expandable_id(stripe_transfer.destination_payment),
                        stripe_account=account.stripe_id,
                        expand=["balance_transaction"],
                    )

                    # Case where the charge don't lead to a balance transaction,
                    # e.g. when the converted amount is 0
                    if stripe_destination_charge.balance_transaction is None:
                        account_amount = 0
                    else:
                        stripe_destination_balance_transaction = cast(
                            stripe_lib.BalanceTransaction,
                            stripe_destination_charge.balance_transaction,
                        )
                        account_amount = stripe_destination_balance_transaction.amount

                return balance_transaction, account_amount
        except stripe_lib.RateLimitError:
            await asyncio.sleep(retry + random.random())
            return await self._create_stripe_transfer(
                account,
                transaction,
                metadata,
                source_transaction,
                amount,
                balance_transaction,
                retry=retry + 1,
            )


payout_transaction = PayoutTransactionService(Transaction)
