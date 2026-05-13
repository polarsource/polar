from datetime import datetime
from typing import TYPE_CHECKING

from polar_sdk.models import LegacyRecurringProductPriceFixed, ProductPriceFixed
from pydantic import Field

from polar.kit.schemas import Schema

if TYPE_CHECKING:
    from polar_sdk.models import Checkout, Order, Product, Subscription


class OrganizationPlanPrice(Schema):
    amount: int
    currency: str


class OrganizationPlanFee(Schema):
    percent: int = Field(description="Percent fee in basis points (e.g. 380 = 3.80%).")
    fixed: int = Field(description="Fixed fee in cents.")


class OrganizationPlan(Schema):
    product_id: str
    name: str
    description: str | None = None
    recurring_interval: str | None = None
    price: OrganizationPlanPrice | None = None
    transaction_fee: OrganizationPlanFee | None = None
    highlight: bool = False
    custom: bool = False
    features: list[str] = Field(default_factory=list)

    @classmethod
    def from_sdk(cls, product: "Product") -> "OrganizationPlan":
        metadata = product.metadata or {}
        fixed_price = next(
            (
                p
                for p in product.prices
                if isinstance(p, ProductPriceFixed | LegacyRecurringProductPriceFixed)
            ),
            None,
        )
        fee_benefit = next(
            (
                b
                for b in product.benefits
                if (b.metadata or {}).get("type") == "transaction_fee"
            ),
            None,
        )
        features_raw = metadata.get("features", "")
        return cls(
            product_id=product.id,
            name=product.name,
            description=product.description,
            recurring_interval=(
                product.recurring_interval.value
                if product.recurring_interval is not None
                else None
            ),
            price=(
                OrganizationPlanPrice(
                    amount=fixed_price.price_amount,
                    currency=fixed_price.price_currency,
                )
                if fixed_price is not None
                else None
            ),
            transaction_fee=(
                OrganizationPlanFee(
                    percent=int(fee_benefit.metadata["fee_percent"]),
                    fixed=int(fee_benefit.metadata["fee_fixed"]),
                )
                if fee_benefit is not None
                else None
            ),
            highlight=bool(metadata.get("highlight", False)),
            custom=bool(metadata.get("custom", False)),
            features=[f.strip() for f in str(features_raw).split(",") if f.strip()],
        )


class OrganizationSubscriptionPendingChange(Schema):
    product_id: str
    applies_at: datetime


class OrganizationSubscription(Schema):
    subscription_id: str
    status: str
    product_id: str
    plan: OrganizationPlan
    amount: int
    currency: str
    recurring_interval: str
    recurring_interval_count: int
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    canceled_at: datetime | None = None
    started_at: datetime | None = None
    ends_at: datetime | None = None
    pending_change: OrganizationSubscriptionPendingChange | None = None

    @classmethod
    def from_sdk(cls, subscription: "Subscription") -> "OrganizationSubscription":
        pending = subscription.pending_update
        return cls(
            subscription_id=subscription.id,
            status=subscription.status.value,
            product_id=subscription.product_id,
            plan=OrganizationPlan.from_sdk(subscription.product),
            amount=subscription.amount,
            currency=subscription.currency,
            recurring_interval=subscription.recurring_interval.value,
            recurring_interval_count=subscription.recurring_interval_count,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            cancel_at_period_end=subscription.cancel_at_period_end,
            canceled_at=subscription.canceled_at,
            started_at=subscription.started_at,
            ends_at=subscription.ends_at,
            pending_change=(
                OrganizationSubscriptionPendingChange(
                    product_id=pending.product_id,
                    applies_at=pending.applies_at,
                )
                if pending is not None and pending.product_id is not None
                else None
            ),
        )


class OrganizationCheckoutRequest(Schema):
    product_id: str = Field(description="Polar product ID to subscribe to.")
    success_url: str | None = None
    embed_origin: str | None = None


class OrganizationCheckoutResponse(Schema):
    checkout_id: str
    url: str
    expires_at: datetime

    @classmethod
    def from_sdk(cls, checkout: "Checkout") -> "OrganizationCheckoutResponse":
        return cls(
            checkout_id=checkout.id,
            url=checkout.url,
            expires_at=checkout.expires_at,
        )


class OrganizationSubscriptionUpdate(Schema):
    product_id: str = Field(description="Polar product ID to switch the plan to.")


class OrganizationOrder(Schema):
    id: str
    created_at: datetime
    invoice_number: str
    status: str
    paid: bool
    total_amount: int = Field(
        description="Total amount in cents, after discount and tax."
    )
    refunded_amount: int = Field(description="Refunded amount in cents.")
    currency: str
    billing_reason: str
    product_name: str
    is_invoice_generated: bool

    @classmethod
    def from_sdk(cls, order: "Order") -> "OrganizationOrder":
        product = order.product
        return cls(
            id=order.id,
            created_at=order.created_at,
            invoice_number=order.invoice_number,
            status=order.status.value,
            paid=order.paid,
            total_amount=order.total_amount,
            refunded_amount=order.refunded_amount,
            currency=order.currency,
            billing_reason=order.billing_reason.value,
            product_name=product.name if product is not None else order.description,
            is_invoice_generated=order.is_invoice_generated,
        )


class OrganizationOrderInvoice(Schema):
    url: str
