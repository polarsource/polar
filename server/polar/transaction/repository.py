from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Transaction
from polar.models.transaction import TransactionType


class TransactionRepository(
    RepositorySoftDeletionIDMixin[Transaction, UUID],
    RepositorySoftDeletionMixin[Transaction],
    RepositoryBase[Transaction],
):
    model = Transaction


class RefundTransactionRepository(TransactionRepository):
    async def get_by_refund_id(self, refund_id: str) -> Transaction | None:
        statement = self.get_base_statement().where(Transaction.refund_id == refund_id)
        return await self.get_one_or_none(statement)

    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[Transaction]]:
        return (
            super()
            .get_base_statement(include_deleted=include_deleted)
            .where(Transaction.type == TransactionType.refund)
        )
