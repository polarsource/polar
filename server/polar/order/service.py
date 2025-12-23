import uuid
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from typing import Any, Literal
from urllib.parse import urlencode

import stripe as stripe_lib
import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.guard import has_product_checkout
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_portal.schemas.order import (
    CustomerOrderPaymentConfirmation,
    CustomerOrderUpdate,
)
from polar.customer_session.service import customer_session as customer_session_service
from polar.email.react import render_email_template
from polar.email.schemas import EmailAdapter
from polar.email.sender import Attachment, enqueue_email
from polar.enums import PaymentProcessor
from polar.event.service import event as event_service
from polar.event.system import OrderPaidMetadata, SystemEvent, build_system_event
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.file.s3 import S3_SERVICES
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.invoice.service import invoice as invoice_service
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.tax import (
    IncompleteTaxLocation,
    InvalidTaxLocation,
    TaxabilityReason,
    TaxCalculation,
    TaxRate,
    calculate_tax,
    from_stripe_tax_rate_details,
)
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Checkout,
    Customer,
    Order,
    OrderItem,
    Organization,
    Payment,
    PaymentMethod,
    Product,
    Subscription,
    Transaction,
    User,
    WalletTransaction,
)
from polar.models.held_balance import HeldBalance
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
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
from polar.payment_method.service import payment_method as payment_method_service
from polar.product.guard import is_custom_price, is_seat_price, is_static_price
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.wallet.repository import WalletTransactionRepository
from polar.wallet.service import wallet as wallet_service
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job, make_bulk_job_delay_calculator

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


class AlreadyBalancedOrder(OrderError):
    def __init__(self, order: Order, payment_transaction: Transaction) -> None:
        self.order = order
        self.payment_transaction = payment_transaction
        message = (
            f"The order {order.id} with payment {payment_transaction.id} "
            "has already been balanced."
        )
        super().__init__(message)


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

    def __init__(
        self,
        order: Order,
        stripe_error: stripe_lib.CardError | stripe_lib.InvalidRequestError,
    ) -> None:
        self.order = order
        self.stripe_error = stripe_error
        message = f"Card payment failed for order {order.id}: {stripe_error.user_message or stripe_error.code}"
        super().__init__(message, 402)


class PaymentRetryValidationError(OrderError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 422)


