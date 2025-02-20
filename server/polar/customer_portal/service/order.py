import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, or_, select
from sqlalchemy.orm import aliased, contains_eager, joinedload, selectinload

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import Customer, Order, Organization, Product, ProductPrice
from polar.models.product_price import ProductPriceType


class CustomerOrderError(PolarError): ...


class InvoiceNotAvailable(CustomerOrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = "The invoice is not available for this order."
        super().__init__(message, 404)


class CustomerOrderSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"
    organization = "organization"
    product = "product"
    subscription = "subscription"


class CustomerOrderService(ResourceServiceReader[Order]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        product_price_type: Sequence[ProductPriceType] | None = None,
        subscription_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerOrderSortProperty]] = [
            (CustomerOrderSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Order], int]:
        statement = self._get_readable_order_statement(auth_subject)

        statement = statement.join(
            Organization, onclause=Product.organization_id == Organization.id
        ).options(
            joinedload(Order.customer),
            joinedload(Order.subscription),
            contains_eager(Order.product).options(
                selectinload(Product.product_medias),
                contains_eager(Product.organization),
            ),
        )

        OrderProductPrice = aliased(ProductPrice)
        statement = statement.join(
            OrderProductPrice, onclause=Order.product_price_id == OrderProductPrice.id
        ).options(contains_eager(Order.product_price.of_type(OrderProductPrice)))

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Order.product_id.in_(product_id))

        if product_price_type is not None:
            statement = statement.where(OrderProductPrice.type.in_(product_price_type))

        if subscription_id is not None:
            statement = statement.where(Order.subscription_id.in_(subscription_id))

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
            if criterion == CustomerOrderSortProperty.created_at:
                order_by_clauses.append(clause_function(Order.created_at))
            elif criterion == CustomerOrderSortProperty.amount:
                order_by_clauses.append(clause_function(Order.amount))
            elif criterion == CustomerOrderSortProperty.organization:
                order_by_clauses.append(clause_function(Organization.slug))
            elif criterion == CustomerOrderSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
            elif criterion == CustomerOrderSortProperty.subscription:
                order_by_clauses.append(clause_function(Order.subscription_id))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        id: uuid.UUID,
    ) -> Order | None:
        statement = (
            self._get_readable_order_statement(auth_subject)
            .where(Order.id == id)
            .options(
                joinedload(Order.customer),
                joinedload(Order.product_price),
                joinedload(Order.subscription),
                contains_eager(Order.product).options(
                    selectinload(Product.product_medias),
                    joinedload(Product.organization),
                ),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_order_invoice_url(self, order: Order) -> str:
        if order.stripe_invoice_id is None:
            raise InvoiceNotAvailable(order)

        stripe_invoice = await stripe_service.get_invoice(order.stripe_invoice_id)

        if stripe_invoice.hosted_invoice_url is None:
            raise InvoiceNotAvailable(order)

        return stripe_invoice.hosted_invoice_url

    def _get_readable_order_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[Order]]:
        return (
            select(Order)
            .where(
                Order.deleted_at.is_(None),
                Order.customer_id == auth_subject.subject.id,
            )
            .join(Order.product)
            .options(contains_eager(Order.product))
        )


customer_order = CustomerOrderService(Order)
