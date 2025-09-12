import uuid
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, Literal

import stripe as stripe_lib
import structlog
from sqlalchemy import select
from sqlalchemy.orm import contains_eager, joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.repository import CheckoutRepository
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_portal.schemas.order import (
    CustomerOrderPaymentConfirmation,
    CustomerOrderUpdate,
)
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.service import discount as discount_service
from polar.email.react import render_email_template
from polar.email.sender import enqueue_email
from polar.enums import PaymentProcessor
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.invoice.service import invoice as invoice_service
from polar.kit.address import Address
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.tax import (
    TaxabilityReason,
    TaxRate,
    calculate_tax,
    from_stripe_tax_rate,
    from_stripe_tax_rate_details,
)
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Checkout,
    Customer,
    Discount,
    Order,
    OrderItem,
    Organization,
    Payment,
    PaymentMethod,
    Product,
    ProductPrice,
    Subscription,
    Transaction,
    User,
)
from polar.models.held_balance import HeldBalance
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_meter import SubscriptionMeter
from polar.models.transaction import TransactionType
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerNewProductSaleNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.payment.repository import PaymentRepository
from polar.payment_method.repository import PaymentMethodRepository
from polar.product.guard import is_custom_price, is_static_price
from polar.product.repository import ProductPriceRepository
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import OrderRepository
from .schemas import OrderInvoice, OrderUpdate
from .sorting import OrderSortProperty

log: Logger = structlog.get_logger()


class OrderError(PolarError): ...


class RecurringProduct(OrderError):
    def __init__(self, checkout: Checkout, product: Product) -> None:
        self.checkout = checkout
        self.product = product
        message = (
            f"Checkout {checkout.id} is for product {product.id}, "
            "which is a recurring product."
        )
        super().__init__(message)


class NotRecurringProduct(OrderError):
    def __init__(self, checkout: Checkout, product: Product) -> None:
        self.checkout = checkout
        self.product = product
        message = (
            f"Checkout {checkout.id} is for product {product.id}, "
            "which is not a recurring product."
        )
        super().__init__(message)


class MissingCheckoutCustomer(OrderError):
    def __init__(self, checkout: Checkout) -> None:
        self.checkout = checkout
        message = f"Checkout {checkout.id} is missing a customer."
        super().__init__(message)


class MissingStripeCustomerID(OrderError):
    def __init__(self, checkout: Checkout, customer: Customer) -> None:
        self.checkout = checkout
        self.customer = customer
        message = (
            f"Checkout {checkout.id}'s customer {customer.id} "
            "is missing a Stripe customer ID."
        )
        super().__init__(message)


class NotAnOrderInvoice(OrderError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe, but it is not an order."
            " Check if it's an issue pledge."
        )
        super().__init__(message)


class NotASubscriptionInvoice(OrderError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe, but it it not linked to a subscription."
            " One-time purchases invoices are handled directly upon creation."
        )
        super().__init__(message)


class OrderDoesNotExist(OrderError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe, "
            "but no associated Order exists."
        )
        super().__init__(message)


class DiscountDoesNotExist(OrderError):
    def __init__(self, invoice_id: str, coupon_id: str) -> None:
        self.invoice_id = invoice_id
        self.coupon_id = coupon_id
        message = (
            f"Received invoice {invoice_id} from Stripe with coupon {coupon_id}, "
            f"but no associated Discount exists."
        )
        super().__init__(message)


class CheckoutDoesNotExist(OrderError):
    def __init__(self, invoice_id: str, checkout_id: str) -> None:
        self.invoice_id = invoice_id
        self.checkout_id = checkout_id
        message = (
            f"Received invoice {invoice_id} from Stripe with checkout {checkout_id}, "
            f"but no associated Checkout exists."
        )
        super().__init__(message)


class SubscriptionDoesNotExist(OrderError):
    def __init__(self, invoice_id: str, stripe_subscription_id: str) -> None:
        self.invoice_id = invoice_id
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received invoice {invoice_id} from Stripe "
            f"for subscription {stripe_subscription_id}, "
            f"but no associated Subscription exists."
        )
        super().__init__(message)


class AlreadyBalancedOrder(OrderError):
    def __init__(self, order: Order, payment_transaction: Transaction) -> None:
        self.order = order
        self.payment_transaction = payment_transaction
        message = (
            f"The order {order.id} with payment {payment_transaction.id} "
            "has already been balanced."
        )
        super().__init__(message)


