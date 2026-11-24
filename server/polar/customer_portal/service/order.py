import uuid
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from enum import StrEnum
from typing import Any

import stripe as stripe_lib
from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.orm import contains_eager
from sqlalchemy.sql.elements import OrderByList
from stripe.params._customer_create_params import CustomerCreateParams

from polar.auth.models import AuthSubject, Customer, Member
from polar.config import settings
from polar.discount.service import DiscountNotRedeemableError
from polar.discount.service import discount as discount_service
from polar.enums import PaymentProcessor
from polar.exceptions import PaymentNotReady, PolarError, ResourceNotFound
from polar.integrations.stripe.service import STRIPE_METADATA_PAYMENT_TRIGGER
from polar.integrations.stripe.service import stripe as stripe_service
from polar.invoice.service import invoice as invoice_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Order, Product
from polar.models.discount import DiscountDuration, DiscountPercentage
from polar.models.order import OrderStatus
from polar.models.payment import PaymentTrigger
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import (
    CustomerOrderConflict,
    CustomerOrderPaymentDeclined,
    InvoiceDoesNotExist,
    PaymentFailed,
    PaymentFailedReason,
    ReceiptNotAllocated,
)
from polar.order.service import order as order_service
from polar.payment.repository import PaymentRepository
from polar.product.guard import is_metered_price
from polar.receipt.service import receipt as receipt_service
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import NotTrialEndedSubscription
from polar.worker import enqueue_job

from ..auth import check_billing_permission
from ..repository.order import CustomerOrderRepository
from ..schemas.order import (
    CustomerOrderInvoice,
    CustomerOrderPay,
    CustomerOrderPaymentConfirmation,
    CustomerOrderPayWithPaymentMethod,
    CustomerOrderReceipt,
    CustomerOrderUpdate,
)


class CustomerOrderError(PolarError): ...


class OrderNotPayable(CustomerOrderError):
    def __init__(self) -> None:
        super().__init__("This order is not payable in the customer portal.", 409)


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


