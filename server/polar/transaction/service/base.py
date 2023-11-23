import uuid

from sqlalchemy import select

from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.models import Transaction
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession


class BaseTransactionServiceError(PolarError):
    ...


class MoreThanTwoTransfersForSinglePayment(BaseTransactionServiceError):
    def __init__(
        self,
        payment_transaction_id: uuid.UUID,
        transfer_transaction_ids: list[uuid.UUID],
    ) -> None:
        self.payment_transaction_id = payment_transaction_id
        self.transfer_transaction_ids = transfer_transaction_ids
        message = (
            f"More than two transfer transactions were found "
            f"for payment {payment_transaction_id}: "
            f"{', '.join([str(id) for id in transfer_transaction_ids])}"
        )
        super().__init__(message)


class BaseTransactionService(ResourceServiceReader[Transaction]):
    async def _get_transfer_transactions_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> tuple[Transaction, Transaction] | None:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.transfer,
            Transaction.transfer_id.is_not(None),
            Transaction.transfer_reversal_id.is_(None),
        )
        if payment_transaction.subscription_id:
            statement = statement.where(
                Transaction.subscription_id == payment_transaction.subscription_id
            )
        elif payment_transaction.pledge_id:
            statement = statement.where(
                Transaction.pledge_id == payment_transaction.pledge_id
            )

        result = await session.execute(statement)
        transactions = result.scalars().all()

        if len(transactions) == 0:
            return None

        if len(transactions) != 2:
            raise MoreThanTwoTransfersForSinglePayment(
                payment_transaction.id, [transaction.id for transaction in transactions]
            )

        return (transactions[0], transactions[1])
