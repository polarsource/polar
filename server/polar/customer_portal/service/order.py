import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.invoice.service import invoice as invoice_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, Order, Product
from polar.models.product import ProductBillingType
from polar.order.service import InvoiceDoesNotExist
from polar.order.service import order as order_service

from ..repository.order import CustomerOrderRepository
from ..schemas.order import (
    CustomerOrderInvoice,
    CustomerOrderPaymentConfirmation,
    CustomerOrderUpdate,
)


class CustomerOrderError(PolarError): ...


class OrderNotEligibleForRetry(CustomerOrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = "Order is not eligible for payment retry."
        super().__init__(message, 422)


class PaymentAlreadyInProgress(CustomerOrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = "Payment for order is already in progress."
        super().__init__(message, 409)


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
            .join(Order.product, isouter=True)
            .options(
                *repository.get_eager_options(
                    product_load=contains_eager(Order.product)
                )
            )
        )

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

    async def update(
        self, session: AsyncSession, order: Order, order_update: CustomerOrderUpdate
    ) -> Order:
        return await order_service.update(session, order, order_update)

    async def trigger_invoice_generation(
        self, session: AsyncSession, order: Order
    ) -> None:
        return await order_service.trigger_invoice_generation(session, order)

    async def get_order_invoice(self, order: Order) -> CustomerOrderInvoice:
        if order.invoice_path is None:
            raise InvoiceDoesNotExist(order)

        url, _ = await invoice_service.get_order_invoice_url(order)
        return CustomerOrderInvoice(url=url)

    async def confirm_retry_payment(
        self,
        session: AsyncSession,
        order: Order,
        confirmation_token_id: str | None,
        payment_processor: PaymentProcessor,
        payment_method_id: uuid.UUID | None = None,
    ) -> CustomerOrderPaymentConfirmation:
        return await order_service.process_retry_payment(
            session, order, confirmation_token_id, payment_processor, payment_method_id
        )


customer_order = CustomerOrderService()
