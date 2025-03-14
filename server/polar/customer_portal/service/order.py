import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, Order, Product
from polar.models.product import ProductBillingType

from ..repository.order import CustomerOrderRepository


class CustomerOrderError(PolarError): ...


class InvoiceNotAvailable(CustomerOrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = "The invoice is not available for this order."
        super().__init__(message, 404)


class CustomerOrderSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"
    net_amount = "net_amount"
    product = "product"
    subscription = "subscription"


class CustomerOrderService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        product_billing_type: Sequence[ProductBillingType] | None = None,
        subscription_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CustomerOrderSortProperty]] = [
            (CustomerOrderSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Order], int]:
        repository = CustomerOrderRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .join(Order.product)
            .options(
                *repository.get_eager_options(
                    product_load=contains_eager(Order.product)
                )
            )
        )

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Order.product_id.in_(product_id))

        if product_billing_type is not None:
            statement = statement.where(Product.billing_type.in_(product_billing_type))

        if subscription_id is not None:
            statement = statement.where(Order.subscription_id.in_(subscription_id))

        if query is not None:
            statement = statement.where(Product.name.ilike(f"%{query}%"))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CustomerOrderSortProperty.created_at:
                order_by_clauses.append(clause_function(Order.created_at))
            elif criterion in {
                CustomerOrderSortProperty.amount,
                CustomerOrderSortProperty.net_amount,
            }:
                order_by_clauses.append(clause_function(Order.net_amount))
            elif criterion == CustomerOrderSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
            elif criterion == CustomerOrderSortProperty.subscription:
                order_by_clauses.append(clause_function(Order.subscription_id))
        statement = statement.order_by(*order_by_clauses)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        id: uuid.UUID,
    ) -> Order | None:
        repository = CustomerOrderRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Order.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def get_order_invoice_url(self, order: Order) -> str:
        if order.stripe_invoice_id is None:
            raise InvoiceNotAvailable(order)

        stripe_invoice = await stripe_service.get_invoice(order.stripe_invoice_id)

        if stripe_invoice.hosted_invoice_url is None:
            raise InvoiceNotAvailable(order)

        return stripe_invoice.hosted_invoice_url


customer_order = CustomerOrderService()
