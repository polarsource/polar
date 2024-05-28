import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import aliased, contains_eager, joinedload

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import Order, Organization, Product, ProductPrice, User
from polar.models.product_price import ProductPriceType


class UserOrderError(PolarError): ...


class InvoiceNotAvailable(UserOrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = "The invoice is not available for this order."
        super().__init__(message, 404)


class SortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"
    organization = "organization"
    product = "product"
    subscription = "subscription"


class UserOrderService(ResourceServiceReader[Order]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        organization_id: uuid.UUID | None = None,
        product_id: uuid.UUID | None = None,
        product_price_type: ProductPriceType | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SortProperty]] = [(SortProperty.created_at, True)],
    ) -> tuple[Sequence[Order], int]:
        statement = self._get_readable_order_statement(auth_subject)

        statement = statement.options(
            joinedload(Order.subscription),
        )

        OrderProductPrice = aliased(ProductPrice)
        statement = statement.join(
            OrderProductPrice, onclause=Order.product_price_id == OrderProductPrice.id
        ).options(contains_eager(Order.product_price.of_type(OrderProductPrice)))

        if organization_id is not None:
            statement = statement.where(Product.organization_id == organization_id)

        if product_id is not None:
            statement = statement.where(Order.product_id == product_id)

        if product_price_type is not None:
            statement = statement.where(OrderProductPrice.type == product_price_type)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SortProperty.created_at:
                order_by_clauses.append(clause_function(Order.created_at))
            elif criterion == SortProperty.amount:
                order_by_clauses.append(clause_function(Order.amount))
            elif criterion == SortProperty.organization:
                statement = statement.join(
                    Organization, onclause=Product.organization_id == Organization.id
                )
                order_by_clauses.append(clause_function(Organization.name))
            elif criterion == SortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
            elif criterion == SortProperty.subscription:
                order_by_clauses.append(clause_function(Order.subscription_id))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        id: uuid.UUID,
    ) -> Order | None:
        statement = (
            self._get_readable_order_statement(auth_subject)
            .where(Order.id == id)
            .options(
                joinedload(Order.product_price),
                joinedload(Order.subscription),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_order_invoice_url(self, order: Order) -> str:
        if order.stripe_invoice_id is None:
            raise InvoiceNotAvailable(order)

        stripe_invoice = stripe_service.get_invoice(order.stripe_invoice_id)

        if stripe_invoice.hosted_invoice_url is None:
            raise InvoiceNotAvailable(order)

        return stripe_invoice.hosted_invoice_url

    def _get_readable_order_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[Order]]:
        statement = (
            select(Order)
            .where(Order.deleted_at.is_(None), Order.user_id == auth_subject.subject.id)
            .join(Order.product)
            .options(contains_eager(Order.product))
        )
        return statement


user_order = UserOrderService(Order)
