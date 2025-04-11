from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Customer
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.repository.base import RepositorySortingMixin, SortingClause
from polar.models import CustomerMeter, Meter

from ..sorting.customer_meter import CustomerCustomerMeterSortProperty


class CustomerMeterRepository(
    RepositorySortingMixin[CustomerMeter, CustomerCustomerMeterSortProperty],
    RepositorySoftDeletionIDMixin[CustomerMeter, UUID],
    RepositorySoftDeletionMixin[CustomerMeter],
    RepositoryBase[CustomerMeter],
):
    model = CustomerMeter

    def get_readable_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[CustomerMeter]]:
        return self.get_base_statement().where(
            CustomerMeter.customer_id == auth_subject.subject.id
        )

    def get_sorting_clause(
        self, property: CustomerCustomerMeterSortProperty
    ) -> SortingClause:
        match property:
            case CustomerCustomerMeterSortProperty.created_at:
                return self.model.created_at
            case CustomerCustomerMeterSortProperty.modified_at:
                return self.model.modified_at
            case CustomerCustomerMeterSortProperty.meter_id:
                return self.model.meter_id
            case CustomerCustomerMeterSortProperty.meter_name:
                return Meter.name
            case CustomerCustomerMeterSortProperty.consumed_units:
                return self.model.consumed_units
            case CustomerCustomerMeterSortProperty.credited_units:
                return self.model.credited_units
            case CustomerCustomerMeterSortProperty.balance:
                return self.model.balance
