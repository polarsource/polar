import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    Customer,
    Organization,
    Product,
    Subscription,
    SubscriptionMeter,
)
from polar.models.subscription import CustomerCancellationReason
from polar.subscription.service import subscription as subscription_service

from ..schemas.subscription import (
    CustomerSubscriptionUpdate,
    CustomerSubscriptionUpdateProduct,
    CustomerSubscriptionUpdateSeats,
)


class CustomerSubscriptionError(PolarError): ...


class UpdateSubscriptionPlanNotAllowed(CustomerSubscriptionError):
    def __init__(self) -> None:
        super().__init__("Updating subscription plan is not allowed.", 403)


class UpdateSubscriptionSeatsNotAllowed(CustomerSubscriptionError):
    def __init__(self) -> None:
        super().__init__("Updating subscription seats is not allowed.", 403)


class CustomerSubscriptionSortProperty(StrEnum):
    started_at = "started_at"
    amount = "amount"
    status = "status"
    organization = "organization"
    product = "product"


class CustomerSubscriptionService(ResourceServiceReader[Subscription]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        product_id: Sequence[uuid.UUID] | None = None,
        active: bool | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerSubscriptionSortProperty]] = [
            (CustomerSubscriptionSortProperty.started_at, True)
        ],
    ) -> tuple[Sequence[Subscription], int]:
        statement = self._get_readable_subscription_statement(auth_subject).where(
            Subscription.started_at.is_not(None)
        )

        statement = (
            statement.join(Product, onclause=Subscription.product_id == Product.id)
            .join(Organization, onclause=Product.organization_id == Organization.id)
            .options(
                joinedload(Subscription.customer),
                contains_eager(Subscription.product).options(
                    selectinload(Product.product_medias),
                    contains_eager(Product.organization),
                ),
                selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
            )
        )

        if product_id is not None:
            statement = statement.where(Subscription.product_id.in_(product_id))

        if active is not None:
            if active:
                statement = statement.where(Subscription.active.is_(True))
            else:
                statement = statement.where(Subscription.revoked.is_(True))

        if query is not None:
            statement = statement.where(Product.name.ilike(f"%{query}%"))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomerSubscriptionSortProperty.started_at:
                order_by_clauses.append(clause_function(Subscription.started_at))
            elif criterion == CustomerSubscriptionSortProperty.amount:
                order_by_clauses.append(clause_function(Subscription.amount))
            elif criterion == CustomerSubscriptionSortProperty.status:
                order_by_clauses.append(clause_function(Subscription.status))
            elif criterion == CustomerSubscriptionSortProperty.organization:
                order_by_clauses.append(clause_function(Organization.slug))
            elif criterion == CustomerSubscriptionSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        id: uuid.UUID,
    ) -> Subscription | None:
        statement = (
            self._get_readable_subscription_statement(auth_subject)
            .where(Subscription.id == id)
            .options(
                joinedload(Subscription.customer),
                joinedload(Subscription.product).options(
                    selectinload(Product.product_medias),
                    joinedload(Product.organization),
                ),
                selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def update(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        updates: CustomerSubscriptionUpdate,
    ) -> Subscription:
        organization = subscription.product.organization
        if isinstance(updates, CustomerSubscriptionUpdateProduct):
            if not organization.customer_portal_subscription_update_plan:
                raise UpdateSubscriptionPlanNotAllowed()

            return await self.update_product(
                session,
                subscription,
                product_id=updates.product_id,
            )

        if isinstance(updates, CustomerSubscriptionUpdateSeats):
            if not organization.customer_portal_subscription_update_seats:
                raise UpdateSubscriptionSeatsNotAllowed()

            return await subscription_service.update_seats(
                session,
                subscription,
                seats=updates.seats,
                proration_behavior=updates.proration_behavior,
            )

        cancel = updates.cancel_at_period_end is True
        uncancel = updates.cancel_at_period_end is False
        if not (cancel or uncancel):
            return subscription

        if cancel:
            return await self.cancel(
                session,
                subscription,
                reason=updates.cancellation_reason,
                comment=updates.cancellation_comment,
            )

        return await self.uncancel(session, subscription)

    async def update_product(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        product_id: uuid.UUID,
    ) -> Subscription:
        return await subscription_service.update_product(
            session, subscription, product_id=product_id
        )

    async def uncancel(
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> Subscription:
        return await subscription_service.uncancel(
            session,
            subscription,
        )

    async def cancel(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        reason: CustomerCancellationReason | None = None,
        comment: str | None = None,
    ) -> Subscription:
        return await subscription_service.cancel(
            session,
            subscription,
            customer_reason=reason,
            customer_comment=comment,
        )

    def _get_readable_subscription_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[Subscription]]:
        return select(Subscription).where(
            Subscription.deleted_at.is_(None),
            Subscription.customer_id == auth_subject.subject.id,
        )


customer_subscription = CustomerSubscriptionService(Subscription)
