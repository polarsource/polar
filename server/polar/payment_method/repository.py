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

    async def get_by_id_and_customer(
        self,
        id: UUID,
        customer: UUID,
        *,
        options: Options = (),
    ) -> PaymentMethod | None:
        statement = (
            self.get_base_statement()
            .where(
                PaymentMethod.id == id,
                PaymentMethod.customer_id == customer,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_customer_and_processor_id(
        self,
        customer: UUID,
        processor: PaymentProcessor,
        processor_id: str,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> PaymentMethod | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(
                PaymentMethod.customer_id == customer,
                PaymentMethod.processor == processor,
                PaymentMethod.processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def list_by_customer(
        self,
        customer_id: UUID,
        *,
        exclude_id: UUID | None = None,
        options: Options = (),
    ) -> list[PaymentMethod]:
        statement = self.get_base_statement().where(
            PaymentMethod.customer_id == customer_id
        )
        if exclude_id is not None:
            statement = statement.where(PaymentMethod.id != exclude_id)
        statement = statement.options(*options)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

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
