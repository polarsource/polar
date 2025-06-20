from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.enums import PaymentProcessor
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import PaymentMethod


class PaymentMethodRepository(
    RepositorySoftDeletionIDMixin[PaymentMethod, UUID],
    RepositorySoftDeletionMixin[PaymentMethod],
    RepositoryBase[PaymentMethod],
):
    model = PaymentMethod

    async def get_by_processor_id(
        self, processor: PaymentProcessor, processor_id: str, *, options: Options = ()
    ) -> PaymentMethod | None:
        statement = self.get_base_statement().where(
            PaymentMethod.processor == processor,
            PaymentMethod.processor_id == processor_id,
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (joinedload(PaymentMethod.customer),)
