import random
import uuid
from datetime import datetime, timedelta
from functools import cached_property
from typing import Any

from pydantic import TypeAdapter
from sqlalchemy import Column, ColumnDefault
from sqlalchemy.orm import class_mapper

from polar.customer.schemas.state import CustomerState
from polar.enums import PaymentProcessor, SubscriptionRecurringInterval, TaxBehavior
from polar.kit.address import Address
from polar.kit.utils import utc_now
from polar.kit.visibility import Visibility
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    CheckoutProduct,
    Customer,
    Order,
    OrderItem,
    Organization,
    Payment,
    Product,
    ProductPriceFixed,
    Refund,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.benefit import BenefitType
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.product_price import ProductPriceSource
from polar.models.refund import RefundReason, RefundStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.version import CURRENT_API_VERSION
from polar.webhook.webhooks import BaseWebhookPayload, WebhookPayloadTypeAdapter

_CustomerStateAdapter: TypeAdapter[CustomerState] = TypeAdapter(CustomerState)

UNSUPPORTED_EVENTS: frozenset[WebhookEventType] = frozenset(
    {
        WebhookEventType.customer_seat_assigned,
        WebhookEventType.customer_seat_claimed,
        WebhookEventType.customer_seat_revoked,
        WebhookEventType.member_created,
        WebhookEventType.member_updated,
        WebhookEventType.member_deleted,
        WebhookEventType.discount_created,
        WebhookEventType.discount_updated,
        WebhookEventType.discount_deleted,
    }
)

SUPPORTED_EVENTS: tuple[WebhookEventType, ...] = tuple(
    event for event in WebhookEventType if event not in UNSUPPORTED_EVENTS
)


def with_column_defaults[ModelT](instance: ModelT) -> ModelT:
    """
    Transient objects never go through an INSERT, so column defaults are not
    applied. Apply the Python-side ones so the schemas see complete objects.
    """
    mapper = class_mapper(type(instance))
    for attribute in mapper.column_attrs:
        column = attribute.columns[0]
        if not isinstance(column, Column):
            continue
        default = column.default
        if not isinstance(default, ColumnDefault):
            continue
        if getattr(instance, attribute.key, None) is not None:
            continue
        if default.is_scalar:
            setattr(instance, attribute.key, default.arg)
        elif default.is_callable:
            setattr(instance, attribute.key, default.arg(None))
    return instance


