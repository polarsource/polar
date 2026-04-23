from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.orm import contains_eager

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.repository.base import Options
from polar.models import Customer, CustomerMeter, Meter

from .sorting import CustomerMeterSortProperty


class CustomerMeterRepository(
    RepositorySortingMixin[CustomerMeter, CustomerMeterSortProperty],
    RepositorySoftDeletionIDMixin[CustomerMeter, UUID],
    RepositorySoftDeletionMixin[CustomerMeter],
    RepositoryBase[CustomerMeter],
):
    model = CustomerMeter

    async def get_all_by_customer(
        self, customer_id: UUID, *, options: Options = ()
    ) -> Sequence[CustomerMeter]:
        statement = (
            self.get_base_statement()
            .where(CustomerMeter.customer_id == customer_id)
            .options(*options)
            .order_by(
                CustomerMeter.created_at.asc(),
            )
        )
        return await self.get_all(statement)

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

    async def get_by_customer_and_meter_for_update(
        self,
        customer_id: UUID,
        meter_id: UUID,
        *,
        nowait: bool = True,
        options: Options = (),
    ) -> CustomerMeter | None:
        """
        Get CustomerMeter with FOR UPDATE lock.

        This serializes concurrent meter updates and ensures that when the lock
        is acquired, the transaction sees all previously committed changes.

        Args:
            nowait: If True (default), raise error instead of waiting for lock.
                    Worker tasks should use True and retry on lock failure.
        """
        statement = (
            self.get_base_statement()
            .where(
                CustomerMeter.customer_id == customer_id,
                CustomerMeter.meter_id == meter_id,
            )
            .options(*options)
            .with_for_update(nowait=nowait, of=CustomerMeter)
        )
        return await self.get_one_or_none(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[CustomerMeter]]:
        return (
            self.get_base_statement()
            .join(CustomerMeter.customer)
            .options(
                contains_eager(CustomerMeter.customer),
            )
            .where(Customer.organization_id.in_(org_ids))
        )

    def get_sorting_clause(self, property: CustomerMeterSortProperty) -> SortingClause:
        match property:
            case CustomerMeterSortProperty.created_at:
                return self.model.created_at
            case CustomerMeterSortProperty.modified_at:
                return self.model.modified_at
            case CustomerMeterSortProperty.customer_id:
                return self.model.customer_id
            case CustomerMeterSortProperty.customer_name:
                return Customer.name
            case CustomerMeterSortProperty.meter_id:
                return self.model.meter_id
            case CustomerMeterSortProperty.meter_name:
                return Meter.name
            case CustomerMeterSortProperty.consumed_units:
                return self.model.consumed_units
            case CustomerMeterSortProperty.credited_units:
                return self.model.credited_units
            case CustomerMeterSortProperty.balance:
                return self.model.balance
