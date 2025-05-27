import uuid

import structlog
from babel.numbers import format_currency
from dramatiq import Retry
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.exceptions import PolarTaskError
from polar.integrations.discord.internal_webhook import (
    get_branded_discord_embed,
    send_internal_webhook,
)
from polar.logging import Logger
from polar.models import Customer, Order
from polar.models.order import OrderBillingReason
from polar.product.repository import ProductRepository
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.worker import AsyncSessionMaker, TaskPriority, actor, can_retry

from .repository import OrderRepository
from .service import order as order_service

log: Logger = structlog.get_logger()

MAX_RETRIES = 10


class OrderTaskError(PolarTaskError): ...


class ProductDoesNotExist(OrderTaskError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.product_id = product_id
        message = f"The product with id {product_id} does not exist."
        super().__init__(message)


class OrderDoesNotExist(OrderTaskError):
    def __init__(self, order_id: uuid.UUID) -> None:
        self.order_id = order_id
        message = f"The order with id {order_id} does not exist."
        super().__init__(message)


@actor(actor_name="order.balance", priority=TaskPriority.LOW)
async def create_order_balance(order_id: uuid.UUID, charge_id: str) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrderRepository.from_session(session)
        order = await repository.get_by_id(
            order_id,
            options=(joinedload(Order.customer).joinedload(Customer.organization),),
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        try:
            await order_service.create_order_balance(session, order, charge_id)
        except PaymentTransactionForChargeDoesNotExist as e:
            # Retry because Stripe webhooks order is not guaranteed,
            # so we might not have been able to handle subscription.created
            # or charge.succeeded yet!
            if can_retry():
                raise Retry() from e
            # Raise the exception to be notified about it
            else:
                raise


@actor(actor_name="order.update_product_benefits_grants", priority=TaskPriority.MEDIUM)
async def update_product_benefits_grants(product_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        await order_service.update_product_benefits_grants(session, product)


@actor(actor_name="order.discord_notification", priority=TaskPriority.LOW)
async def order_discord_notification(order_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(
            order_id,
            options=order_repository.get_eager_options(
                customer_load=joinedload(Order.customer).joinedload(
                    Customer.organization
                )
            ),
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        if order.billing_reason not in {
            OrderBillingReason.purchase,
            OrderBillingReason.subscription_create,
        }:
            return

        product = order.product
        customer = order.customer
        organization = order.customer.organization
        subscription = order.subscription

        amount = format_currency(order.net_amount / 100, "USD", locale="en_US")
        if subscription:
            amount = f"{amount} / {subscription.recurring_interval}"

        if order.billing_reason == OrderBillingReason.subscription_create:
            description = "New subscription"
        else:
            description = "One-time purchase"

        await send_internal_webhook(
            {
                "content": "New order",
                "embeds": [
                    get_branded_discord_embed(
                        {
                            "title": product.name,
                            "description": description,
                            "fields": [
                                {
                                    "name": "Organization",
                                    "value": f"[{organization.name}]({
                                        settings.generate_external_url(
                                            f'/backoffice/organizations/{organization.id}'
                                        )
                                    })",
                                },
                                {
                                    "name": "Amount",
                                    "value": amount,
                                },
                                {
                                    "name": "Customer",
                                    "value": customer.email,
                                },
                            ],
                        }
                    )
                ],
            }
        )


@actor(actor_name="order.invoice")
async def order_invoice(order_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrderRepository.from_session(session)
        order = await repository.get_by_id(
            order_id, options=repository.get_eager_options()
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        await order_service.generate_invoice(session, order)
