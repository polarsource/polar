from collections.abc import Iterable
from typing import cast

import stripe as stripe_lib

from polar.enums import AccountType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.utils import generate_uuid
from polar.models import Account, Payout, Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession

from ..repository import BalanceTransactionRepository, PayoutTransactionRepository
from .base import BaseTransactionService, BaseTransactionServiceError


class PayoutTransactionError(BaseTransactionServiceError): ...


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
                account, payout, transaction
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
        self, account: Account, payout: Payout, transaction: Transaction
    ) -> Transaction:
        """
        The Stripe payout is a two-steps process:

        1. Make the transfer to the Stripe Connect account
        2. Trigger a payout on the Stripe Connect account,
        but later once the balance is actually available.

        This function performs the first step.
        """
        assert account.stripe_id is not None
        stripe_transfer = await stripe_service.transfer(
            account.stripe_id,
            payout.amount,
            metadata={
                "payout_id": str(payout.id),
                "payout_transaction_id": str(transaction.id),
            },
        )

        transaction.transfer_id = stripe_transfer.id

        # Different source and destination currencies: get the converted amount
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
                transaction.account_amount = 0
            else:
                stripe_destination_balance_transaction = cast(
                    stripe_lib.BalanceTransaction,
                    stripe_destination_charge.balance_transaction,
                )
                transaction.account_amount = (
                    -stripe_destination_balance_transaction.amount
                )

        return transaction


payout_transaction = PayoutTransactionService(Transaction)
