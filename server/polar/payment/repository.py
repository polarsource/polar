from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Payment


class PaymentRepository(
    RepositorySoftDeletionIDMixin[Payment, UUID],
    RepositorySoftDeletionMixin[Payment],
    RepositoryBase[Payment],
):
    model = Payment

    async def get_by_processor_id(self, processor_id: str) -> Payment | None:
        statement = self.get_base_statement().where(
            Payment.processor_id == processor_id
        )
        return await self.get_one_or_none(statement)
