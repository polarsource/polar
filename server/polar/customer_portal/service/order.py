import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Any, Literal

from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.orm import contains_eager
from sqlalchemy.sql.elements import OrderByList

from polar.auth.models import AuthSubject, Customer, Member
from polar.customer.repository import CustomerRepository
from polar.discount.service import DiscountNotRedeemableError
from polar.discount.service import discount as discount_service
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.invoice.service import invoice as invoice_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Order, Product
from polar.models.order import OrderStatus
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import (
    InvoiceDoesNotExist,
    NotExistingPaymentMethod,
    OrderNotEligibleForRetry,
    PaymentError,
    ReceiptNotAllocated,
)
from polar.order.service import order as order_service
from polar.receipt.service import receipt as receipt_service
from polar.subscription.repository import SubscriptionRepository
from polar.tax.calculation.base import InvalidTaxIDError, TaxCalculationLogicalError
from polar.worker import enqueue_job

from ..repository.order import CustomerOrderRepository
from ..schemas.order import (
    CustomerOrderInvoice,
    CustomerOrderPay,
    CustomerOrderPayConfirmationToken,
    CustomerOrderPaymentConfirmation,
    CustomerOrderPayWithoutCredentials,
    CustomerOrderReceipt,
    CustomerOrderUpdate,
)


class PaymentRetryValidationError(PolarError):
    def __init__(self) -> None:
        super().__init__("Payment method does not belong to customer", 422)


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
        status: Sequence[OrderStatus] | None = None,
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

        if status is not None:
            statement = statement.where(Order.status.in_(status))

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
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Order.id == id)
            .options(*repository.get_eager_options())
        )
        if for_update:
            statement = statement.with_for_update(of=Order)
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer | Member],
        subscription_id: uuid.UUID,
    ) -> Order:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_readable_by_id(
            auth_subject,
            subscription_id,
            options=repository.get_eager_options(),
            for_update=True,
        )
        if subscription is None:
            message = "Subscription not found."
        elif subscription.status != SubscriptionStatus.trial_ended:
            message = "This subscription's trial has not ended without converting."
        elif await OrderRepository.from_session(session).has_draft_for_subscription(
            subscription.id
        ):
            message = "A draft order already exists for this subscription."
        else:
            return await order_service.create_subscription_reactivation_order(
                session, subscription
            )

        raise PolarRequestValidationError(
            [
                ValidationError(
                    type="value_error",
                    loc=("body", "subscription_id"),
                    msg=message,
                    input=subscription_id,
                )
            ]
        )

    async def update(
        self, session: AsyncSession, order: Order, order_update: CustomerOrderUpdate
    ) -> Order:
        return await order_service.update(session, order, order_update)

    async def pay(
        self, session: AsyncSession, order: Order, order_pay: CustomerOrderPay
    ) -> Order:
        original_status = order.status
        if original_status != OrderStatus.pending and (
            original_status != OrderStatus.draft
            or order.subscription is None
            or order.subscription.status != SubscriptionStatus.trial_ended
        ):
            raise OrderNotEligibleForRetry(order)

        try:
            order = await order_service.update(
                session, order, order_pay, strict_tax=True
            )
        except InvalidTaxIDError as e:
            raise PolarRequestValidationError(
                [
                    ValidationError(
                        type="value_error",
                        loc=("body", "tax_id"),
                        msg=e.message,
                        input=None,
                    )
                ]
            ) from e
        except TaxCalculationLogicalError as e:
            raise PolarRequestValidationError(
                [
                    ValidationError(
                        type="value_error",
                        loc=("body", "billing_address"),
                        msg=e.message,  # pyright: ignore
                        input=order.billing_address,
                    )
                ]
            ) from e

        is_payment_required = order.is_payment_required
        needs_intent = is_payment_required or order.is_payment_setup_required
        if needs_intent and order.billing_address is None:
            raise PolarRequestValidationError(
                [
                    ValidationError(
                        type="value_error",
                        loc=("body", "billing_address"),
                        msg="A billing address is required to calculate tax.",
                        input=order.billing_address,
                    )
                ]
            )

        intent_type: Literal["payment", "setup"] = (
            "payment" if is_payment_required else "setup"
        )
        try:
            async with discount_service.redeem_order_discount(session, order):
                order.status = OrderStatus.pending
                if not needs_intent:
                    async with order_service.acquire_payment_lock(session, order):
                        enqueue_job("order.paid", order_id=order.id)
                elif isinstance(order_pay, CustomerOrderPayWithoutCredentials):
                    raise PolarRequestValidationError(
                        [
                            ValidationError(
                                type="missing",
                                loc=("body",),
                                msg="A payment method or confirmation token is required.",
                                input=order_pay.model_dump(exclude_unset=True),
                            )
                        ]
                    )
                elif isinstance(order_pay, CustomerOrderPayConfirmationToken):
                    order = await order_service.handle_on_session_payment(
                        session,
                        order,
                        confirmation_token_id=order_pay.confirmation_token_id,
                        payment_processor=PaymentProcessor.stripe,
                        intent_type=intent_type,
                    )
                else:
                    order = await order_service.handle_on_session_payment(
                        session,
                        order,
                        payment_method_id=order_pay.payment_method_id,
                        intent_type=intent_type,
                    )
        except DiscountNotRedeemableError as e:
            raise PolarRequestValidationError(
                [
                    ValidationError(
                        type="value_error",
                        loc=("body", "discount_code"),
                        msg="Discount is no longer redeemable.",
                        input=order.discount.code
                        if order.discount is not None
                        else None,
                    )
                ]
            ) from e
        except NotExistingPaymentMethod as e:
            order.status = original_status
            raise PolarRequestValidationError(
                [
                    ValidationError(
                        type="value_error",
                        loc=("body", "payment_method_id"),
                        msg=e.message,
                        input=e.payment_method_id,
                    )
                ]
            ) from e
        except PaymentError, PolarRequestValidationError:
            order.status = original_status
            raise

        # Update the customer's billing information
        await CustomerRepository.from_session(session).update(
            order.customer,
            update_dict={
                "billing_name": order.billing_name,
                "billing_address": order.billing_address,
                "tax_id": order.tax_id,
            },
        )

        return order

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
        if order.subscription is None:
            raise OrderNotEligibleForRetry(order, status_code=422)

        try:
            if confirmation_token_id is not None:
                order = await order_service.handle_on_session_payment(
                    session,
                    order,
                    confirmation_token_id=confirmation_token_id,
                    payment_processor=payment_processor,
                )
            elif payment_method_id is not None:
                order = await order_service.handle_on_session_payment(
                    session, order, payment_method_id=payment_method_id
                )
        except OrderNotEligibleForRetry as e:
            raise OrderNotEligibleForRetry(e.order, status_code=422) from e
        except NotExistingPaymentMethod as e:
            raise PaymentRetryValidationError() from e
        except PaymentError as e:
            return CustomerOrderPaymentConfirmation(
                status="failed", error=e.error or "Payment failed. Please try again."
            )

        metadata = order.payment_processor_metadata
        status = metadata.get("intent_status")
        if status == "succeeded":
            return CustomerOrderPaymentConfirmation(status="succeeded")
        if status == "requires_action":
            return CustomerOrderPaymentConfirmation(
                status="requires_action",
                client_secret=metadata.get("intent_client_secret"),
            )
        return CustomerOrderPaymentConfirmation(
            status="failed", error=metadata.get("intent_error") or "Payment failed"
        )


customer_order = CustomerOrderService()
