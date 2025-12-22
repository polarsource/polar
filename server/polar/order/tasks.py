import uuid

import stripe as stripe_lib
import structlog
from dramatiq import Retry
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models import Customer, Order
from polar.models.order import OrderBillingReasonInternal
from polar.payment_method.repository import PaymentMethodRepository
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    can_retry,
    enqueue_job,
)

from .repository import OrderRepository
from .service import CardPaymentFailed, NoPendingBillingEntries
from .service import order as order_service

log: Logger = structlog.get_logger()

MAX_RETRIES = 10


class OrderTaskError(PolarTaskError): ...


class SubscriptionDoesNotExist(OrderTaskError):
    def __init__(self, subscription_id: uuid.UUID) -> None:
        self.subscription_id = subscription_id
        message = f"The subscription with id {subscription_id} does not exist."
        super().__init__(message)


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


@actor(actor_name="order.create_subscription_order", priority=TaskPriority.LOW)
async def create_subscription_order(
    subscription_id: uuid.UUID, order_reason: OrderBillingReasonInternal
) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id, options=repository.get_eager_options()
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        try:
            await order_service.create_subscription_order(
                session, subscription, order_reason
            )
        except NoPendingBillingEntries:
            # Skip creating an order if there are no pending billing entries.
            # Usually happens if the subscription is now canceled, and no usage-based billing is pending
            pass


@actor(actor_name="order.trigger_payment", priority=TaskPriority.LOW)
async def trigger_payment(order_id: uuid.UUID, payment_method_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrderRepository.from_session(session)
        order = await repository.get_by_id(
            order_id, options=repository.get_eager_options()
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        payment_method_repository = PaymentMethodRepository.from_session(session)
        payment_method = await payment_method_repository.get_by_id_and_customer(
            payment_method_id, order.customer_id
        )
        if payment_method is None:
            log.info(
                "Payment method not found, triggering dunning process",
                order_id=order_id,
                payment_method_id=payment_method_id,
            )
            await order_service.handle_payment_failure(session, order)
            return

        try:
            await order_service.trigger_payment(session, order, payment_method)
        except CardPaymentFailed:
            # Card errors should not be retried - they will be handled by the dunning process
            # Log the failure but don't retry the task
            log.info(
                "Card payment failed, not retrying - will be handled by dunning",
                order_id=order_id,
            )
            return
        except (
            stripe_lib.APIConnectionError,
            stripe_lib.APIError,
            stripe_lib.RateLimitError,
        ) as e:
            # Network/availability errors should be retried
            log.error(
                "Stripe service error during payment trigger, retrying",
                order_id=order_id,
                error_type=type(e).__name__,
                error_message=str(e),
            )
            if can_retry():
                raise Retry() from e
            else:
                raise


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


@actor(actor_name="order.confirmation_email", priority=TaskPriority.LOW)
async def order_confirmation_email(order_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrderRepository.from_session(session)
        order = await repository.get_by_id(
            order_id, options=repository.get_eager_options()
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        await order_service.send_confirmation_email(session, order)


@actor(actor_name="order.invoice", priority=TaskPriority.LOW)
async def order_invoice(order_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrderRepository.from_session(session)
        order = await repository.get_by_id(
            order_id, options=repository.get_eager_options()
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        await order_service.generate_invoice(session, order)


@actor(
    actor_name="order.process_dunning",
    cron_trigger=CronTrigger.from_crontab("0 * * * *"),
    priority=TaskPriority.MEDIUM,
)
async def process_dunning() -> None:
    """Process all orders that are due for dunning (payment retry)."""
    async with AsyncSessionMaker() as session:
        order_repository = OrderRepository.from_session(session)
        due_orders = await order_repository.get_due_dunning_orders()

    for order in due_orders:
        enqueue_job("order.process_dunning_order", order.id)


@actor(actor_name="order.process_dunning_order", priority=TaskPriority.MEDIUM)
async def process_dunning_order(order_id: uuid.UUID) -> None:
    """Process a single order due for dunning (payment retry)."""
    async with AsyncSessionMaker() as session:
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(
            order_id, options=order_repository.get_eager_options()
        )
        if order is None:
            raise OrderDoesNotExist(order_id)

        await order_service.process_dunning_order(session, order)
