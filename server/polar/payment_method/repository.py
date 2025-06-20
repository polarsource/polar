from uuid import UUID

from sqlalchemy import update
from sqlalchemy.orm import joinedload

from polar.enums import PaymentProcessor
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Customer, PaymentMethod, Subscription


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

    async def soft_delete(
        self, object: PaymentMethod, *, flush: bool = False
    ) -> PaymentMethod:
        # Unlink the payment method from the customer and subscriptions
        await self.session.execute(
            update(Customer)
            .values(default_payment_method_id=None)
            .where(Customer.default_payment_method_id == object.id)
        )
        await self.session.execute(
            update(Subscription)
            .values(payment_method_id=None)
            .where(Subscription.payment_method_id == object.id)
        )

        return await super().soft_delete(object, flush=flush)

    def get_eager_options(self) -> Options:
        return (joinedload(PaymentMethod.customer),)