class TriggerFixtures:
    """
    Builds an in-memory, mutually consistent set of objects for a triggered
    webhook event. Nothing is persisted: the objects only exist to be
    serialized into a payload.
    """

    def __init__(self, organization: Organization, seed: int | None = None) -> None:
        self.organization = organization
        self.random = random.Random(seed)
        self.now = utc_now()

    def build(self, event: WebhookEventType) -> BaseWebhookPayload:
        if event in UNSUPPORTED_EVENTS:
            raise ValueError(f"Event {event} cannot be triggered")
        return WebhookPayloadTypeAdapter.validate_python(
            {
                "type": event,
                "timestamp": self.now,
                "api_version": CURRENT_API_VERSION,
                "data": self._data_for(event),
            },
            from_attributes=True,
        )

    def _data_for(self, event: WebhookEventType) -> Any:
        match event:
            case WebhookEventType.checkout_created:
                return self.checkout
            case WebhookEventType.checkout_updated:
                self.checkout.status = CheckoutStatus.confirmed
                return self.checkout
            case WebhookEventType.checkout_expired:
                self.checkout.status = CheckoutStatus.expired
                return self.checkout
            case (
                WebhookEventType.customer_created
                | WebhookEventType.customer_updated
                | WebhookEventType.customer_deleted
            ):
                return self.customer
            case WebhookEventType.customer_state_changed:
                return self.customer_state
            case WebhookEventType.order_created:
                self.order.status = OrderStatus.pending
                return self.order
            case WebhookEventType.order_updated | WebhookEventType.order_paid:
                return self.order
            case WebhookEventType.order_refunded:
                self.order.status = OrderStatus.refunded
                self.order.refunded_amount = self.order.net_amount
                self.order.refunded_tax_amount = self.order.tax_amount
                return self.order
            case (
                WebhookEventType.subscription_created
                | WebhookEventType.subscription_updated
                | WebhookEventType.subscription_active
                | WebhookEventType.subscription_uncanceled
                | WebhookEventType.subscription_resumed
            ):
                return self.subscription
            case WebhookEventType.subscription_canceled:
                self.subscription.cancel_at_period_end = True
                self.subscription.canceled_at = self.now
                self.subscription.ends_at = self.subscription.current_period_end
                return self.subscription
            case WebhookEventType.subscription_cycled:
                start = self.subscription.current_period_end
                self.subscription.current_period_start = start
                self.subscription.current_period_end = self._next_period(start)
                return self.subscription
            case WebhookEventType.subscription_revoked:
                self.subscription.status = SubscriptionStatus.canceled
                self.subscription.canceled_at = self.now
                self.subscription.ends_at = self.now
                self.subscription.ended_at = self.now
                return self.subscription
            case WebhookEventType.subscription_past_due:
                self.subscription.status = SubscriptionStatus.past_due
                self.subscription.past_due_at = self.now
                return self.subscription
            case WebhookEventType.subscription_paused:
                self.subscription.status = SubscriptionStatus.paused
                return self.subscription
            case WebhookEventType.refund_created | WebhookEventType.refund_updated:
                return self.refund
            case WebhookEventType.product_created | WebhookEventType.product_updated:
                return self.product
            case WebhookEventType.organization_updated:
                return self.organization
            case WebhookEventType.benefit_created | WebhookEventType.benefit_updated:
                return self.benefit
            case (
                WebhookEventType.benefit_grant_created
                | WebhookEventType.benefit_grant_updated
                | WebhookEventType.benefit_grant_cycled
            ):
                return self.benefit_grant
            case WebhookEventType.benefit_grant_revoked:
                self.benefit_grant.set_revoked()
                return self.benefit_grant
            case _:
                raise ValueError(f"Event {event} cannot be triggered")

    def _uuid(self) -> uuid.UUID:
        return uuid.UUID(int=self.random.getrandbits(128), version=4)

    def _next_period(self, start: datetime) -> datetime:
        return SubscriptionRecurringInterval.month.get_next_period(start, start.day, 1)

    @cached_property
    def product(self) -> Product:
        created_at = self.now - timedelta(days=30)
        product = with_column_defaults(
            Product(
                id=self._uuid(),
                created_at=created_at,
                name="Pro Plan",
                description="Everything you need to ship.",
                is_tax_applicable=True,
                recurring_interval=SubscriptionRecurringInterval.month,
                recurring_interval_count=1,
                visibility=Visibility.public,
                organization=self.organization,
                organization_id=self.organization.id,
                user_metadata={},
                all_prices=[],
                prices=[],
                product_benefits=[],
                product_medias=[],
                attached_custom_fields=[],
            )
        )
        price = with_column_defaults(
            ProductPriceFixed(
                id=self._uuid(),
                created_at=created_at,
                price_amount=1000,
                price_currency="usd",
                product=product,
                product_id=product.id,
                source=ProductPriceSource.catalog,
            )
        )
        product.all_prices = [price]
        product.prices = [price]
        return product

    @cached_property
    def price(self) -> ProductPriceFixed:
        return self.product.prices[0]  # type: ignore[return-value]

    @cached_property
    def customer(self) -> Customer:
        return with_column_defaults(
            Customer(
                id=self._uuid(),
                created_at=self.now - timedelta(days=7),
                email="jane.doe@example.com",
                email_verified=True,
                name="Jane Doe",
                organization=self.organization,
                organization_id=self.organization.id,
                billing_address=Address.model_validate(
                    {
                        "line1": "1 Infinite Loop",
                        "postal_code": "95014",
                        "city": "Cupertino",
                        "state": "US-CA",
                        "country": "US",
                    }
                ),
                user_metadata={},
            )
        )

    @cached_property
    def checkout(self) -> Checkout:
        return with_column_defaults(
            Checkout(
                id=self._uuid(),
                created_at=self.now,
                payment_processor=PaymentProcessor.stripe,
                status=CheckoutStatus.open,
                expires_at=self.now + timedelta(hours=1),
                client_secret=f"polar_c_{self.random.getrandbits(80):020x}",
                user_metadata={},
                customer_metadata={},
                payment_processor_metadata={},
                amount=self.price.price_amount,
                net_amount=self.price.price_amount,
                tax_amount=0,
                currency="usd",
                organization=self.organization,
                organization_id=self.organization.id,
                product_price=self.price,
                product_price_id=self.price.id,
                product=self.product,
                product_id=self.product.id,
                checkout_products=[
                    with_column_defaults(
                        CheckoutProduct(
                            product=self.product,
                            product_id=self.product.id,
                            order=0,
                            ad_hoc_prices=[],
                        )
                    )
                ],
                customer=self.customer,
                customer_id=self.customer.id,
                customer_billing_address=self.customer.billing_address,
            )
        )

    @cached_property
    def subscription(self) -> Subscription:
        start = self.now - timedelta(days=3)
        return with_column_defaults(
            Subscription(
                id=self._uuid(),
                created_at=start,
                recurring_interval=SubscriptionRecurringInterval.month,
                recurring_interval_count=1,
                status=SubscriptionStatus.active,
                tax_behavior=TaxBehavior.exclusive,
                tax_exempted=False,
                current_period_start=start,
                current_period_end=self._next_period(start),
                anchor_day=start.day,
                cancel_at_period_end=False,
                started_at=start,
                organization=self.organization,
                organization_id=self.organization.id,
                customer=self.customer,
                customer_id=self.customer.id,
                product=self.product,
                product_id=self.product.id,
                subscription_product_prices=[
                    with_column_defaults(
                        SubscriptionProductPrice.from_price(self.price)
                    )
                ],
                currency="usd",
                user_metadata={},
            )
        )

    @cached_property
    def order(self) -> Order:
        amount = self.price.price_amount
        return with_column_defaults(
            Order(
                id=self._uuid(),
                created_at=self.now,
                status=OrderStatus.paid,
                subtotal_amount=amount,
                net_amount=amount,
                tax_amount=0,
                discount_amount=0,
                refunded_amount=0,
                refunded_tax_amount=0,
                applied_balance_amount=0,
                items=[
                    with_column_defaults(
                        OrderItem(
                            id=self._uuid(),
                            created_at=self.now,
                            label=self.product.name,
                            amount=amount,
                            net_amount=amount,
                            tax_amount=0,
                            proration=False,
                            product_price=self.price,
                            product_price_id=self.price.id,
                        )
                    )
                ],
                currency="usd",
                tax_behavior=TaxBehavior.exclusive,
                billing_reason=OrderBillingReasonInternal.subscription_create,
                billing_name=self.customer.name,
                billing_address=self.customer.billing_address,
                invoice_number=f"INV-{self.random.randint(1000, 9999)}",
                organization=self.organization,
                organization_id=self.organization.id,
                customer=self.customer,
                customer_id=self.customer.id,
                product=self.product,
                product_id=self.product.id,
                subscription=self.subscription,
                subscription_id=self.subscription.id,
                checkout=self.checkout,
                checkout_id=self.checkout.id,
                custom_field_data={},
                user_metadata={},
            )
        )

    @cached_property
    def payment(self) -> Payment:
        return with_column_defaults(
            Payment(
                id=self._uuid(),
                created_at=self.now,
                processor=PaymentProcessor.stripe,
                status=PaymentStatus.succeeded,
                amount=self.order.net_amount,
                currency="usd",
                method="card",
                method_metadata={"brand": "visa", "last4": "4242"},
                customer_email=self.customer.email,
                processor_id=f"pi_{self.random.getrandbits(96):024x}",
                organization=self.organization,
                organization_id=self.organization.id,
                checkout=self.checkout,
                checkout_id=self.checkout.id,
                order=self.order,
                order_id=self.order.id,
            )
        )

    @cached_property
    def refund(self) -> Refund:
        return with_column_defaults(
            Refund(
                id=self._uuid(),
                created_at=self.now,
                status=RefundStatus.succeeded,
                reason=RefundReason.customer_request,
                amount=self.order.net_amount,
                tax_amount=self.order.tax_amount,
                currency="usd",
                destination_details={},
                payment=self.payment,
                payment_id=self.payment.id,
                order=self.order,
                order_id=self.order.id,
                subscription=self.subscription,
                subscription_id=self.subscription.id,
                customer=self.customer,
                customer_id=self.customer.id,
                organization=self.organization,
                organization_id=self.organization.id,
                revoke_benefits=False,
                processor=PaymentProcessor.stripe,
                processor_id=f"re_{self.random.getrandbits(96):024x}",
                processor_reason="requested_by_customer",
            )
        )

    @cached_property
    def benefit(self) -> Benefit:
        return with_column_defaults(
            Benefit(
                id=self._uuid(),
                created_at=self.now - timedelta(days=30),
                type=BenefitType.custom,
                description="Access to the private community",
                is_tax_applicable=True,
                organization=self.organization,
                organization_id=self.organization.id,
                user_metadata={},
                selectable=True,
                deletable=True,
                properties={"note": None},
            )
        )

    @cached_property
    def benefit_grant(self) -> BenefitGrant:
        grant = with_column_defaults(
            BenefitGrant(
                id=self._uuid(),
                created_at=self.now,
                benefit=self.benefit,
                benefit_id=self.benefit.id,
                customer=self.customer,
                customer_id=self.customer.id,
                subscription=self.subscription,
                subscription_id=self.subscription.id,
                properties={},
            )
        )
        grant.set_granted()
        return grant

    @cached_property
    def customer_state(self) -> CustomerState:
        customer = self.customer
        customer.active_subscriptions = [self.subscription]
        customer.granted_benefits = [self.benefit_grant]
        customer.active_meters = []
        return _CustomerStateAdapter.validate_python(customer, from_attributes=True)
