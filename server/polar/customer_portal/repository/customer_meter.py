from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from polar.auth.models import AuthSubject, Customer
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.repository.base import RepositorySortingMixin, SortingClause
from polar.models import (
    Benefit,
    BenefitGrant,
    CustomerMeter,
    Meter,
    Subscription,
    SubscriptionMeter,
)
from polar.models.benefit import BenefitType
from polar.models.subscription import SubscriptionStatus

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
        customer_id = auth_subject.subject.id

        # Subquery for meters from active subscriptions
        subscription_meters = (
            select(SubscriptionMeter.meter_id)
            .select_from(SubscriptionMeter)
            .join(Subscription, Subscription.id == SubscriptionMeter.subscription_id)
            .where(
                Subscription.customer_id == customer_id,
                Subscription.status.in_(SubscriptionStatus.active_statuses()),
            )
        )

        # Subquery for meters from benefit grants (one-time purchases)
        benefit_meters = (
            select(Benefit.properties["meter_id"].astext.cast(PGUUID))
            .select_from(BenefitGrant)
            .join(Benefit, Benefit.id == BenefitGrant.benefit_id)
            .where(
                BenefitGrant.customer_id == customer_id,
                BenefitGrant.granted_at.is_not(None),
                BenefitGrant.revoked_at.is_(None),
                Benefit.type == BenefitType.meter_credit.value,
            )
        )

        return (
            self.get_base_statement()
            .join(CustomerMeter.meter)
            .where(
                CustomerMeter.customer_id == customer_id,
                or_(
                    CustomerMeter.meter_id.in_(subscription_meters),
                    CustomerMeter.meter_id.in_(benefit_meters),
                ),
                Meter.archived_at.is_(None),
            )
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
