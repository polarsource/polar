import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, nulls_first, or_, select
from sqlalchemy.orm import aliased, contains_eager, joinedload, selectinload

from polar.auth.models import AuthSubject, is_customer, is_user
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Organization,
    Product,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    Subscription,
    User,
)
from polar.models.product_price import ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.product.service.product import product as product_service
from polar.product.service.product_price import product_price as product_price_service
from polar.subscription.service import subscription as subscription_service

from ..schemas.subscription import CustomerSubscriptionUpdate


class CustomerSubscriptionError(PolarError): ...


class AlreadyCanceledSubscription(CustomerSubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            "This subscription is already canceled or will be at the end of the period."
        )
        super().__init__(message, 403)


class SubscriptionNotActiveOnStripe(CustomerSubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is not active on Stripe."
        super().__init__(message, 400)


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
        auth_subject: AuthSubject[User | Customer],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
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
                contains_eager(Subscription.product).options(
                    selectinload(Product.product_medias),
                    contains_eager(Product.organization),
                )
            )
        )

        SubscriptionProductPrice = aliased(ProductPrice)
        statement = statement.join(
            SubscriptionProductPrice,
            onclause=Subscription.price_id == SubscriptionProductPrice.id,
            isouter=True,
        ).options(contains_eager(Subscription.price.of_type(SubscriptionProductPrice)))

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Subscription.product_id.in_(product_id))

        if active is not None:
            if active:
                statement = statement.where(Subscription.active.is_(True))
            else:
                statement = statement.where(Subscription.revoked.is_(True))

        if query is not None:
            statement = statement.where(
                or_(
                    Product.name.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                )
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomerSubscriptionSortProperty.started_at:
                order_by_clauses.append(clause_function(Subscription.started_at))
            elif criterion == CustomerSubscriptionSortProperty.amount:
                order_by_clauses.append(
                    nulls_first(clause_function(Subscription.amount))
                )
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
        auth_subject: AuthSubject[User | Customer],
        id: uuid.UUID,
    ) -> Subscription | None:
        statement = (
            self._get_readable_subscription_statement(auth_subject)
            .where(Subscription.id == id)
            .options(
                joinedload(Subscription.product).options(
                    selectinload(Product.product_medias),
                    joinedload(Product.organization),
                ),
                joinedload(Subscription.price),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def update(
        self,
        session: AsyncSession,
        *,
        subscription: Subscription,
        subscription_update: CustomerSubscriptionUpdate,
    ) -> Subscription:
        price = await product_price_service.get_by_id(
            session, subscription_update.product_price_id
        )

        if price is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price does not exist.",
                        "input": subscription_update.product_price_id,
                    }
                ]
            )

        if price.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price is archived.",
                        "input": subscription_update.product_price_id,
                    }
                ]
            )

        if price.type != ProductPriceType.recurring:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price is not recurring.",
                        "input": subscription_update.product_price_id,
                    }
                ]
            )

        if isinstance(price, ProductPriceCustom):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": (
                            "Pay what you want price are not supported "
                            "for subscriptions."
                        ),
                        "input": subscription_update.product_price_id,
                    }
                ]
            )

        product = await product_service.get_loaded(session, price.product_id)
        assert product is not None
        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Product is archived.",
                        "input": subscription_update.product_price_id,
                    }
                ]
            )

        # Make sure the new product belongs to the same organization
        old_product = subscription.product
        if old_product.organization_id != product.organization_id:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": (
                            "Price does not belong to the same organization "
                            "of the current subscription."
                        ),
                        "input": subscription_update.product_price_id,
                    }
                ]
            )

        if subscription.stripe_subscription_id is None:
            raise SubscriptionNotActiveOnStripe(subscription)

        assert subscription.price is not None
        await stripe_service.update_subscription_price(
            subscription.stripe_subscription_id,
            old_price=subscription.price.stripe_price_id,
            new_price=price.stripe_price_id,
            error_if_incomplete=isinstance(subscription.price, ProductPriceFree),
        )

        subscription.product = product
        subscription.price = price
        if isinstance(price, ProductPriceFixed):
            subscription.amount = price.price_amount
            subscription.currency = price.price_currency
            subscription.recurring_interval = price.recurring_interval
        if isinstance(price, ProductPriceFree):
            subscription.amount = None
            subscription.currency = None
            subscription.recurring_interval = price.recurring_interval
        session.add(subscription)

        return subscription

    async def cancel(
        self, session: AsyncSession, *, subscription: Subscription
    ) -> Subscription:
        if not subscription.active or subscription.cancel_at_period_end:
            raise AlreadyCanceledSubscription(subscription)

        if subscription.stripe_subscription_id is not None:
            await stripe_service.cancel_subscription(
                subscription.stripe_subscription_id
            )
        else:
            subscription.ended_at = utc_now()
            subscription.cancel_at_period_end = True
            subscription.status = SubscriptionStatus.canceled

            # free subscriptions end immediately (vs at end of billing period)
            # queue removal of grants
            await subscription_service.enqueue_benefits_grants(session, subscription)

        session.add(subscription)

        return subscription

    def _get_readable_subscription_statement(
        self, auth_subject: AuthSubject[User | Customer]
    ) -> Select[tuple[Subscription]]:
        statement = select(Subscription).where(Subscription.deleted_at.is_(None))

        if is_user(auth_subject):
            raise NotImplementedError("TODO")
        elif is_customer(auth_subject):
            statement = statement.where(
                Subscription.customer_id == auth_subject.subject.id
            )

        return statement


customer_subscription = CustomerSubscriptionService(Subscription)
