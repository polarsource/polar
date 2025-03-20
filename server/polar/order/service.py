import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Literal, cast

import stripe as stripe_lib
import structlog
from sqlalchemy import UnaryExpression, asc, desc, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.account.service import account as account_service
from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.repository import CheckoutRepository
from polar.config import settings
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.service import discount as discount_service
from polar.email.renderer import get_email_renderer
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.address import Address
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models import (
    Checkout,
    Customer,
    Discount,
    HeldBalance,
    Order,
    OrderItem,
    Organization,
    Product,
    ProductPrice,
    ProductPriceCustom,
    Subscription,
    Transaction,
    User,
)
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.product import ProductBillingType
from polar.models.transaction import TransactionType
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.order.repository import OrderRepository
from polar.order.sorting import OrderSortProperty
from polar.organization.service import organization as organization_service
from polar.product.repository import ProductPriceRepository
from polar.subscription.repository import SubscriptionRepository
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookTypeObject
from polar.worker import enqueue_job

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


class ProductPriceDoesNotExist(OrderError):
    def __init__(self, invoice_id: str, stripe_price_id: str) -> None:
        self.invoice_id = invoice_id
        self.stripe_price_id = stripe_price_id
        message = (
            f"Received invoice {invoice_id} from Stripe with price {stripe_price_id}, "
            f"but no associated ProductPrice exists."
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


class InvoiceNotAvailable(OrderError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = "The invoice is not available for this order."
        super().__init__(message, 404)


class AlreadyBalancedOrder(OrderError):
    def __init__(self, order: Order, payment_transaction: Transaction) -> None:
        self.order = order
        self.payment_transaction = payment_transaction
        message = (
            f"The order {order.id} with payment {payment_transaction.id} "
            "has already been balanced."
        )
        super().__init__(message)


def _is_empty_customer_address(customer_address: dict[str, Any] | None) -> bool:
    return customer_address is None or customer_address["country"] is None


class OrderService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        product_billing_type: Sequence[ProductBillingType] | None = None,
        discount_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        checkout_id: Sequence[uuid.UUID] | None = None,
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
        # Once we add `customer_external_id` be sure to filter for non-deleted.
        # Since it could be shared across soft deleted records whereas the unique ID cannot.
        if customer_id is not None:
            statement = statement.where(Order.customer_id.in_(customer_id))

        if checkout_id is not None:
            statement = statement.where(Order.checkout_id.in_(checkout_id))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == OrderSortProperty.created_at:
                order_by_clauses.append(clause_function(Order.created_at))
            elif criterion in {OrderSortProperty.amount, OrderSortProperty.net_amount}:
                order_by_clauses.append(clause_function(Order.net_amount))
            elif criterion == OrderSortProperty.customer:
                order_by_clauses.append(clause_function(Customer.email))
            elif criterion == OrderSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
            elif criterion == OrderSortProperty.discount:
                order_by_clauses.append(clause_function(Discount.name))
            elif criterion == OrderSortProperty.subscription:
                order_by_clauses.append(clause_function(Order.subscription_id))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Order | None:
        repository = OrderRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .options(
                *repository.get_eager_options(
                    customer_load=contains_eager(Order.customer)
                )
            )
            .where(Order.id == id)
        )
        return await repository.get_one_or_none(statement)

    async def get_order_invoice_url(self, order: Order) -> str:
        if order.stripe_invoice_id is None:
            raise InvoiceNotAvailable(order)

        stripe_invoice = await stripe_service.get_invoice(order.stripe_invoice_id)

        if stripe_invoice.hosted_invoice_url is None:
            raise InvoiceNotAvailable(order)

        return stripe_invoice.hosted_invoice_url

    async def create_from_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        payment_intent: stripe_lib.PaymentIntent | None,
    ) -> Order:
        product = checkout.product
        if product.is_recurring:
            raise RecurringProduct(checkout, product)

        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        stripe_customer_id = customer.stripe_customer_id
        if stripe_customer_id is None:
            raise MissingStripeCustomerID(checkout, customer)

        metadata = {
            "type": ProductType.product,
            "product_id": str(checkout.product_id),
            "checkout_id": str(checkout.id),
        }
        if payment_intent is not None:
            metadata["payment_intent_id"] = payment_intent.id

        price_id_map: dict[str, str] = {}
        prices = product.prices
        for price in prices:
            # For pay-what-you-want prices, we need to generate a dedicated price in Stripe
            if isinstance(price, ProductPriceCustom):
                assert checkout.amount is not None
                assert checkout.currency is not None
                ad_hoc_price = await stripe_service.create_ad_hoc_custom_price(
                    product, price, checkout.amount, checkout.currency
                )
                price_id_map[price.stripe_price_id] = ad_hoc_price.id
            else:
                price_id_map[price.stripe_price_id] = price.stripe_price_id

        (
            stripe_invoice,
            price_line_item_map,
        ) = await stripe_service.create_out_of_band_invoice(
            customer=stripe_customer_id,
            currency=checkout.currency or "usd",
            prices=list(price_id_map.values()),
            coupon=(checkout.discount.stripe_coupon_id if checkout.discount else None),
            # Disable automatic tax for free purchases, since we don't collect customer address in that case
            automatic_tax=checkout.is_payment_required,
            metadata=metadata,
        )

        items: list[OrderItem] = []
        for price in prices:
            stripe_price_id = price_id_map[price.stripe_price_id]
            line_item = price_line_item_map[stripe_price_id]
            items.append(
                OrderItem.from_price(
                    price,
                    sum(t.amount for t in line_item.tax_amounts),
                    line_item.amount,
                )
            )

        discount_amount = 0
        if stripe_invoice.total_discount_amounts:
            for stripe_discount_amount in stripe_invoice.total_discount_amounts:
                discount_amount += stripe_discount_amount.amount

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                subtotal_amount=stripe_invoice.subtotal,
                discount_amount=discount_amount,
                tax_amount=stripe_invoice.tax or 0,
                currency=stripe_invoice.currency,
                billing_reason=OrderBillingReason.purchase,
                billing_address=customer.billing_address,
                stripe_invoice_id=stripe_invoice.id,
                customer=customer,
                product=product,
                discount=checkout.discount,
                subscription=None,
                checkout=checkout,
                user_metadata=checkout.user_metadata,
                custom_field_data=checkout.custom_field_data,
                items=items,
            ),
            flush=True,
        )

        # Sanity check to make sure we didn't mess up the amount.
        # Don't raise an error so the order can be successfully completed nonetheless.
        if payment_intent and order.total_amount != payment_intent.amount:
            log.error(
                "Mismatch between payment intent and invoice amount",
                checkout=checkout.id,
                payment_intent=payment_intent.id,
                invoice=stripe_invoice.id,
            )

        # Enqueue the balance creation
        if payment_intent is not None:
            assert payment_intent.latest_charge is not None
            enqueue_job(
                "order.balance",
                order_id=order.id,
                charge_id=get_expandable_id(payment_intent.latest_charge),
            )

        # Enqueue benefits grants
        enqueue_job(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product.id,
            order_id=order.id,
        )

        # Trigger notifications
        organization = checkout.organization
        await self.send_admin_notification(session, organization, order)
        await self.send_confirmation_email(session, organization, order)
        await self._on_order_created(session, order)

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
                joinedload(Subscription.product),
                joinedload(Subscription.customer),
            ),
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(invoice.id, stripe_subscription_id)

        # Get customer
        customer = subscription.customer

        # Retrieve billing address
        billing_address: Address | None = None
        if not _is_empty_customer_address(invoice.customer_address):
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
        if (
            invoice.metadata
            and (checkout_id := invoice.metadata.get("checkout_id")) is not None
        ):
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
                if product_price is None:
                    raise ProductPriceDoesNotExist(invoice.id, price.id)

            items.append(
                OrderItem(
                    label=line.description or "",
                    amount=line.amount,
                    tax_amount=tax_amount,
                    proration=line.proration,
                    product_price=product_price,
                )
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

        repository = OrderRepository.from_session(session)
        order = await repository.create(
            Order(
                status=OrderStatus.paid
                if invoice.status == "paid"
                else OrderStatus.pending,
                subtotal_amount=invoice.subtotal,
                discount_amount=discount_amount,
                tax_amount=invoice.tax or 0,
                currency=invoice.currency,
                billing_reason=billing_reason,
                billing_address=billing_address,
                stripe_invoice_id=invoice.id,
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

        await self._on_order_created(session, order)

        return order

    async def send_admin_notification(
        self, session: AsyncSession, organization: Organization, order: Order
    ) -> None:
        product = order.product
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

        # Enqueue the balance creation, if it has a charge generated by Stripe
        if order.paid:
            if invoice.charge:
                enqueue_job(
                    "order.balance",
                    order_id=order.id,
                    charge_id=get_expandable_id(invoice.charge),
                )
            # or if it has an associated out-of-band payment intent
            elif invoice.metadata and (
                payment_intent_id := invoice.metadata.get("payment_intent_id")
            ):
                payment_intent = await stripe_service.get_payment_intent(
                    payment_intent_id
                )
                assert payment_intent.latest_charge is not None
                enqueue_job(
                    "order.balance",
                    order_id=order.id,
                    charge_id=get_expandable_id(payment_intent.latest_charge),
                )

        await self._on_order_updated(session, order, previous_status)
        return order

    async def send_confirmation_email(
        self, session: AsyncSession, organization: Organization, order: Order
    ) -> None:
        email_renderer = get_email_renderer({"order": "polar.order"})

        product = order.product
        customer = order.customer
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        subject, body = email_renderer.render_from_template(
            "Your {{ product.name }} order confirmation",
            "order/confirmation.html",
            {
                "featured_organization": organization,
                "product": product,
                "url": settings.generate_frontend_url(
                    f"/{organization.slug}/portal?customer_session_token={token}&id={order.id}"
                ),
                "current_year": datetime.now().year,
            },
        )

        enqueue_email(to_email_addr=customer.email, subject=subject, html_content=body)

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

    async def increment_refunds(
        self,
        session: AsyncSession,
        order: Order,
        *,
        refunded_amount: int,
        refunded_tax_amount: int,
    ) -> Order:
        order.increment_refunds(
            refunded_amount, refunded_tax_amount=refunded_tax_amount
        )
        session.add(order)
        return order

    async def create_order_balance(
        self, session: AsyncSession, order: Order, charge_id: str
    ) -> None:
        organization = order.organization
        account = await account_service.get_by_organization_id(session, organization.id)

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

            await notifications_service.send_to_org_members(
                session=session,
                org_id=organization.id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_create_account,
                    payload=MaintainerCreateAccountNotificationPayload(
                        organization_name=organization.slug,
                        url=organization.account_url,
                    ),
                ),
            )

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
        await platform_fee_transaction_service.create_fees_reversal_balances(
            session, balance_transactions=balance_transactions
        )

    async def _on_order_created(self, session: AsyncSession, order: Order) -> None:
        await self._send_webhook(session, order, WebhookEventType.order_created)
        enqueue_job("order.discord_notification", order_id=order.id)

        # Notify checkout channel that an order has been created from it
        if order.checkout:
            await publish_checkout_event(
                order.checkout.client_secret, CheckoutEvent.order_created
            )

    async def _on_order_updated(
        self, session: AsyncSession, order: Order, previous_status: OrderStatus
    ) -> None:
        await self._send_webhook(session, order, WebhookEventType.order_updated)

        became_paid = (
            order.status == OrderStatus.paid and previous_status != OrderStatus.paid
        )
        if became_paid:
            await self._send_webhook(session, order, WebhookEventType.order_paid)

    async def _send_webhook(
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

        event = cast(WebhookTypeObject, (event_type, order))

        organization = await organization_service.get(
            session, order.product.organization_id
        )
        assert organization is not None
        await webhook_service.send(session, organization, event)


order = OrderService()
