from collections.abc import Sequence
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, case, select
from sqlalchemy.orm import contains_eager
from sqlalchemy.orm.strategy_options import joinedload, selectinload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.enums import SubscriptionRecurringInterval
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import (
    Customer,
    Discount,
    Product,
    ProductPrice,
    ProductPriceMeteredUnit,
    Subscription,
    SubscriptionMeter,
    SubscriptionProductPrice,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus

from .sorting import SubscriptionSortProperty

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class SubscriptionRepository(
    RepositorySortingMixin[Subscription, SubscriptionSortProperty],
    RepositorySoftDeletionIDMixin[Subscription, UUID],
    RepositorySoftDeletionMixin[Subscription],
    RepositoryBase[Subscription],
):
    model = Subscription

    async def list_active_by_customer(
        self, customer_id: UUID, *, options: Options = ()
    ) -> Sequence[Subscription]:
        statement = (
            self.get_base_statement()
            .where(
                Subscription.customer_id == customer_id,
                Subscription.active.is_(True),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_by_id_and_organization(
        self,
        id: UUID,
        organization_id: UUID,
        *,
        options: Options = (),
    ) -> Subscription | None:
        statement = (
            self.get_base_statement()
            .join(Product)
            .where(
                Subscription.id == id,
                Product.organization_id == organization_id,
            )
            .options(contains_eager(Subscription.product), *options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_stripe_subscription_id(
        self, stripe_subscription_id: str, *, options: Options = ()
    ) -> Subscription | None:
        statement = (
            self.get_base_statement()
            .where(Subscription.stripe_subscription_id == stripe_subscription_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(
        self, *, product_load: "_AbstractLoad | None" = None
    ) -> Options:
        if product_load is None:
            product_load = joinedload(Subscription.product)
        return (
            joinedload(Subscription.customer),
            product_load.options(
                joinedload(Product.organization),
                selectinload(Product.product_medias),
                selectinload(Product.attached_custom_fields),
            ),
            selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Subscription]]:
        statement = self.get_base_statement().join(Product)

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement

    def get_sorting_clause(self, property: SubscriptionSortProperty) -> SortingClause:
        match property:
            case SubscriptionSortProperty.customer:
                return Customer.email
            case SubscriptionSortProperty.status:
                return case(
                    (Subscription.status == SubscriptionStatus.incomplete, 1),
                    (
                        Subscription.status == SubscriptionStatus.incomplete_expired,
                        2,
                    ),
                    (Subscription.status == SubscriptionStatus.trialing, 3),
                    (
                        Subscription.status == SubscriptionStatus.active,
                        case(
                            (Subscription.cancel_at_period_end.is_(False), 4),
                            (Subscription.cancel_at_period_end.is_(True), 5),
                        ),
                    ),
                    (Subscription.status == SubscriptionStatus.past_due, 6),
                    (Subscription.status == SubscriptionStatus.canceled, 7),
                    (Subscription.status == SubscriptionStatus.unpaid, 8),
                )
            case SubscriptionSortProperty.started_at:
                return Subscription.started_at
            case SubscriptionSortProperty.current_period_end:
                return Subscription.current_period_end
            case SubscriptionSortProperty.amount:
                return case(
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.year,
                        Subscription.amount / 12,
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.month,
                        Subscription.amount,
                    ),
                ).nulls_last()
            case SubscriptionSortProperty.product:
                return Product.name
            case SubscriptionSortProperty.discount:
                return Discount.name


class SubscriptionProductPriceRepository(
    RepositorySoftDeletionIDMixin[SubscriptionProductPrice, UUID],
    RepositorySoftDeletionMixin[SubscriptionProductPrice],
    RepositoryBase[SubscriptionProductPrice],
):
    model = SubscriptionProductPrice

    async def get_by_customer_and_meter(
        self, customer_id: UUID, meter_id: UUID
    ) -> SubscriptionProductPrice | None:
        statement = (
            self.get_base_statement()
            .join(
                ProductPrice,
                SubscriptionProductPrice.product_price_id == ProductPrice.id,
            )
            .join(
                Subscription,
                Subscription.id == SubscriptionProductPrice.subscription_id,
            )
            .where(
                ProductPrice.is_metered.is_(True),
                ProductPriceMeteredUnit.meter_id == meter_id,
                Subscription.billable.is_(True),
                Subscription.customer_id == customer_id,
            )
            # In case customer has several subscriptions, take the earliest one
            .order_by(Subscription.started_at.asc())
            .limit(1)
            .options(
                contains_eager(SubscriptionProductPrice.product_price),
                contains_eager(SubscriptionProductPrice.subscription),
            )
        )

        return await self.get_one_or_none(statement)