class InvoiceAlreadyExists(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"An invoice already exists for order {order.id}."
        super().__init__(message, 409)


class NotPaidOrder(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"Order {order.id} is not paid, so an invoice cannot be generated."
        super().__init__(message, 422)


class MissingInvoiceBillingDetails(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = (
            "Billing name and address are required "
            "to generate an invoice for this order."
        )
        super().__init__(message, 422)


class InvoiceDoesNotExist(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"No invoice exists for order {order.id}."
        super().__init__(message, 404)


class OrderNotEligibleForRetry(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"Order {order.id} is not eligible for payment retry."
        super().__init__(message, 422)


class NoPendingBillingEntries(OrderError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            f"No pending billing entries found for subscription {subscription.id}."
        )
        super().__init__(message)


class OrderNotPending(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"Order {order.id} is not pending"
        super().__init__(message)


class PaymentAlreadyInProgress(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"Payment for order {order.id} is already in progress"
        super().__init__(message, 409)


class CardPaymentFailed(OrderError):
    """Exception for card-related payment failures that should not be retried."""

    def __init__(self, order: Order, stripe_error: stripe_lib.CardError) -> None:
        self.order = order
        self.stripe_error = stripe_error
        message = f"Card payment failed for order {order.id}: {stripe_error.user_message or stripe_error.code}"
        super().__init__(message, 402)


class InvalidPaymentProcessor(OrderError):
    def __init__(self, payment_processor: PaymentProcessor) -> None:
        self.payment_processor = payment_processor
        message = f"Invalid payment processor: {payment_processor}"
        super().__init__(message, 422)


class PaymentRetryValidationError(OrderError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 422)


def _is_empty_customer_address(customer_address: dict[str, Any] | None) -> bool:
    return customer_address is None or customer_address["country"] is None


class OrderService:
    @asynccontextmanager
    async def acquire_payment_lock(
        self, session: AsyncSession, order: Order, *, release_on_success: bool = True
    ) -> AsyncIterator[None]:
        """
        Context manager to acquire and release a payment lock for an order.
        """

        repository = OrderRepository.from_session(session)

        # Try to acquire the lock
        lock_acquired = await repository.acquire_payment_lock_by_id(order.id)
        if not lock_acquired:
            raise PaymentAlreadyInProgress(order)

        try:
            yield
        except Exception:
            await repository.release_payment_lock(order, flush=True)
            raise
        else:
            if release_on_success:
                await repository.release_payment_lock(order, flush=True)

    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        product_billing_type: Sequence[ProductBillingType] | None = None,
        discount_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        checkout_id: Sequence[uuid.UUID] | None = None,
        metadata: MetadataQuery | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[OrderSortProperty]] = [
            (OrderSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Order], int]:
        repository = OrderRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        statement = (
            statement.join(Order.discount, isouter=True)
            .join(Order.product)
            .options(
                *repository.get_eager_options(
                    customer_load=contains_eager(Order.customer),
                    product_load=contains_eager(Order.product),
                    discount_load=contains_eager(Order.discount),
                )
            )
        )

        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Order.product_id.in_(product_id))

        if product_billing_type is not None:
            statement = statement.where(Product.billing_type.in_(product_billing_type))

        if discount_id is not None:
            statement = statement.where(Order.discount_id.in_(discount_id))

        # TODO:
        # Once we add `external_customer_id` be sure to filter for non-deleted.
        # Since it could be shared across soft deleted records whereas the unique ID cannot.
        if customer_id is not None:
            statement = statement.where(Order.customer_id.in_(customer_id))

        if checkout_id is not None:
            statement = statement.where(Order.checkout_id.in_(checkout_id))

        if metadata is not None:
            statement = apply_metadata_clause(Order, statement, metadata)

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Order | None:
        repository = OrderRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .options(
                *repository.get_eager_options(
                    customer_load=contains_eager(Order.customer),
                    product_load=joinedload(Order.product).joinedload(
                        Product.organization
                    ),
                )
            )
            .where(Order.id == id)
        )
        return await repository.get_one_or_none(statement)

    async def update(
        self,
        session: AsyncSession,
        order: Order,
        order_update: OrderUpdate | CustomerOrderUpdate,
    ) -> Order:
        errors: list[ValidationError] = []
        invoice_locked_fields = {"billing_name", "billing_address"}
        if order.invoice_path is not None:
            for field in invoice_locked_fields:
                if field in order_update.model_fields_set and getattr(
                    order_update, field
                ) != getattr(order, field):
                    errors.append(
                        {
                            "type": "value_error",
                            "loc": ("body", field),
                            "msg": "This field cannot be updated after the invoice is generated.",
                            "input": getattr(order_update, field),
                        }
                    )

        if errors:
            raise PolarRequestValidationError(errors)

        repository = OrderRepository.from_session(session)
        order = await repository.update(
            order, update_dict=order_update.model_dump(exclude_unset=True)
        )

        await self.send_webhook(session, order, WebhookEventType.order_updated)

        return order

    async def trigger_invoice_generation(
        self, session: AsyncSession, order: Order
    ) -> None:
        if order.invoice_path is not None:
            raise InvoiceAlreadyExists(order)

        if not order.paid:
            raise NotPaidOrder(order)

        if order.billing_name is None or order.billing_address is None:
            raise MissingInvoiceBillingDetails(order)

        enqueue_job("order.invoice", order_id=order.id)

    async def generate_invoice(self, session: AsyncSession, order: Order) -> Order:
        invoice_path = await invoice_service.create_order_invoice(order)
        repository = OrderRepository.from_session(session)
        order = await repository.update(
            order, update_dict={"invoice_path": invoice_path}
        )

        await eventstream_publish(
            "order.invoice_generated",
            {"order_id": order.id},
            customer_id=order.customer_id,
            organization_id=order.product.organization_id,
        )

        await self.send_webhook(session, order, WebhookEventType.order_updated)

        return order

    async def get_order_invoice(self, order: Order) -> OrderInvoice:
        if order.invoice_path is None:
            raise InvoiceDoesNotExist(order)

        url, _ = await invoice_service.get_order_invoice_url(order)
        return OrderInvoice(url=url)

    async def create_from_checkout_one_time(
        self, session: AsyncSession, checkout: Checkout, payment: Payment | None = None
    ) -> Order:
        product = checkout.product
        if product.is_recurring:
            raise RecurringProduct(checkout, product)

        order = await self._create_order_from_checkout(
            session, checkout, OrderBillingReason.purchase, payment
        )

        # Enqueue benefits grants
        enqueue_job(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=order.customer.id,
            product_id=product.id,
            order_id=order.id,
        )

        # Trigger notifications
        organization = checkout.organization
        await self.send_admin_notification(session, organization, order)
        await self.send_confirmation_email(session, organization, order)

        return order

    async def create_from_checkout_subscription(
        self,
        session: AsyncSession,
        checkout: Checkout,
        subscription: Subscription,
        billing_reason: Literal[
            OrderBillingReason.subscription_create,
            OrderBillingReason.subscription_update,
        ],
        payment: Payment | None = None,
    ) -> Order:
        product = checkout.product
        if not product.is_recurring:
            raise NotRecurringProduct(checkout, product)

        return await self._create_order_from_checkout(
            session, checkout, billing_reason, payment, subscription
        )

    async def _create_order_from_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        billing_reason: OrderBillingReason,
        payment: Payment | None = None,
        subscription: Subscription | None = None,
    ) -> Order:
        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        product = checkout.product
        prices = product.prices

        items: list[OrderItem] = []
        for price in prices:
            # Don't create an item for metered prices
            if not is_static_price(price):
                continue
            if is_custom_price(price):
                item = OrderItem.from_price(price, 0, checkout.amount)
            else:
                item = OrderItem.from_price(price, 0)
            items.append(item)

        discount_amount = checkout.discount_amount

        # Retrieve tax data
        tax_amount = checkout.tax_amount or 0
        taxability_reason = None
        tax_rate: TaxRate | None = None
        tax_id = customer.tax_id
        if checkout.tax_processor_id is not None:
            calculation = await stripe_service.get_tax_calculation(
                checkout.tax_processor_id
            )
            assert tax_amount == calculation.tax_amount_exclusive
            assert len(calculation.tax_breakdown) > 0
            if len(calculation.tax_breakdown) > 1:
                log.warning(
                    "Multiple tax breakdowns found for checkout",
                    checkout_id=checkout.id,
                    calculation_id=calculation.id,
                )
            breakdown = calculation.tax_breakdown[0]
            taxability_reason = TaxabilityReason.from_stripe(
                breakdown.taxability_reason, tax_amount
            )
            tax_rate = from_stripe_tax_rate_details(breakdown.tax_rate_details)

        organization = checkout.organization
        invoice_number = await organization_service.get_next_invoice_number(
            session, organization
        )

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                status=OrderStatus.paid,
                subtotal_amount=checkout.amount,
                discount_amount=discount_amount,
                tax_amount=tax_amount,
                currency=checkout.currency,
                billing_reason=billing_reason,
                billing_name=customer.billing_name,
                billing_address=customer.billing_address,
                taxability_reason=taxability_reason,
                tax_id=tax_id,
                tax_rate=tax_rate,
                invoice_number=invoice_number,
                customer=customer,
                product=product,
                discount=checkout.discount,
                subscription=subscription,
                checkout=checkout,
                user_metadata=checkout.user_metadata,
                custom_field_data=checkout.custom_field_data,
                items=items,
            ),
            flush=True,
        )

        # Link payment and balance transaction to the order
        if payment is not None:
            payment_repository = PaymentRepository.from_session(session)
            assert payment.amount == order.total_amount
            await payment_repository.update(payment, update_dict={"order": order})
            enqueue_job(
                "order.balance", order_id=order.id, charge_id=payment.processor_id
            )

        # Record tax transaction
        if checkout.tax_processor_id is not None:
            transaction = await stripe_service.create_tax_transaction(
                checkout.tax_processor_id, str(order.id)
            )
            await repository.update(
                order, update_dict={"tax_transaction_processor_id": transaction.id}
            )

        await self._on_order_created(session, order)

        return order

    async def create_subscription_order(
        self,
        session: AsyncSession,
        subscription: Subscription,
        billing_reason: OrderBillingReason,
    ) -> Order:
        items = await billing_entry_service.create_order_items_from_pending(
            session, subscription
        )
        if len(items) == 0:
            raise NoPendingBillingEntries(subscription)

        order_id = uuid.uuid4()
        customer = subscription.customer
        billing_address = customer.billing_address
        product = subscription.product

        subtotal_amount = sum(item.amount for item in items)

        discount = subscription.discount
        discount_amount = 0
        if discount is not None:
            # Discount only applies to cycle and meter items, as prorations
            # use "last month's" discount and so this month's discount
            # shouldn't apply to those.
            discountable_amount = sum(
                item.amount for item in items if item.discountable
            )
            discount_amount = discount.get_discount_amount(discountable_amount)

        # Calculate tax
        tax_amount = 0
        taxability_reason: TaxabilityReason | None = None
        tax_rate: TaxRate | None = None
        tax_id = customer.tax_id
        tax_calculation_processor_id: str | None = None

        if (
            product.is_tax_applicable
            and billing_address is not None
            and product.stripe_product_id is not None
        ):
            taxable_amount = subtotal_amount - discount_amount
            tax_calculation = await calculate_tax(
                order_id,
                subscription.currency,
                # Stripe doesn't support calculating negative tax amounts
                taxable_amount if taxable_amount >= 0 else -taxable_amount,
                product.stripe_product_id,
                billing_address,
                [tax_id] if tax_id is not None else [],
                subscription.tax_exempted,
            )
            if taxable_amount >= 0:
                tax_calculation_processor_id = tax_calculation["processor_id"]
                tax_amount = tax_calculation["amount"]
            else:
                # When the taxable amount is negative it's usually due to a credit proration
                # this means we "owe" the customer money -- but we don't pay it back at this
                # point. This also means that there's no money transaction going on, and we
                # don't have to record the tax transaction either.
                tax_calculation_processor_id = None
                tax_amount = -tax_calculation["amount"]

            taxability_reason = tax_calculation["taxability_reason"]
            tax_rate = tax_calculation["tax_rate"]

        invoice_number = await organization_service.get_next_invoice_number(
            session, subscription.organization
        )

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                id=order_id,
                status=OrderStatus.pending,
                subtotal_amount=subtotal_amount,
                discount_amount=discount_amount,
                tax_amount=tax_amount,
                currency=subscription.currency,
                billing_reason=billing_reason,
                billing_name=customer.billing_name,
                billing_address=billing_address,
                taxability_reason=taxability_reason,
                tax_id=tax_id,
                tax_rate=tax_rate,
                tax_calculation_processor_id=tax_calculation_processor_id,
                invoice_number=invoice_number,
                customer=customer,
                product=subscription.product,
                discount=discount,
                subscription=subscription,
                checkout=None,
                items=items,
                user_metadata=subscription.user_metadata,
                custom_field_data=subscription.custom_field_data,
            ),
            flush=True,
        )

        # Reset the associated meters, if any
        if billing_reason in {
            OrderBillingReason.subscription_cycle,
            OrderBillingReason.subscription_update,
        }:
            await subscription_service.reset_meters(session, subscription)

        # If the order total amount is zero, mark it as paid immediately
        if order.total_amount <= 0:
            order = await repository.update(
                order, update_dict={"status": OrderStatus.paid}
            )
        else:
            enqueue_job(
                "order.trigger_payment",
                order_id=order.id,
                payment_method_id=subscription.payment_method_id,
            )

        await self._on_order_created(session, order)

        return order

    async def trigger_payment(
        self, session: AsyncSession, order: Order, payment_method: PaymentMethod
    ) -> None:
        if order.status != OrderStatus.pending:
            raise OrderNotPending(order)

        if order.payment_lock_acquired_at is not None:
            log.warn("Payment already in progress", order_id=order.id)
            raise PaymentAlreadyInProgress(order)

        async with self.acquire_payment_lock(session, order, release_on_success=False):
            if payment_method.processor == PaymentProcessor.stripe:
                metadata: dict[str, Any] = {"order_id": str(order.id)}
                if order.tax_rate is not None:
                    metadata["tax_amount"] = order.tax_amount
                    metadata["tax_country"] = order.tax_rate["country"]
                    metadata["tax_state"] = order.tax_rate["state"]

                stripe_customer_id = order.customer.stripe_customer_id
                assert stripe_customer_id is not None

                try:
                    await stripe_service.create_payment_intent(
                        amount=order.total_amount,
                        currency=order.currency,
                        payment_method=payment_method.processor_id,
                        customer=stripe_customer_id,
                        confirm=True,
                        off_session=True,
                        statement_descriptor_suffix=order.organization.statement_descriptor,
                        description=f"{order.organization.name} — {order.product.name}",
                        metadata=metadata,
                    )
                except stripe_lib.CardError as e:
                    # Card errors (declines, expired cards, etc.) should not be retried
                    # They will be handled by the dunning process
                    log.info(
                        "Card payment failed",
                        order_id=order.id,
                        error_code=e.code,
                        error_message=e.user_message,
                    )
                    raise CardPaymentFailed(order, e) from e

    async def process_retry_payment(
        self,
        session: AsyncSession,
        order: Order,
        confirmation_token_id: str | None,
        payment_processor: PaymentProcessor,
        payment_method_id: uuid.UUID | None = None,
    ) -> CustomerOrderPaymentConfirmation:
        """
        Process retry payment with direct confirmation (confirm=True).
        Follows checkout flow pattern - creates PaymentIntent and lets webhooks handle everything else.
        """

        if order.status != OrderStatus.pending:
            log.warning("Order is not pending", order_id=order.id, status=order.status)
            raise OrderNotEligibleForRetry(order)

        if order.next_payment_attempt_at is None:
            log.warning("Order is not eligible for retry", order_id=order.id)
            raise OrderNotEligibleForRetry(order)

        if order.subscription is None:
            log.warning("Order is not a subscription", order_id=order.id)
            raise OrderNotEligibleForRetry(order)

        if order.payment_lock_acquired_at is not None:
            log.warning(
                "Payment already in progress",
                order_id=order.id,
                lock_acquired_at=order.payment_lock_acquired_at,
            )
            raise PaymentAlreadyInProgress(order)

        if payment_processor != PaymentProcessor.stripe:
            log.warning(
                "Invalid payment processor", payment_processor=payment_processor
            )
            raise OrderNotEligibleForRetry(payment_processor)

        if confirmation_token_id is None and payment_method_id is None:
            raise PaymentRetryValidationError(
                "Either confirmation_token_id or payment_method_id must be provided"
            )
        if confirmation_token_id is not None and payment_method_id is not None:
            raise PaymentRetryValidationError(
                "Only one of confirmation_token_id or payment_method_id can be provided"
            )

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(order.customer_id)
        assert customer is not None, "Customer must exist"

        org_repository = OrganizationRepository.from_session(session)
        organization = await org_repository.get_by_id(customer.organization_id)
        assert organization is not None, "Organization must exist"

        if customer.stripe_customer_id is None:
            log.warning("Customer is not a Stripe customer", customer_id=customer.id)
            raise OrderNotEligibleForRetry(order)

        saved_payment_method: PaymentMethod | None = None
        if payment_method_id is not None:
            payment_method_repository = PaymentMethodRepository.from_session(session)
            saved_payment_method = await payment_method_repository.get_by_id(
                payment_method_id
            )
            if (
                saved_payment_method is None
                or saved_payment_method.customer_id != customer.id
            ):
                raise PaymentRetryValidationError(
                    "Payment method does not belong to customer"
                )

        metadata: dict[str, Any] = {
            "order_id": str(order.id),
        }
        if order.tax_rate is not None:
            metadata["tax_amount"] = str(order.tax_amount)
            metadata["tax_country"] = order.tax_rate["country"]
            metadata["tax_state"] = order.tax_rate["state"]

        try:
            async with self.acquire_payment_lock(
                session, order, release_on_success=True
            ):
                if saved_payment_method is not None:
                    # Using saved payment method
                    payment_intent = await stripe_service.create_payment_intent(
                        amount=order.total_amount,
                        currency=order.currency,
                        payment_method=saved_payment_method.processor_id,
                        customer=customer.stripe_customer_id,
                        confirm=True,
                        statement_descriptor_suffix=organization.statement_descriptor,
                        description=f"{organization.name} — {order.product.name}",
                        metadata=metadata,
                        return_url=settings.generate_frontend_url(
                            f"/portal/orders/{str(order.id)}"
                        ),
                    )
                else:
                    # Using confirmation token (new payment method)
                    assert confirmation_token_id is not None
                    payment_intent = await stripe_service.create_payment_intent(
                        amount=order.total_amount,
                        currency=order.currency,
                        automatic_payment_methods={"enabled": True},
                        confirm=True,
                        confirmation_token=confirmation_token_id,
                        customer=customer.stripe_customer_id,
                        setup_future_usage="off_session",
                        statement_descriptor_suffix=organization.statement_descriptor,
                        description=f"{organization.name} — {order.product.name}",
                        metadata=metadata,
                        return_url=settings.generate_frontend_url(
                            f"/portal/orders/{str(order.id)}"
                        ),
                    )

                if payment_intent.status == "succeeded":
                    log.info(
                        "Retry payment succeeded immediately",
                        order_id=order.id,
                        payment_intent_id=payment_intent.id,
                    )

                    return CustomerOrderPaymentConfirmation(
                        status="succeeded",
                        client_secret=None,
                        error=None,
                    )

                elif payment_intent.status == "requires_action":
                    log.info(
                        "Retry payment requires additional action",
                        order_id=order.id,
                        payment_intent_id=payment_intent.id,
                        status=payment_intent.status,
                    )

                    return CustomerOrderPaymentConfirmation(
                        status="requires_action",
                        client_secret=payment_intent.client_secret,
                        error=None,
                    )

                else:
                    error_message = "Payment failed"
                    if (
                        payment_intent.last_payment_error
                        and payment_intent.last_payment_error.message
                    ):
                        error_message = payment_intent.last_payment_error.message

                    log.warning(
                        "Retry payment failed",
                        order_id=order.id,
                        payment_intent_id=payment_intent.id,
                        status=payment_intent.status,
                        error=error_message,
                    )

                    return CustomerOrderPaymentConfirmation(
                        status="failed",
                        client_secret=None,
                        error=error_message,
                    )

        except stripe_lib.StripeError as stripe_exc:
            log.warning(
                "Stripe error during retry payment",
                order_id=order.id,
                stripe_error_code=stripe_exc.code,
                stripe_error_message=str(stripe_exc),
            )

            error_message = (
                stripe_exc.error.message
                if stripe_exc.error and stripe_exc.error.message
                else "Payment failed. Please try again."
            )

            return CustomerOrderPaymentConfirmation(
                status="failed",
                client_secret=None,
                error=error_message,
            )

        except Exception as exc:
            log.error(
                "Exception during retry payment",
                order_id=order.id,
                error=str(exc),
                exc_info=True,  # Include full traceback
            )

            return CustomerOrderPaymentConfirmation(
                status="failed",
                client_secret=None,
                error="Payment failed. Please try again.",
            )

    async def handle_payment(
        self, session: AsyncSession, order: Order, payment: Payment | None
    ) -> Order:
        # Stripe invoices may already have been marked as paid, so ignore the check
        if order.stripe_invoice_id is None and order.status != OrderStatus.pending:
            raise OrderNotPending(order)

        previous_status = order.status
        update_dict: dict[str, Any] = {}

        if order.status == OrderStatus.pending:
            update_dict["status"] = OrderStatus.paid

        # Clear retry attempt date on successful payment
        if order.next_payment_attempt_at is not None:
            update_dict["next_payment_attempt_at"] = None

        # Clear payment lock on successful payment
        if order.payment_lock_acquired_at is not None:
            log.info(
                "Clearing payment lock on order due to successful payment",
                order_id=order.id,
            )
            update_dict["payment_lock_acquired_at"] = None

        # Balance the order in the ledger
        if payment is not None:
            enqueue_job(
                "order.balance", order_id=order.id, charge_id=payment.processor_id
            )

        # Record tax transaction
        if (
            order.tax_calculation_processor_id is not None
            and order.tax_transaction_processor_id is None
        ):
            transaction = await stripe_service.create_tax_transaction(
                order.tax_calculation_processor_id, str(order.id)
            )
            update_dict["tax_transaction_processor_id"] = transaction.id

        repository = OrderRepository.from_session(session)
        order = await repository.update(order, update_dict=update_dict)

        # If this was a subscription retry success, reactivate the subscription
        if (
            previous_status == OrderStatus.pending
            and order.subscription is not None
            and order.subscription.status == SubscriptionStatus.past_due
        ):
            await subscription_service.mark_active(session, order.subscription)

        if update_dict:
            await self._on_order_updated(session, order, previous_status)

        return order

    async def create_order_from_stripe(
        self, session: AsyncSession, invoice: stripe_lib.Invoice
    ) -> Order:
        assert invoice.id is not None

        if invoice.metadata and invoice.metadata.get("type") in {ProductType.pledge}:
            raise NotAnOrderInvoice(invoice.id)

        if invoice.subscription is None:
            raise NotASubscriptionInvoice(invoice.id)

        # Get subscription
        stripe_subscription_id = get_expandable_id(invoice.subscription)
        subscription_repository = SubscriptionRepository.from_session(session)
        subscription = await subscription_repository.get_by_stripe_subscription_id(
            stripe_subscription_id,
            options=(
                joinedload(Subscription.product).joinedload(Product.organization),
                joinedload(Subscription.customer),
                joinedload(Subscription.meters).joinedload(SubscriptionMeter.meter),
            ),
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(invoice.id, stripe_subscription_id)

        # Get customer
        customer = subscription.customer

        # Retrieve billing address
        billing_address: Address | None = None
        if customer.billing_address is not None:
            billing_address = customer.billing_address
        elif not _is_empty_customer_address(invoice.customer_address):
            billing_address = Address.model_validate(invoice.customer_address)
        # Try to retrieve the country from the payment method
        elif invoice.charge is not None:
            charge = await stripe_service.get_charge(get_expandable_id(invoice.charge))
            if payment_method_details := charge.payment_method_details:
                if card := getattr(payment_method_details, "card", None):
                    billing_address = Address.model_validate({"country": card.country})

        # Get Discount if available
        discount: Discount | None = None
        if invoice.discount is not None:
            coupon = invoice.discount.coupon
            if (metadata := coupon.metadata) is None:
                raise DiscountDoesNotExist(invoice.id, coupon.id)
            discount_id = metadata["discount_id"]
            discount = await discount_service.get(
                session, uuid.UUID(discount_id), allow_deleted=True
            )
            if discount is None:
                raise DiscountDoesNotExist(invoice.id, coupon.id)

        # Get Checkout if available
        checkout: Checkout | None = None
        invoice_metadata = invoice.metadata or {}
        subscription_metadata = (
            invoice.subscription_details.metadata or {}
            if invoice.subscription_details
            else {}
        )
        checkout_id = invoice_metadata.get("checkout_id") or subscription_metadata.get(
            "checkout_id"
        )
        if checkout_id is not None:
            chekout_repository = CheckoutRepository.from_session(session)
            checkout = await chekout_repository.get_by_id(uuid.UUID(checkout_id))
            if checkout is None:
                raise CheckoutDoesNotExist(invoice.id, checkout_id)

        # Handle items
        product_price_repository = ProductPriceRepository.from_session(session)
        items: list[OrderItem] = []
        for line in invoice.lines:
            tax_amount = sum([tax.amount for tax in line.tax_amounts])
            product_price: ProductPrice | None = None
            price = line.price
            if price is not None:
                if price.metadata and price.metadata.get("product_price_id"):
                    product_price = await product_price_repository.get_by_id(
                        uuid.UUID(price.metadata["product_price_id"]),
                        options=product_price_repository.get_eager_options(),
                    )
                else:
                    product_price = (
                        await product_price_repository.get_by_stripe_price_id(
                            price.id,
                            options=product_price_repository.get_eager_options(),
                        )
                    )

            items.append(
                OrderItem(
                    label=line.description or "",
                    amount=line.amount,
                    tax_amount=tax_amount,
                    proration=line.proration,
                    product_price=product_price,
                )
            )

        if invoice.status == "draft":
            # Add pending billing entries
            stripe_customer_id = customer.stripe_customer_id
            assert stripe_customer_id is not None
            pending_items = await billing_entry_service.create_order_items_from_pending(
                session,
                subscription,
                stripe_invoice_id=invoice.id,
                stripe_customer_id=stripe_customer_id,
            )
            items.extend(pending_items)
            # Reload the invoice to get totals with added pending items
            if len(pending_items) > 0:
                invoice = await stripe_service.get_invoice(invoice.id)

            # Update statement descriptor
            # Stripe doesn't allow to set statement descriptor on the subscription itself,
            # so we need to set it manually on each new invoice.
            assert invoice.id is not None
            await stripe_service.update_invoice(
                invoice.id,
                statement_descriptor=subscription.organization.statement_descriptor_prefixed,
            )

        # Determine billing reason
        billing_reason = OrderBillingReason.subscription_cycle
        if invoice.billing_reason is not None:
            try:
                billing_reason = OrderBillingReason(invoice.billing_reason)
            except ValueError as e:
                log.error(
                    "Unknown billing reason, fallback to 'subscription_cycle'",
                    invoice_id=invoice.id,
                    billing_reason=invoice.billing_reason,
                )

        # Calculate discount amount
        discount_amount = 0
        if invoice.total_discount_amounts:
            for stripe_discount_amount in invoice.total_discount_amounts:
                discount_amount += stripe_discount_amount.amount

        # Retrieve tax data
        tax_id = customer.tax_id
        tax_calculation_processor_id: str | None = None
        tax_amount = invoice.tax or 0
        taxability_reason: TaxabilityReason | None = None
        tax_rate: TaxRate | None = None

        # If the subscription is tax-exempted, we need to retrieve tax rate manually:
        # we don't apply tax on the invoice, but we need to know the rate for our
        # accounting and fulfillment purposes.
        if subscription.tax_exempted:
            product = subscription.product
            assert invoice.id is not None
            assert product.stripe_product_id is not None
            assert customer.billing_address is not None
            tax_calculation = await calculate_tax(
                invoice.id,
                invoice.currency,
                invoice.subtotal,
                product.stripe_product_id,
                customer.billing_address,
                [customer.tax_id] if customer.tax_id is not None else [],
                subscription.tax_exempted,
            )
            tax_calculation_processor_id = tax_calculation["processor_id"]
            tax_amount = tax_calculation["amount"]
            taxability_reason = tax_calculation["taxability_reason"]
            tax_rate = tax_calculation["tax_rate"]
        # Automatic tax is enabled, so we can directly take the data from Stripe
        else:
            for total_tax_amount in invoice.total_tax_amounts:
                taxability_reason = TaxabilityReason.from_stripe(
                    total_tax_amount.taxability_reason, tax_amount
                )
                stripe_tax_rate = await stripe_service.get_tax_rate(
                    get_expandable_id(total_tax_amount.tax_rate)
                )
                try:
                    tax_rate = from_stripe_tax_rate(stripe_tax_rate)
                except ValueError:
                    continue
                else:
                    break

        # Ensure it inherits original metadata and custom fields
        user_metadata = (
            checkout.user_metadata
            if checkout is not None
            else subscription.user_metadata
        )
        custom_field_data = (
            checkout.custom_field_data
            if checkout is not None
            else subscription.custom_field_data
        )

        invoice_number = await organization_service.get_next_invoice_number(
            session, subscription.organization
        )

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                status=OrderStatus.paid
                if invoice.status == "paid"
                else OrderStatus.pending,
                subtotal_amount=invoice.subtotal,
                discount_amount=discount_amount,
                tax_amount=tax_amount,
                currency=invoice.currency,
                billing_reason=billing_reason,
                billing_name=customer.billing_name,
                billing_address=billing_address,
                stripe_invoice_id=invoice.id,
                taxability_reason=taxability_reason,
                tax_id=tax_id,
                tax_rate=tax_rate,
                tax_calculation_processor_id=tax_calculation_processor_id,
                invoice_number=invoice_number,
                customer=customer,
                product=subscription.product,
                discount=discount,
                subscription=subscription,
                checkout=checkout,
                items=items,
                user_metadata=user_metadata,
                custom_field_data=custom_field_data,
                created_at=datetime.fromtimestamp(invoice.created, tz=UTC),
            ),
            flush=True,
        )

        # Reset the associated meters, if any
        if billing_reason == OrderBillingReason.subscription_cycle:
            await subscription_service.reset_meters(session, subscription)

        await self._on_order_created(session, order)

        return order

    async def send_admin_notification(
        self, session: AsyncSession, organization: Organization, order: Order
    ) -> None:
        product = order.product

        if organization.notification_settings["new_order"]:
            await notifications_service.send_to_org_members(
                session,
                org_id=product.organization_id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_new_product_sale,
                    payload=MaintainerNewProductSaleNotificationPayload(
                        customer_name=order.customer.email,
                        product_name=product.name,
                        product_price_amount=order.net_amount,
                        organization_name=organization.slug,
                    ),
                ),
            )

    async def update_order_from_stripe(
        self, session: AsyncSession, invoice: stripe_lib.Invoice
    ) -> Order:
        repository = OrderRepository.from_session(session)
        assert invoice.id is not None
        order = await repository.get_by_stripe_invoice_id(
            invoice.id, options=repository.get_eager_options()
        )
        if order is None:
            raise OrderDoesNotExist(invoice.id)

        previous_status = order.status
        status = OrderStatus.paid if invoice.status == "paid" else OrderStatus.pending
        order = await repository.update(order, update_dict={"status": status})

        # Enqueue the balance creation for out-of-band subscription creation orders
        if (
            order.paid
            and invoice.metadata
            and (charge_id := invoice.metadata.get("charge_id"))
        ):
            enqueue_job("order.balance", order_id=order.id, charge_id=charge_id)

        await self._on_order_updated(session, order, previous_status)
        return order

    async def send_confirmation_email(
        self, session: AsyncSession, organization: Organization, order: Order
    ) -> None:
        product = order.product
        customer = order.customer
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        body = render_email_template(
            "order_confirmation",
            {
                "organization": organization.email_props,
                "product": product.email_props,
                "url": settings.generate_frontend_url(
                    f"/{organization.slug}/portal?customer_session_token={token}&id={order.id}"
                ),
            },
        )

        enqueue_email(
            **organization.email_from_reply,
            to_email_addr=customer.email,
            subject=f"Your {product.name} order confirmation",
            html_content=body,
        )

    async def update_product_benefits_grants(
        self, session: AsyncSession, product: Product
    ) -> None:
        statement = select(Order).where(
            Order.product_id == product.id,
            Order.deleted_at.is_(None),
            Order.subscription_id.is_(None),
        )
        orders = await session.stream_scalars(statement)
        async for order in orders:
            enqueue_job(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=order.customer_id,
                product_id=product.id,
                order_id=order.id,
            )

    async def update_refunds(
        self,
        session: AsyncSession,
        order: Order,
        *,
        refunded_amount: int,
        refunded_tax_amount: int,
    ) -> Order:
        order.update_refunds(refunded_amount, refunded_tax_amount=refunded_tax_amount)
        session.add(order)
        return order

    async def create_order_balance(
        self, session: AsyncSession, order: Order, charge_id: str
    ) -> None:
        organization = order.organization
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_organization(organization.id)

        # Retrieve the payment transaction and link it to the order
        payment_transaction = await balance_transaction_service.get_by(
            session, type=TransactionType.payment, charge_id=charge_id
        )
        if payment_transaction is None:
            raise PaymentTransactionForChargeDoesNotExist(charge_id)

        # Make sure to take the amount from the payment transaction and not the order
        # Orders invoices may apply customer balances which won't reflect the actual payment amount
        transfer_amount = payment_transaction.amount

        payment_transaction.order = order
        payment_transaction.payment_customer = order.customer
        session.add(payment_transaction)

        # Prepare an held balance
        # It'll be used if the account is not created yet
        held_balance = HeldBalance(
            amount=transfer_amount, order=order, payment_transaction=payment_transaction
        )

        # No account, create the held balance
        if account is None:
            held_balance.organization = organization

            # Sanity check: make sure we didn't already create a held balance for this order
            existing_held_balance = await held_balance_service.get_by(
                session,
                payment_transaction_id=payment_transaction.id,
                organization_id=organization.id,
            )
            if existing_held_balance is not None:
                raise AlreadyBalancedOrder(order, payment_transaction)

            await held_balance_service.create(session, held_balance=held_balance)

            return

        # Sanity check: make sure we didn't already create a balance for this order
        existing_balance_transaction = await balance_transaction_service.get_by(
            session,
            type=TransactionType.balance,
            payment_transaction_id=payment_transaction.id,
            account_id=account.id,
        )
        if existing_balance_transaction is not None:
            raise AlreadyBalancedOrder(order, payment_transaction)

        # Account created, create the balance immediately
        balance_transactions = (
            await balance_transaction_service.create_balance_from_charge(
                session,
                source_account=None,
                destination_account=account,
                charge_id=charge_id,
                amount=transfer_amount,
                order=order,
            )
        )
        platform_fee_transactions = (
            await platform_fee_transaction_service.create_fees_reversal_balances(
                session, balance_transactions=balance_transactions
            )
        )
        order.platform_fee_amount = sum(
            incoming.amount for _, incoming in platform_fee_transactions
        )
        session.add(order)

    async def send_webhook(
        self,
        session: AsyncSession,
        order: Order,
        event_type: Literal[
            WebhookEventType.order_created,
            WebhookEventType.order_updated,
            WebhookEventType.order_paid,
        ],
    ) -> None:
        await session.refresh(order.product, {"prices"})

        # Refresh order items with their product_price.product relationship loaded
        # This is needed for webhook serialization which accesses `legacy_product_price.product`
        for item in order.items:
            if item.product_price:
                await session.refresh(item.product_price, {"product"})

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            order.product.organization_id
        )
        if organization is not None:
            await webhook_service.send(session, organization, event_type, order)

    async def _on_order_created(self, session: AsyncSession, order: Order) -> None:
        await self.send_webhook(session, order, WebhookEventType.order_created)

        if order.paid:
            await self._on_order_updated(
                session,
                order,
                OrderStatus.pending,  # Pretend the previous status was pending to trigger the paid event
            )

        # Notify checkout channel that an order has been created from it
        if order.checkout:
            await publish_checkout_event(
                order.checkout.client_secret, CheckoutEvent.order_created
            )

    async def _on_order_updated(
        self, session: AsyncSession, order: Order, previous_status: OrderStatus
    ) -> None:
        await self.send_webhook(session, order, WebhookEventType.order_updated)

        became_paid = (
            order.status == OrderStatus.paid and previous_status != OrderStatus.paid
        )
        if became_paid:
            await self._on_order_paid(session, order)

    async def _on_order_paid(self, session: AsyncSession, order: Order) -> None:
        assert order.paid

        await self.send_webhook(session, order, WebhookEventType.order_paid)

        if (
            order.subscription_id is not None
            and order.billing_reason == OrderBillingReason.subscription_cycle
        ):
            enqueue_job(
                "benefit.enqueue_benefit_grant_cycles",
                subscription_id=order.subscription_id,
            )

    async def handle_payment_failure(
        self, session: AsyncSession, order: Order
    ) -> Order:
        """Handle payment failure for an order, initiating dunning if necessary."""
        # Don't process payment failure if the order is already paid
        if order.status == OrderStatus.paid:
            log.warning(
                "Ignoring payment failure for already paid order",
                order_id=order.id,
            )
            return order

        # Clear payment lock on failure
        if order.payment_lock_acquired_at is not None:
            log.info(
                "Clearing payment lock on order due to payment failure",
                order_id=order.id,
            )
            repository = OrderRepository.from_session(session)
            order = await repository.release_payment_lock(order)

        if order.subscription is None:
            return order

        if order.subscription.stripe_subscription_id is not None:
            # If the subscription is managed by Stripe, we don't handle dunning. Stripe will handle it.
            return order

        if order.next_payment_attempt_at is None:
            return await self._handle_first_dunning_attempt(session, order)

        return await self._handle_consecutive_dunning_attempts(session, order)

    async def _handle_first_dunning_attempt(
        self, session: AsyncSession, order: Order
    ) -> Order:
        """Handle the first dunning attempt for an order, setting the next payment
        attempt date and marking the subscription as past due.
        """

        first_retry_date = utc_now() + settings.DUNNING_RETRY_INTERVALS[0]

        repository = OrderRepository.from_session(session)
        order = await repository.update(
            order, update_dict={"next_payment_attempt_at": first_retry_date}
        )

        await subscription_service.mark_past_due(session, order.subscription)

        return order

    async def _handle_consecutive_dunning_attempts(
        self, session: AsyncSession, order: Order
    ) -> Order:
        """Handle consecutive dunning attempts for an order."""
        payment_repository = PaymentRepository.from_session(session)
        failed_attempts = await payment_repository.count_failed_payments_for_order(
            order.id
        )

        repository = OrderRepository.from_session(session)

        if failed_attempts >= len(settings.DUNNING_RETRY_INTERVALS):
            # No more retries, mark subscription as unpaid and clear retry date
            order = await repository.update(
                order, update_dict={"next_payment_attempt_at": None}
            )

            subscription = order.subscription
            if subscription is not None and subscription.can_cancel(immediately=True):
                await subscription_service.revoke(session, subscription)

            return order

        # Schedule next retry using the appropriate interval
        next_interval = settings.DUNNING_RETRY_INTERVALS[failed_attempts]
        next_retry_date = utc_now() + next_interval

        order = await repository.update(
            order, update_dict={"next_payment_attempt_at": next_retry_date}
        )

        return order

    async def process_dunning_order(self, session: AsyncSession, order: Order) -> Order:
        """Process a single order due for dunning payment retry."""
        if order.subscription is None:
            log.warning(
                "Order has no subscription, skipping dunning",
                order_id=order.id,
            )
            return order

        if order.subscription.status == SubscriptionStatus.canceled:
            log.info(
                "Order subscription is cancelled, removing order from dunning process",
                order_id=order.id,
                subscription_id=order.subscription.id,
            )

            repository = OrderRepository.from_session(session)
            order = await repository.update(
                order, update_dict={"next_payment_attempt_at": None}
            )
            return order

        if order.subscription.payment_method_id is None:
            log.warning(
                "Order subscription has no payment method, skipping dunning",
                order_id=order.id,
                subscription_id=order.subscription.id,
            )
            return order

        log.info(
            "Processing dunning order",
            order_id=order.id,
            subscription_id=order.subscription.id,
        )

        # Enqueue a payment retry for this order
        enqueue_job(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=order.subscription.payment_method_id,
        )

        return order

    async def customer_balance(self, session: AsyncSession, customer: Customer) -> int:
        """
        Returns what the customer is "owed".

        This can happen if the customer switches from e.g. a yearly plan at $100/yr to
        a monthly plan at $15/mo. In that case the customer has $85 in "credit" or balance
        on their account (depending on when they changed the plan).
        """
        order_repository = OrderRepository.from_session(session)
        paid_orders = await order_repository.get_all(
            order_repository.get_base_statement()
            # .join(Customer, Order.customer_id == Customer.id)
            .where(
                Customer.id == customer.id,
                Order.deleted_at.is_(None),
                Order.status == OrderStatus.paid,
            )
        )
        payment_repository = PaymentRepository.from_session(session)
        payments = await payment_repository.get_all(
            payment_repository.get_base_statement()
            .join(Order, Payment.order_id == Order.id)
            .where(
                Order.customer_id == customer.id,
                Order.deleted_at.is_(None),
                Payment.status == PaymentStatus.succeeded,
            )
        )

        total_orders = sum(order.total_amount for order in paid_orders)
        total_paid = sum(payment.amount for payment in payments)

        return total_orders - total_paid


order = OrderService()
