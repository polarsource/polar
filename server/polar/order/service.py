import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

import stripe as stripe_lib
import structlog
from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import aliased, contains_eager, joinedload

from polar.account.service import account as account_service
from polar.auth.models import AuthSubject, is_organization, is_user
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.service import checkout as checkout_service
from polar.config import settings
from polar.customer.service import customer as customer_service
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
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models import (
    Checkout,
    Customer,
    Discount,
    HeldBalance,
    Order,
    Organization,
    Product,
    ProductPrice,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.order import OrderBillingReason
from polar.models.product_price import ProductPriceType
from polar.models.transaction import TransactionType
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.order.sorting import OrderSortProperty
from polar.organization.service import organization as organization_service
from polar.product.service.product_price import product_price as product_price_service
from polar.subscription.service import subscription as subscription_service
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


class NotAnOrderInvoice(OrderError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe, but it is not an order."
            " Check if it's an issue pledge."
        )
        super().__init__(message)


class CantDetermineInvoicePrice(OrderError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe, but can't determine the price."
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


class InvoiceWithoutCharge(OrderError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = f"Received invoice {invoice_id} from Stripe, but it has no charge."
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


class OrderService(ResourceServiceReader[Order]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        product_price_type: Sequence[ProductPriceType] | None = None,
        discount_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[OrderSortProperty]] = [
            (OrderSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Order], int]:
        statement = self._get_readable_order_statement(auth_subject)

        statement = statement.join(Order.discount, isouter=True).options(
            joinedload(Order.subscription).joinedload(Subscription.customer),
            contains_eager(Order.discount),
        )

        OrderProductPrice = aliased(ProductPrice)
        statement = statement.join(
            OrderProductPrice, onclause=Order.product_price_id == OrderProductPrice.id
        ).options(contains_eager(Order.product_price.of_type(OrderProductPrice)))

        OrderCustomer = aliased(Customer)
        statement = statement.join(
            OrderCustomer, onclause=Order.customer_id == OrderCustomer.id
        ).options(contains_eager(Order.customer.of_type(OrderCustomer)))

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Order.product_id.in_(product_id))

        if product_price_type is not None:
            statement = statement.where(OrderProductPrice.type.in_(product_price_type))

        if discount_id is not None:
            statement = statement.where(Order.discount_id.in_(discount_id))

        if customer_id is not None:
            statement = statement.where(Order.customer_id.in_(customer_id))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == OrderSortProperty.created_at:
                order_by_clauses.append(clause_function(Order.created_at))
            elif criterion == OrderSortProperty.amount:
                order_by_clauses.append(clause_function(Order.amount))
            elif criterion == OrderSortProperty.customer:
                order_by_clauses.append(clause_function(OrderCustomer.email))
            elif criterion == OrderSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
            elif criterion == OrderSortProperty.discount:
                order_by_clauses.append(clause_function(Discount.name))
            elif criterion == OrderSortProperty.subscription:
                order_by_clauses.append(clause_function(Order.subscription_id))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Order | None:
        statement = (
            self._get_readable_order_statement(auth_subject)
            .where(Order.id == id)
            .options(
                joinedload(Order.customer),
                joinedload(Order.product_price),
                joinedload(Order.subscription).joinedload(Subscription.customer),
                joinedload(Order.discount),
            )
        )

        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_order_invoice_url(self, order: Order) -> str:
        if order.stripe_invoice_id is None:
            raise InvoiceNotAvailable(order)

        stripe_invoice = await stripe_service.get_invoice(order.stripe_invoice_id)

        if stripe_invoice.hosted_invoice_url is None:
            raise InvoiceNotAvailable(order)

        return stripe_invoice.hosted_invoice_url

    async def create_order_from_stripe(
        self, session: AsyncSession, *, invoice: stripe_lib.Invoice
    ) -> Order:
        assert invoice.id is not None

        if invoice.metadata and invoice.metadata.get("type") in {ProductType.pledge}:
            raise NotAnOrderInvoice(invoice.id)

        # Get price and product
        stripe_prices: list[stripe_lib.Price] = []
        for line in invoice.lines.data:
            if not line.proration and line.price is not None:
                stripe_prices.append(line.price)

        product_price: ProductPrice | None = None
        # For invoices with only one line item, get the price from the line item
        if len(stripe_prices) == 1:
            stripe_price = stripe_prices.pop()
            # For custom prices, we create ad-hoc prices on Stripe,
            # but set the "father" price ID as metadata
            if stripe_price.metadata and stripe_price.metadata.get("product_price_id"):
                product_price = await product_price_service.get_by_id(
                    session, uuid.UUID(stripe_price.metadata["product_price_id"])
                )
            else:
                product_price = await product_price_service.get_by_stripe_price_id(
                    session, stripe_price.id
                )
            if product_price is None:
                raise ProductPriceDoesNotExist(invoice.id, stripe_price.id)
        # For invoices with only prorations, try to get the price from the subscription metadata
        elif len(stripe_prices) == 0:
            if (
                invoice.subscription_details is None
                or invoice.subscription_details.metadata is None
                or (
                    (
                        price_id := invoice.subscription_details.metadata.get(
                            "product_price_id"
                        )
                    )
                    is None
                )
            ):
                raise CantDetermineInvoicePrice(invoice.id)
            product_price = await product_price_service.get_by_id(
                session, uuid.UUID(price_id)
            )
            if product_price is None:
                raise CantDetermineInvoicePrice(invoice.id)
        # For invoices with multiple line items, we can't determine the price
        else:
            raise CantDetermineInvoicePrice(invoice.id)

        product = product_price.product

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
            checkout = await checkout_service.get(session, uuid.UUID(checkout_id))
            if checkout is None:
                raise CheckoutDoesNotExist(invoice.id, checkout_id)

        customer: Customer | None = None

        billing_reason: OrderBillingReason = OrderBillingReason.purchase
        tax = invoice.tax or 0
        amount = invoice.total - tax

        user_metadata = {}
        custom_field_data = {}

        # Get subscription if applicable
        subscription: Subscription | None = None
        if invoice.subscription is not None:
            stripe_subscription_id = get_expandable_id(invoice.subscription)
            subscription = await subscription_service.get_by_stripe_subscription_id(
                session, stripe_subscription_id
            )
            if subscription is None:
                raise SubscriptionDoesNotExist(invoice.id, stripe_subscription_id)
            customer = await customer_service.get(session, subscription.customer_id)
            if invoice.billing_reason is not None:
                try:
                    billing_reason = OrderBillingReason(invoice.billing_reason)
                except ValueError as e:
                    log.error(
                        "Unknown billing reason, fallback to 'subscription_cycle'",
                        invoice_id=invoice.id,
                        billing_reason=invoice.billing_reason,
                    )
                    billing_reason = OrderBillingReason.subscription_cycle

            # Ensure renewals inherit original metadata and custom fields
            user_metadata = subscription.user_metadata
            custom_field_data = subscription.custom_field_data

            # Set the subscription amount to the latest order amount
            # Helps to reflect discount that may have ended
            if subscription.amount != amount:
                subscription.amount = amount
                session.add(subscription)

        if checkout is not None:
            user_metadata = checkout.user_metadata
            custom_field_data = checkout.custom_field_data

        # Create Order
        order = Order(
            amount=amount,
            tax_amount=tax,
            currency=invoice.currency,
            billing_reason=billing_reason,
            billing_address=billing_address,
            stripe_invoice_id=invoice.id,
            product=product,
            product_price=product_price,
            discount=discount,
            subscription=subscription,
            checkout=checkout,
            user_metadata=user_metadata,
            custom_field_data=custom_field_data,
            created_at=datetime.fromtimestamp(invoice.created, tz=UTC),
        )

        organization = await organization_service.get(session, product.organization_id)
        assert organization is not None

        # Get or create customer
        assert invoice.customer is not None
        if customer is None:
            stripe_customer = await stripe_service.get_customer(
                get_expandable_id(invoice.customer)
            )
            customer = await customer_service.get_or_create_from_stripe_customer(
                session, stripe_customer, organization
            )

        order.customer = customer
        session.add(order)
        await session.flush()

        # Create the transactions balances for the order, if payment was actually made
        # Payment can be skipped in two cases:
        # * The invoice total is zero, like a free product (obviously)
        # * A balance was applied to the invoice, generally because customer has a credit after a subscription downgrade
        # FIXME: need to find a better way to handle out-of-band, but that's a quick fix for now
        if invoice.amount_paid > 0 or (invoice.paid_out_of_band and invoice.total > 0):
            charge_id = get_expandable_id(invoice.charge) if invoice.charge else None
            # With Polar Checkout, we mark the order paid out-of-band,
            # so we need to retrieve the charge manually from metadata
            if charge_id is None:
                invoice_metadata = invoice.metadata or {}
                payment_intent_id = invoice_metadata.get("payment_intent_id")
                if payment_intent_id is None:
                    raise InvoiceWithoutCharge(invoice.id)

                payment_intent = await stripe_service.get_payment_intent(
                    payment_intent_id
                )
                if payment_intent.latest_charge is None:
                    raise InvoiceWithoutCharge(invoice.id)
                charge_id = get_expandable_id(payment_intent.latest_charge)

            await self._create_order_balance(
                session, order, charge_id=get_expandable_id(charge_id)
            )

        if order.subscription is None:
            enqueue_job(
                "benefit.enqueue_benefits_grants",
                task="grant",
                customer_id=customer.id,
                product_id=product.id,
                order_id=order.id,
            )

            await self.send_admin_notification(session, organization, order)
            await self.send_confirmation_email(session, organization, order)

        if invoice.billing_reason in ["manual", "subscription_create"]:
            enqueue_job(
                "order.discord_notification",
                order_id=order.id,
            )

        # Notify checkout channel that an order has been created from it
        if checkout is not None:
            await publish_checkout_event(
                checkout.client_secret, CheckoutEvent.order_created
            )

        await self._send_webhook(session, order)

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
                    product_price_amount=order.amount,
                    organization_name=organization.slug,
                ),
            ),
        )

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

    async def set_refunded(
        self,
        session: AsyncSession,
        order: Order,
        *,
        refunded_amount: int,
        refunded_tax_amount: int,
    ) -> Order:
        order.set_refunded(refunded_amount, refunded_tax_amount=refunded_tax_amount)
        session.add(order)
        # Trigger webhooks
        return order

    async def _create_order_balance(
        self, session: AsyncSession, order: Order, charge_id: str
    ) -> None:
        product = order.product
        account = await account_service.get_by_organization_id(
            session, product.organization_id
        )

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
            managing_organization = await organization_service.get(
                session, product.organization_id
            )
            assert managing_organization is not None
            held_balance.organization_id = managing_organization.id

            # Sanity check: make sure we didn't already create a held balance for this order
            existing_held_balance = await held_balance_service.get_by(
                session,
                payment_transaction_id=payment_transaction.id,
                organization_id=managing_organization.id,
            )
            if existing_held_balance is not None:
                raise AlreadyBalancedOrder(order, payment_transaction)

            await held_balance_service.create(session, held_balance=held_balance)

            await notifications_service.send_to_org_members(
                session=session,
                org_id=managing_organization.id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_create_account,
                    payload=MaintainerCreateAccountNotificationPayload(
                        organization_name=managing_organization.slug,
                        url=managing_organization.account_url,
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

    async def _send_webhook(self, session: AsyncSession, order: Order) -> None:
        await session.refresh(order.product, {"prices"})

        event: WebhookTypeObject = (WebhookEventType.order_created, order)

        organization = await organization_service.get(
            session, order.product.organization_id
        )
        assert organization is not None
        await webhook_service.send(session, organization, event)

    def _get_readable_order_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Order]]:
        statement = (
            select(Order)
            .where(Order.deleted_at.is_(None))
            .join(Order.product)
            .options(contains_eager(Order.product))
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement

    def _get_readable_subscription_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Subscription]]:
        statement = (
            select(Subscription)
            .where(Subscription.deleted_at.is_(None))
            .join(Subscription.product)
            .options(contains_eager(Subscription.product))
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement


order = OrderService(Order)