class SubscriptionNotTrialing(OrderError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = f"Subscription {subscription.id} is not in trialing status."
        super().__init__(message)


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
            .join(Order.product, isouter=True)
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
                    product_load=joinedload(Order.product),
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
        repository = OrderRepository.from_session(session)
        order = await repository.update(
            order, update_dict=order_update.model_dump(exclude_unset=True)
        )

        await self.send_webhook(session, order, WebhookEventType.order_updated)

        return order

    async def set_refunds_blocked(
        self,
        session: AsyncSession,
        order: Order,
        blocked: bool,
    ) -> Order:
        repository = OrderRepository.from_session(session)
        refunds_blocked_at = utc_now() if blocked else None
        order = await repository.update(
            order, update_dict={"refunds_blocked_at": refunds_blocked_at}
        )

        log.info(
            "order.refunds_blocked_changed",
            order_id=order.id,
            refunds_blocked=blocked,
            refunds_blocked_at=refunds_blocked_at,
        )

        return order

    async def trigger_invoice_generation(
        self, session: AsyncSession, order: Order
    ) -> None:
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
            organization_id=order.organization.id,
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
        assert has_product_checkout(checkout)

        product = checkout.product
        if product.is_recurring:
            raise RecurringProduct(checkout, product)

        order = await self._create_order_from_checkout(
            session, checkout, OrderBillingReasonInternal.purchase, payment
        )

        # For seat-based orders, benefits are granted when seats are claimed
        # For non-seat orders, grant benefits immediately
        prices = checkout.prices[product.id]
        has_seat_price = any(is_seat_price(price) for price in prices)
        if not has_seat_price:
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

        return order

    async def create_from_checkout_subscription(
        self,
        session: AsyncSession,
        checkout: Checkout,
        subscription: Subscription,
        billing_reason: Literal[
            OrderBillingReasonInternal.subscription_create,
            OrderBillingReasonInternal.subscription_update,
        ],
        payment: Payment | None = None,
    ) -> Order:
        assert has_product_checkout(checkout)

        product = checkout.product
        if not product.is_recurring:
            raise NotRecurringProduct(checkout, product)

        if subscription.trialing:
            return await self.create_trial_order(
                session, subscription, billing_reason, checkout
            )

        return await self._create_order_from_checkout(
            session, checkout, billing_reason, payment, subscription
        )

    async def _create_order_from_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        billing_reason: OrderBillingReasonInternal,
        payment: Payment | None = None,
        subscription: Subscription | None = None,
    ) -> Order:
        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        items: list[OrderItem] = []
        if has_product_checkout(checkout):
            prices = checkout.prices[checkout.product_id]
            for price in prices:
                # Don't create an item for metered prices
                if not is_static_price(price):
                    continue
                if is_custom_price(price):
                    item = OrderItem.from_price(price, 0, checkout.amount)
                else:
                    item = OrderItem.from_price(price, 0, seats=checkout.seats)
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
            session, organization, customer
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
                product=checkout.product,
                discount=checkout.discount,
                subscription=subscription,
                checkout=checkout,
                user_metadata=checkout.user_metadata,
                custom_field_data=checkout.custom_field_data,
                items=items,
                seats=checkout.seats,
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
        billing_reason: OrderBillingReasonInternal,
    ) -> Order:
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as items:
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
            tax_calculation: TaxCalculation | None = None
            taxable_amount = subtotal_amount - discount_amount
            tax_amount = 0
            taxability_reason: TaxabilityReason | None = None
            tax_rate: TaxRate | None = None
            tax_id = customer.tax_id
            tax_calculation_processor_id: str | None = None

            if (
                taxable_amount != 0
                and product.is_tax_applicable
                and billing_address is not None
            ):
                try:
                    tax_calculation = await calculate_tax(
                        order_id,
                        subscription.currency,
                        # Stripe doesn't support calculating negative tax amounts
                        taxable_amount if taxable_amount >= 0 else -taxable_amount,
                        product.tax_code,
                        billing_address,
                        [tax_id] if tax_id is not None else [],
                        subscription.tax_exempted,
                    )
                except (IncompleteTaxLocation, InvalidTaxLocation):
                    log.warning(
                        "Failed to calculate tax for subscription order due to invalid or incomplete address",
                        subscription_id=subscription.id,
                        order_id=order_id,
                        customer_id=customer.id,
                    )
                    tax_amount = 0
                    tax_calculation_processor_id = None
                else:
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

                if tax_calculation is not None:
                    taxability_reason = tax_calculation["taxability_reason"]
                    tax_rate = tax_calculation["tax_rate"]

            invoice_number = await organization_service.get_next_invoice_number(
                session, subscription.organization, customer
            )

            total_amount = subtotal_amount - discount_amount + tax_amount
            customer_balance = await wallet_service.get_billing_wallet_balance(
                session, customer, subscription.currency
            )

            # Calculate balance change and applied amount
            if total_amount >= 0:
                # Order is a charge: use customer balance if available
                balance_change = -min(total_amount, customer_balance)
                applied_balance_amount = balance_change
            else:
                # Order is a credit: always add to balance
                balance_change = -total_amount
                # Track how much existing debt was cleared
                if customer_balance < 0:
                    applied_balance_amount = min(-total_amount, -customer_balance)
                else:
                    applied_balance_amount = 0

            repository = OrderRepository.from_session(session)
            order = await repository.create(
                Order(
                    id=order_id,
                    status=OrderStatus.pending,
                    subtotal_amount=subtotal_amount,
                    discount_amount=discount_amount,
                    tax_amount=tax_amount,
                    applied_balance_amount=applied_balance_amount,
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

            # Impact customer's balance
            if balance_change != 0:
                await wallet_service.create_balance_transaction(
                    session,
                    customer,
                    balance_change,
                    subscription.currency,
                    order=order,
                )

            # Reset the associated meters, if any
            if billing_reason in {
                OrderBillingReasonInternal.subscription_cycle,
                OrderBillingReasonInternal.subscription_cycle_after_trial,
                OrderBillingReasonInternal.subscription_update,
            }:
                await subscription_service.reset_meters(session, subscription)

            # If the due amount is less or equal than zero, mark it as paid immediately
            if order.due_amount <= 0:
                order = await repository.update(
                    order, update_dict={"status": OrderStatus.paid}
                )
            elif subscription.payment_method_id is None:
                order = await self.handle_payment_failure(session, order)
            else:
                enqueue_job(
                    "order.trigger_payment",
                    order_id=order.id,
                    payment_method_id=subscription.payment_method_id,
                )

            await self._on_order_created(session, order)

            return order

    async def create_trial_order(
        self,
        session: AsyncSession,
        subscription: Subscription,
        billing_reason: Literal[
            OrderBillingReasonInternal.subscription_create,
            OrderBillingReasonInternal.subscription_update,
        ],
        checkout: Checkout | None = None,
    ) -> Order:
        if not subscription.trialing:
            raise SubscriptionNotTrialing(subscription)
        assert subscription.trial_start is not None
        assert subscription.trial_end is not None

        product = subscription.product
        customer = subscription.customer

        items: list[OrderItem] = [
            OrderItem.from_trial(
                product, subscription.trial_start, subscription.trial_end
            )
        ]

        organization = subscription.organization
        invoice_number = await organization_service.get_next_invoice_number(
            session, organization, customer
        )

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                status=OrderStatus.paid,
                subtotal_amount=sum(item.amount for item in items),
                discount_amount=0,
                tax_amount=0,
                currency=subscription.currency,
                billing_reason=billing_reason,
                billing_name=customer.billing_name,
                billing_address=customer.billing_address,
                taxability_reason=None,
                tax_id=customer.tax_id,
                tax_rate=None,
                invoice_number=invoice_number,
                customer=customer,
                product=product,
                discount=None,
                subscription=subscription,
                checkout=checkout,
                user_metadata=subscription.user_metadata,
                custom_field_data=subscription.custom_field_data,
                items=items,
            ),
            flush=True,
        )

        await self._on_order_created(session, order)

        return order

    async def create_wallet_order(
        self,
        session: AsyncSession,
        wallet_transaction: WalletTransaction,
        payment: Payment | None,
    ) -> Order:
        wallet = wallet_transaction.wallet
        items: list[OrderItem] = [
            OrderItem.from_wallet(wallet, wallet_transaction.amount)
        ]

        customer = wallet.customer
        billing_address = customer.billing_address

        subtotal_amount = sum(item.amount for item in items)

        # Retrieve tax data
        tax_amount = wallet_transaction.tax_amount or 0
        taxability_reason = None
        tax_rate: TaxRate | None = None
        tax_id = customer.tax_id
        if wallet_transaction.tax_calculation_processor_id is not None:
            calculation = await stripe_service.get_tax_calculation(
                wallet_transaction.tax_calculation_processor_id
            )
            assert tax_amount == calculation.tax_amount_exclusive
            assert len(calculation.tax_breakdown) > 0
            breakdown = calculation.tax_breakdown[0]
            taxability_reason = TaxabilityReason.from_stripe(
                breakdown.taxability_reason, tax_amount
            )
            tax_rate = from_stripe_tax_rate_details(breakdown.tax_rate_details)

        invoice_number = await organization_service.get_next_invoice_number(
            session, wallet.organization, wallet.customer
        )

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                status=OrderStatus.paid,
                subtotal_amount=subtotal_amount,
                discount_amount=0,
                tax_amount=tax_amount,
                applied_balance_amount=0,
                currency=wallet.currency,
                billing_reason=OrderBillingReasonInternal.purchase,
                billing_name=customer.billing_name,
                billing_address=billing_address,
                taxability_reason=taxability_reason,
                tax_id=tax_id,
                tax_rate=tax_rate,
                invoice_number=invoice_number,
                customer=customer,
                items=items,
                product=None,
                discount=None,
                subscription=None,
                checkout=None,
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

        # Link wallet transaction to the order
        wallet_transaction_repository = WalletTransactionRepository.from_session(
            session
        )
        await wallet_transaction_repository.update(
            wallet_transaction, update_dict={"order": order}
        )

        # Record tax transaction
        if wallet_transaction.tax_calculation_processor_id is not None:
            transaction = await stripe_service.create_tax_transaction(
                wallet_transaction.tax_calculation_processor_id, str(order.id)
            )
            await repository.update(
                order, update_dict={"tax_transaction_processor_id": transaction.id}
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

        if (
            payment_method.processor == PaymentProcessor.stripe
            and order.due_amount < 50
        ):
            # Stripe requires a minimum amount of 50 cents, mark it as paid
            repository = OrderRepository.from_session(session)
            previous_status = order.status
            order = await repository.update(
                order, update_dict={"status": OrderStatus.paid}
            )

            # Add to the customer's balance
            await wallet_service.create_balance_transaction(
                session,
                order.customer,
                -order.due_amount,
                order.currency,
                order=order,
            )

            await self._on_order_updated(session, order, previous_status)
            return

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
                        amount=order.due_amount,
                        currency=order.currency,
                        payment_method=payment_method.processor_id,
                        customer=stripe_customer_id,
                        confirm=True,
                        off_session=True,
                        statement_descriptor_suffix=order.statement_descriptor_suffix,
                        description=f"{order.organization.name} — {order.description}",
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
                except stripe_lib.InvalidRequestError as e:
                    error = e.error
                    if error is not None and error.message:
                        message = error.message.lower()
                        if (
                            "requires a mandate" in message
                            or "detached from a customer" in message
                            or "does not belong to the customer"
                        ):
                            log.info(
                                "Invalid or expired payment method",
                                order_id=order.id,
                                error_code=e.code,
                                error_message=e.user_message,
                            )

                            # Delete the payment method as it's no longer valid
                            await payment_method_service.delete(
                                session, payment_method, force=True
                            )

                            # Mark the payment as failed to trigger dunning
                            await self.handle_payment_failure(session, order)

                            raise CardPaymentFailed(order, e) from e

                    raise

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
                        statement_descriptor_suffix=order.statement_descriptor_suffix,
                        description=f"{order.organization.name} — {order.description}",
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
                        statement_descriptor_suffix=order.statement_descriptor_suffix,
                        description=f"{order.organization.name} — {order.description}",
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

    async def send_admin_notification(
        self, session: AsyncSession, organization: Organization, order: Order
    ) -> None:
        product = order.product

        if product is None:
            return

        if organization.notification_settings["new_order"]:
            product_image_url: str | None = None
            try:
                if product.product_medias and len(product.product_medias) > 0:
                    first_media = product.product_medias[0].file
                    product_image_url = S3_SERVICES[first_media.service].get_public_url(
                        first_media.path
                    )
            except Exception:
                pass

            billing_address = order.billing_address
            customer = order.customer

            await notifications_service.send_to_org_members(
                session,
                org_id=organization.id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_new_product_sale,
                    payload=MaintainerNewProductSaleNotificationPayload(
                        customer_email=customer.email,
                        customer_name=customer.name
                        or order.billing_name
                        or customer.email,
                        billing_address_country=billing_address.country
                        if billing_address
                        else None,
                        billing_address_city=billing_address.city
                        if billing_address
                        else None,
                        billing_address_line1=billing_address.line1
                        if billing_address
                        else None,
                        product_name=product.name,
                        product_price_amount=order.net_amount,
                        product_image_url=product_image_url,
                        order_id=str(order.id),
                        order_date=order.created_at.isoformat(),
                        organization_name=organization.name,
                        organization_slug=organization.slug,
                        billing_reason=order.billing_reason,
                    ),
                ),
            )

    async def send_confirmation_email(
        self, session: AsyncSession, order: Order
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_customer(order.customer_id)

        template_name: Literal[
            "order_confirmation",
            "subscription_confirmation",
            "subscription_cycled",
            "subscription_updated",
        ]
        subject_template: str
        url_path_template: str

        match order.billing_reason:
            case OrderBillingReasonInternal.purchase:
                template_name = "order_confirmation"
                subject_template = "Your {description} order confirmation"
                url_path_template = "/{organization}/portal"
                url_params = {
                    "customer_session_token": "{token}",
                    "id": "{order}",
                    "email": "{email}",
                }
            case OrderBillingReasonInternal.subscription_create:
                template_name = "subscription_confirmation"
                subject_template = "Your {description} subscription"
                url_path_template = "/{organization}/portal"
                url_params = {
                    "customer_session_token": "{token}",
                    "id": "{subscription}",
                    "email": "{email}",
                }
            case (
                OrderBillingReasonInternal.subscription_cycle
                | OrderBillingReasonInternal.subscription_cycle_after_trial
            ):
                template_name = "subscription_cycled"
                subject_template = "Your {description} subscription has been renewed"
                url_path_template = "/{organization}/portal"
                url_params = {
                    "customer_session_token": "{token}",
                    "id": "{subscription}",
                    "email": "{email}",
                }
            case OrderBillingReasonInternal.subscription_update:
                template_name = "subscription_updated"
                subject_template = "Your subscription has changed to {description}"
                url_path_template = "/{organization}/portal"
                url_params = {
                    "customer_session_token": "{token}",
                    "id": "{subscription}",
                    "email": "{email}",
                }

        if not organization.customer_email_settings[template_name]:
            return

        product = order.product
        customer = order.customer
        subscription = order.subscription
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        # Build query parameters with proper URL encoding
        params = {
            key: value.format(
                token=token,
                order=order.id,
                subscription=subscription.id if subscription else "",
                email=customer.email,
            )
            for key, value in url_params.items()
        }
        query_string = urlencode(params)
        url_path = url_path_template.format(organization=organization.slug)
        url = settings.generate_frontend_url(f"{url_path}?{query_string}")
        subject = subject_template.format(description=order.description)
        email = EmailAdapter.validate_python(
            {
                "template": template_name,
                "props": {
                    "email": customer.email,
                    "organization": organization,
                    "product": product,
                    "order": order,
                    "subscription": subscription,
                    "url": url,
                },
            }
        )

        # Generate invoice to attach to the email
        invoice_path: str | None = None
        if invoice_path is None:
            if order.billing_name is None or order.billing_address is None:
                log.warning(
                    "Cannot generate invoice, missing billing info", order_id=order.id
                )
            else:
                order = await self.generate_invoice(session, order)
                invoice_path = order.invoice_path

        attachments: list[Attachment] = []
        if invoice_path is not None:
            invoice = await self.get_order_invoice(order)
            attachments = [
                {"remote_url": invoice.url, "filename": order.invoice_filename}
            ]

        body = render_email_template(email)
        enqueue_email(
            **organization.email_from_reply,
            to_email_addr=customer.email,
            subject=subject,
            html_content=body,
            attachments=attachments,
        )

    async def update_product_benefits_grants(
        self, session: AsyncSession, product: Product
    ) -> None:
        # Skip seat-based orders - benefits are granted when seats are claimed
        base_statement = select(Order).where(
            Order.product_id == product.id,
            Order.deleted_at.is_(None),
            Order.subscription_id.is_(None),
            Order.seats.is_(None),
        )

        count_result = await session.execute(
            base_statement.with_only_columns(func.count())
        )
        total_count = count_result.scalar_one()
        calculate_delay = make_bulk_job_delay_calculator(total_count)

        orders = await session.stream_scalars(
            base_statement,
            execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
        )
        index = 0
        async for order in orders:
            enqueue_job(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=order.customer_id,
                product_id=product.id,
                order_id=order.id,
                delay=calculate_delay(index),
            )
            index += 1

    async def update_refunds(
        self,
        session: AsyncSession,
        order: Order,
        *,
        refunded_amount: int,
        refunded_tax_amount: int,
    ) -> Order:
        repository = OrderRepository.from_session(session)
        order.update_refunds(refunded_amount, refunded_tax_amount)
        order = await repository.update(order)
        await self.send_webhook(session, order, WebhookEventType.order_updated)
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
        order.platform_fee_currency = platform_fee_transactions[0][0].currency
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
        await session.refresh(order.customer, {"organization"})
        if order.product is not None:
            await session.refresh(order.product, {"prices"})

        # Refresh order items with their product_price.product relationship loaded
        # This is needed for webhook serialization which accesses `legacy_product_price.product`
        for item in order.items:
            if item.product_price:
                await session.refresh(item.product_price, {"product"})

        organization = order.organization
        await webhook_service.send(session, organization, event_type, order)

    async def _on_order_created(self, session: AsyncSession, order: Order) -> None:
        enqueue_job("order.confirmation_email", order.id)
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

        metadata = OrderPaidMetadata(
            order_id=str(order.id),
            product_id=str(order.product_id),
            billing_type=order.product.billing_type.value
            if order.product
            else "one_time",
            amount=order.total_amount,
            currency=order.currency,
            net_amount=order.net_amount,
            tax_amount=order.tax_amount,
            applied_balance_amount=order.applied_balance_amount,
            discount_amount=order.discount_amount,
            platform_fee=order.platform_fee_amount,
        )
        if order.discount_id is not None:
            metadata["discount_id"] = str(order.discount_id)
        if order.subscription_id is not None:
            metadata["subscription_id"] = str(order.subscription_id)
            subscription = order.subscription
            if subscription is not None:
                metadata["recurring_interval"] = subscription.recurring_interval.value
                metadata["recurring_interval_count"] = (
                    subscription.recurring_interval_count
                )

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.order_paid,
                customer=order.customer,
                organization=order.organization,
                metadata=metadata,
            ),
        )

        if order.subscription_id is not None and order.billing_reason in (
            OrderBillingReasonInternal.subscription_cycle,
            OrderBillingReasonInternal.subscription_cycle_after_trial,
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

        assert order.subscription is not None
        await subscription_service.mark_past_due(session, order.subscription)

        return order

    async def _handle_consecutive_dunning_attempts(
        self, session: AsyncSession, order: Order
    ) -> Order:
        """Handle consecutive dunning attempts for an order."""
        repository = OrderRepository.from_session(session)

        payment_repository = PaymentRepository.from_session(session)
        failed_attempts = await payment_repository.count_failed_payments_for_order(
            order.id
        )

        now = utc_now()
        subscription = order.subscription

        if failed_attempts >= len(settings.DUNNING_RETRY_INTERVALS) or (
            subscription is not None
            and subscription.past_due_deadline
            and subscription.past_due_deadline < now
        ):
            # No more retries, mark subscription as unpaid and clear retry date
            order = await repository.update(
                order, update_dict={"next_payment_attempt_at": None}
            )

            if subscription is not None and subscription.can_cancel(immediately=True):
                await subscription_service.revoke(session, subscription)

            return order

        # Schedule next retry using the appropriate interval
        next_interval = settings.DUNNING_RETRY_INTERVALS[failed_attempts]
        next_retry_date = now + next_interval

        order = await repository.update(
            order, update_dict={"next_payment_attempt_at": next_retry_date}
        )

        # Re-enqueue benefit revocation to check if grace period has expired
        subscription = order.subscription
        if subscription is not None:
            await subscription_service.enqueue_benefits_grants(session, subscription)

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
            return await repository.update(
                order, update_dict={"next_payment_attempt_at": None}
            )

        payment_method_repository = PaymentMethodRepository.from_session(session)
        if (
            order.subscription.payment_method_id is None
            or (
                await payment_method_repository.get_by_id(
                    order.subscription.payment_method_id
                )
            )
            is None
        ):
            log.warning(
                "Order subscription has no payment method, record a failure",
                order_id=order.id,
                subscription_id=order.subscription.id,
            )
            return await self.handle_payment_failure(session, order)

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


order = OrderService()
