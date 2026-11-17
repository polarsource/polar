from collections.abc import Collection, Sequence
from datetime import datetime
from typing import cast
from uuid import UUID

from sqlalchemy import Select, select, update
from sqlalchemy.exc import IntegrityError
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
from polar.kit.utils import utc_now
from polar.meter.repository import MeterRepository
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

    async def get_meter_versions(
        self, customer_id: UUID, external_ids: Collection[str]
    ) -> dict[str, set[UUID]]:
        """The meters the customer has a customer meter on, by `external_id`."""
        statement = (
            select(Meter.external_id, Meter.id)
            .join(CustomerMeter, CustomerMeter.meter_id == Meter.id)
            .where(
                CustomerMeter.customer_id == customer_id,
                ~CustomerMeter.is_deleted,
                Meter.external_id.in_(external_ids),
            )
        )
        versions: dict[str, set[UUID]] = {}
        for external_id, meter_id in await self.session.execute(statement):
            versions.setdefault(cast(str, external_id), set()).add(meter_id)
        return versions

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

    async def get_or_create(
        self,
        customer: Customer,
        meter: Meter,
        *,
        activated_at: datetime | None = None,
    ) -> CustomerMeter:
        customer_meter = await self.get_by_customer_and_meter_for_update(
            customer.id, meter.id
        )
        if customer_meter is not None:
            return customer_meter

        customer_meter = CustomerMeter(
            customer=customer, meter=meter, activated_at=activated_at
        )
        try:
            async with self.session.begin_nested():
                self.session.add(customer_meter)
                await self.session.flush()
        except IntegrityError:
            customer_meter = await self.get_by_customer_and_meter_for_update(
                customer.id, meter.id
            )
            if customer_meter is not None:
                return customer_meter
            raise
        return customer_meter

    async def get_unactivated_meters(
        self, customer_ids: Collection[UUID]
    ) -> Sequence[Meter]:
        unactivated_meter_ids = (
            self.get_base_statement()
            .with_only_columns(CustomerMeter.meter_id)
            .where(
                CustomerMeter.customer_id.in_(customer_ids),
                CustomerMeter.activated_at.is_(None),
            )
        )
        result = await self.session.execute(
            select(Meter).where(
                Meter.id.in_(unactivated_meter_ids),
                MeterRepository.get_active_clause(),
            )
        )
        return result.scalars().all()

    async def activate(self, meter_id: UUID, customer_ids: Collection[UUID]) -> None:
        await self.session.execute(
            update(CustomerMeter)
            .where(
                CustomerMeter.meter_id == meter_id,
                CustomerMeter.customer_id.in_(customer_ids),
                CustomerMeter.activated_at.is_(None),
                CustomerMeter.deleted_at.is_(None),
            )
            .values(activated_at=utc_now())
        )

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[CustomerMeter]:
        return (
            self.get_base_statement()
            .join(CustomerMeter.customer)
            .options(
                contains_eager(CustomerMeter.customer).joinedload(
                    Customer.organization
                ),
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
