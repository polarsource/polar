from babel.numbers import format_currency
from pydantic import UUID4, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.order import OrderBillingReason
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase


class OrderBase(
    CustomFieldDataOutputMixin, MetadataOutputMixin, IDSchema, TimestampedSchema
):
    amount: int
    tax_amount: int
    currency: str
    billing_reason: OrderBillingReason

    user_id: UUID4
    product_id: UUID4
    product_price_id: UUID4
    subscription_id: UUID4 | None
    checkout_id: UUID4 | None

    def get_amount_display(self) -> str:
        return f"{format_currency(
            self.amount / 100,
            self.currency.upper(),
            locale="en_US",
        )}"


class OrderUser(Schema):
    id: UUID4
    email: str
    public_name: str
    github_username: str | None
    avatar_url: str | None


class OrderProduct(ProductBase): ...


class OrderSubscription(SubscriptionBase, MetadataOutputMixin): ...


class Order(OrderBase):
    user: OrderUser
    product: OrderProduct
    product_price: ProductPrice
    subscription: OrderSubscription | None


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
