from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase


class OrderBase(IDSchema, TimestampedSchema):
    amount: int
    tax_amount: int
    currency: str

    user_id: UUID4
    product_id: UUID4
    product_price_id: UUID4
    subscription_id: UUID4 | None


class OrderUser(Schema):
    id: UUID4
    email: str
    public_name: str
    github_username: str | None
    avatar_url: str | None


class OrderProduct(ProductBase): ...


class OrderSubscription(SubscriptionBase): ...


class Order(OrderBase):
    user: OrderUser
    product: OrderProduct
    product_price: ProductPrice
    subscription: OrderSubscription | None


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