class ManualRetryLimitExceeded(CustomerOrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = (
            "Maximum number of payment retry attempts has been reached for this order."
        )
        super().__init__(message, 429)


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
        auth_subject: AuthSubject[Customer | Member],
        *,
        product_id: Sequence[uuid.UUID] | None = None,
        product_billing_type: Sequence[ProductBillingType] | None = None,
        subscription_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[CustomerOrderSortProperty]] = (
            (CustomerOrderSortProperty.created_at, True),
        ),
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
            statement = statement.where(Product.name.icontains(query, autoescape=True))

        order_by_clauses: list[OrderByList | UnaryExpression[Any]] = []
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
        auth_subject: AuthSubject[Customer | Member],
        id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Order | None:
        repository = CustomerOrderRepository.from_session(session)
        return await repository.get_readable_by_id(
            auth_subject, id, for_update=for_update
        )

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer | Member],
        subscription_id: uuid.UUID,
    ) -> Order:
        check_billing_permission(auth_subject)
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_one_or_none(
            repository.get_readable_statement(auth_subject)
            .where(repository.model.id == subscription_id)
            .options(*repository.get_eager_options())
            .with_for_update(of=repository.model)
        )
        if subscription is None:
            raise ResourceNotFound()
        if subscription.status != SubscriptionStatus.trial_ended:
            raise NotTrialEndedSubscription(subscription)

        existing = await OrderRepository.from_session(
            session
        ).get_draft_for_subscription(
            subscription.id,
            options=CustomerOrderRepository.from_session(session).get_eager_options(),
        )
        if existing is not None:
            return existing
        return await order_service.create_subscription_reactivation_order(
            session, subscription
        )

    async def update(
        self, session: AsyncSession, order: Order, order_update: CustomerOrderUpdate
    ) -> Order:
        return await order_service.update_customer_order(session, order, order_update)

    async def pay(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer | Member],
        id: uuid.UUID,
        order_pay: CustomerOrderPay,
    ) -> Order:
        check_billing_permission(auth_subject)
        order = await self.get_by_id(session, auth_subject, id, for_update=True)
        if order is None:
            raise ResourceNotFound()
        if (
            order.status not in (OrderStatus.draft, OrderStatus.pending)
            or order.stripe_invoice_id is not None
        ):
            raise OrderNotPayable()

        subscription = order.subscription
        if (
            order.status == OrderStatus.draft
            and subscription is not None
            and subscription.revoked
        ):
            raise OrderNotPayable()
        organization = order.organization
        if not (
            organization.can_renew_subscriptions
            if subscription is not None
            else organization.can_accept_payments
        ):
            raise PaymentNotReady()

        if (
            await PaymentRepository.from_session(
                session
            ).count_customer_retry_payments_for_order(order.id)
            >= settings.CUSTOMER_RETRY_MAX_ATTEMPTS
        ):
            raise ManualRetryLimitExceeded(order)

        async with (
            order_service.acquire_payment_lock(session, order),
            self._redeem_draft_discount(session, order),
        ):
            if (
                order.status == OrderStatus.draft
                and order.tax_calculation_processor_id is None
            ):
                await order_service.price_draft_order(order, strict=True)

            if order.due_amount == 0 and (
                subscription is None
                or (
                    order.subtotal_amount == 0
                    and not any(
                        is_metered_price(price) for price in subscription.prices
                    )
                )
                or (
                    isinstance(order.discount, DiscountPercentage)
                    and order.discount.duration == DiscountDuration.forever
                    and order.discount.basis_points == 10_000
                )
            ):
                enqueue_job("order.paid", order_id=order.id)
            else:
                intent = await self._create_customer_order_intent(
                    session, order, order_pay
                )
                order.payment_processor_metadata = {
                    "intent_id": intent.id,
                    "intent_status": intent.status,
                }
                if (
                    intent.status == "requires_action"
                    and intent.client_secret is not None
                ):
                    order.payment_processor_metadata["intent_client_secret"] = (
                        intent.client_secret
                    )

        return order

    async def _create_customer_order_intent(
        self, session: AsyncSession, order: Order, order_pay: CustomerOrderPay
    ) -> stripe_lib.PaymentIntent | stripe_lib.SetupIntent:
        customer = order.customer
        params: dict[str, Any] = {
            "confirm": True,
            "automatic_payment_methods": {"enabled": True, "allow_redirects": "never"},
        }
        if isinstance(order_pay, CustomerOrderPayWithPaymentMethod):
            payment_method = await order_service.resolve_payment_method(
                session, customer, order_pay.payment_method_id
            )
            if payment_method.processor != PaymentProcessor.stripe:
                raise PaymentFailed(PaymentFailedReason.missing_payment_method)
            params["payment_method"] = payment_method.processor_id
            if payment_method.type == "sepa_debit":
                del params["automatic_payment_methods"]
                params["payment_method_types"] = ["sepa_debit"]
        else:
            params["confirmation_token"] = order_pay.confirmation_token_id

        if customer.stripe_customer_id is None:
            await session.refresh(
                customer, {"stripe_customer_id"}, with_for_update=True
            )
            if customer.stripe_customer_id is None:
                customer_params: CustomerCreateParams = {
                    "idempotency_key": f"order-recovery-customer:{customer.id}"
                }
                if customer.email is not None:
                    customer_params["email"] = customer.email
                stripe_customer = await stripe_service.create_customer(
                    **customer_params
                )
                customer.stripe_customer_id = stripe_customer.id

        metadata = {
            "organization_id": str(order.organization_id),
            "order_id": str(order.id),
            STRIPE_METADATA_PAYMENT_TRIGGER: PaymentTrigger.retry_customer,
        }
        if order.tax_breakdown:
            metadata["tax_amount"] = str(order.tax_amount)
            tax_country = order.tax_breakdown[0]["country"]
            if tax_country is not None:
                metadata["tax_country"] = tax_country
            tax_state = order.tax_breakdown[0]["state"]
            if tax_state is not None:
                metadata["tax_state"] = tax_state

        params["customer"] = customer.stripe_customer_id
        params["metadata"] = metadata
        try:
            intent: stripe_lib.PaymentIntent | stripe_lib.SetupIntent
            if order.due_amount == 0:
                intent = await stripe_service.create_setup_intent(
                    usage="off_session", **params
                )
            else:
                if "confirmation_token" in params:
                    params["setup_future_usage"] = "off_session"
                intent = await stripe_service.create_payment_intent(
                    amount=order.due_amount,
                    currency=order.currency,
                    statement_descriptor_suffix=order.statement_descriptor_suffix,
                    description=f"{order.organization.name} — {order.description}",
                    **params,
                )
        except (stripe_lib.CardError, stripe_lib.InvalidRequestError) as e:
            raise CustomerOrderPaymentDeclined(
                e.user_message or "Payment declined."
            ) from e
        if intent.status not in ("succeeded", "processing", "requires_action"):
            raise CustomerOrderPaymentDeclined()
        return intent

    @asynccontextmanager
    async def _redeem_draft_discount(
        self, session: AsyncSession, order: Order
    ) -> AsyncIterator[None]:
        discount = order.discount
        subscription = order.subscription
        if (
            order.status != OrderStatus.draft
            or discount is None
            or (subscription is not None and discount.id == subscription.discount_id)
        ):
            yield
            return
        if discount.max_redemptions_per_customer is not None:
            if subscription is None:
                raise CustomerOrderConflict(
                    "A discount with a per-customer limit requires a subscription."
                )
            await session.refresh(order.customer, {"id"}, with_for_update=True)
            if await discount_service.check_per_customer_limit_reached(
                session, discount, customer=order.customer
            ):
                raise CustomerOrderConflict(
                    "The discount code is unavailable for this order."
                )
        try:
            async with discount_service.redeem_discount(
                session, discount
            ) as redemption:
                redemption.subscription = subscription
                yield
        except DiscountNotRedeemableError as e:
            raise CustomerOrderConflict(
                "The discount code is unavailable for this order."
            ) from e

        order.payment_processor_metadata = {
            **order.payment_processor_metadata,
            "discount_redemption_id": str(redemption.id),
        }

    async def trigger_invoice_generation(
        self, session: AsyncSession, order: Order
    ) -> None:
        return await order_service.trigger_invoice_generation(session, order)

    async def get_order_invoice(self, order: Order) -> CustomerOrderInvoice:
        if order.invoice_path is None:
            raise InvoiceDoesNotExist(order)

        url, _ = await invoice_service.get_order_invoice_url(order)
        return CustomerOrderInvoice(url=url)

    async def get_order_receipt(self, order: Order) -> CustomerOrderReceipt | None:
        if order.receipt_number is None:
            raise ReceiptNotAllocated(order)

        result = await receipt_service.get_pdf_url_or_status(order)
        if result is None:
            return None
        url, _ = result
        return CustomerOrderReceipt(url=url)

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
