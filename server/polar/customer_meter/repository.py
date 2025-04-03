from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.repository.base import Options
from polar.models import CustomerMeter


class CustomerMeterRepository(
    RepositorySoftDeletionIDMixin[CustomerMeter, UUID],
    RepositorySoftDeletionMixin[CustomerMeter],
    RepositoryBase[CustomerMeter],
):
    model = CustomerMeter

    async def get_by_customer_and_meter(
        self,
        customer_id: UUID,
        meter_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerMeter | None:
        statement = (
            self.get_base_statement()
            .where(
                CustomerMeter.customer_id == customer_id,
                CustomerMeter.meter_id == meter_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)
