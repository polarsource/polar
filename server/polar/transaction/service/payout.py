from collections.abc import Iterable

from polar.enums import AccountType
from polar.kit.utils import generate_uuid
from polar.models import Payout, Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession

from ..repository import BalanceTransactionRepository, PayoutTransactionRepository
from .base import BaseTransactionService


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


payout_transaction = PayoutTransactionService(Transaction)
